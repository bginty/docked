import { randomUUID } from "node:crypto";
import { runCommunityMaintenance } from "../src/core/community-maintenance";
import { db } from "../src/server/db";
import { config } from "../src/server/config";
import { finishJob } from "../src/server/account-job";
import { processAccountDeletion } from "../src/server/account-deletion";
import { processCommunityNotifications } from "../src/server/community-social";
import {
  communityRetentionQueries,
  leaseDeletionJobQuery,
  recoverDeletionJobsQuery,
} from "../src/server/community-maintenance-query";

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== "once")
    throw Error("Explicit one-shot mode required");
  const settings = config(); // Includes exact hosted-production manifest guard.
  if (
    !settings.production ||
    process.env.DOCKED_HOSTED_PRODUCTION !== "true" ||
    !settings.database
  )
    throw Error("Dedicated production environment required");
  const sql = db();
  const roles = await sql`select current_user role`;
  if (roles[0]?.role !== "docked_app")
    throw Error("Restricted runtime role required");
  const result = await runCommunityMaintenance({
    recoverExhausted: async () => {
      await sql.unsafe(recoverDeletionJobsQuery);
    },
    leaseDeletion: async () => {
      const rows = await sql.unsafe(leaseDeletionJobQuery, [randomUUID()]);
      return rows[0]
        ? {
            id: String(rows[0].id),
            leaseToken: String(rows[0].lease_token),
            userId: rows[0].payload?.userId,
          }
        : null;
    },
    deleteAccount: processAccountDeletion,
    finishDeletion: (job, duration, failed) =>
      finishJob(
        job.id,
        job.leaseToken,
        duration,
        failed
          ? "Account erasure failed; access remains revoked; inspect Auth service configuration"
          : undefined,
      ),
    purgeRetention: async () => {
      await sql.begin(async (tx) => {
        for (const query of communityRetentionQueries) await tx.unsafe(query);
      });
    },
    fanout: () => processCommunityNotifications({ communityOnly: true }),
    incident: async (kind) => {
      await sql`insert into private.audit_events(actor,action,subject,details) values('community-maintenance',${`community_maintenance_${kind}_failure`},'service','{"reason":"Bounded maintenance failed; inspect private operator state"}')`;
    },
  });
  console.log(
    JSON.stringify({
      status: result.errors ? "DEGRADED" : "COMPLETE",
      ...result,
    }),
  );
  if (result.errors) process.exitCode = 1;
}

main()
  .catch(() => {
    console.error(
      "Community maintenance failed. Review the private database/job state; no secrets are logged.",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    if (process.env.DATABASE_URL) {
      try {
        await db().end();
      } catch {
        /* Configuration rejection opened no connection. */
      }
    }
  });
