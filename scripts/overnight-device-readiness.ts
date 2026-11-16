/** Read-only fixtures and source-worker observations; never arms a test window. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { databaseConnectionOptions } from "../src/server/database-tls";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import path from "node:path";

const root = process.cwd();
const config = JSON.parse(
  readFileSync(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
    "utf8",
  ),
);
assert.equal(config.projectRef, "bckkllmndoxzpzdqrevb");
assert.equal(
  new URL(config.databaseUrl).username,
  "postgres.bckkllmndoxzpzdqrevb",
);
const preview = postgres(config.databaseUrl, {
  ...databaseConnectionOptions(config.databaseUrl, {
    DATABASE_SSL_CA_FILE: path.resolve("certs/supabase-prod-ca-2021.crt"),
  }),
  max: 1,
  onnotice: () => {},
});
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const production = ownerDatabase();
process.chdir(root);
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
async function main() {
  try {
    const fixture = await preview.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='30s'`;
        const rows =
          await tx`select u.id,u.phone_confirmed_at is not null phone_confirmed,
        (select coalesce(sum(remaining),0)::int from commercial_billing.lots where member_id=u.id) balance,
        (select count(*)::int from commercial_billing.recovery_cases where member_id=u.id and state='OPEN') holds,
        (select count(*)::int from commercial_billing.cards where owner_id=u.id) cards,
        (select count(*)::int from commercial_billing.receipts where member_id=u.id) receipts
        from auth.users u where u.deleted_at is null and u.email ~ '^docked-preview-public-member-[a-f0-9]+@example[.]invalid$'`;
        const member = rows.find(
          (r) =>
            sha(r.id) ===
            "e2415491fe17fbcd919f5ba5d2140580cad923ae7cb08956384644087179755a",
        );
        assert(member && member.balance === 0 && member.holds === 0);
        const capacity = await tx`select sport,rarity,count(*)::int definitions,
        count(distinct player_id) filter(where issued<lifetime_cap)::int available_players,
        sum(lifetime_cap-issued)::text remaining_copies,
        bool_and(snapshot->>'synthetic'='true' and snapshot->>'testInventory'='true' and rights_reference='isolated-v30-synthetic-fixture') fictional_only
        from commercial_billing.definitions group by sport,rarity order by sport,rarity`;
        assert.equal(capacity.length, 15);
        assert(capacity.every((r) => r.fictional_only === true));
        const receipts =
          await tx`select key,product->>'id' product,state,gross_cents,refunded_cents,created_at from commercial_billing.receipts where member_id=${member.id} order by key`;
        return {
          projectRef: config.projectRef,
          memberSha256: sha(member.id),
          phoneConfirmed: member.phone_confirmed,
          openingBalance: member.balance,
          openHolds: member.holds,
          existingCards: member.cards,
          existingReceipts: member.receipts,
          priorReceiptSetSha256: sha(JSON.stringify(receipts)),
          priorReceiptStates: receipts.map((r) => ({
            product: r.product,
            state: r.state,
            fullyRefunded: String(r.gross_cents) === String(r.refunded_cents),
          })),
          capacity,
          eachNineCardOfferHasInitialSupply: capacity.every(
            (r) => r.available_players >= 9,
          ),
          caveat:
            "Initial capacity is not a promise after random issuance. Recheck before each purchase; preserve a sold-out failure without debit, never reseed supply.",
        };
      },
    );
    const workers = await production.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='30s'`;
        const recent =
          await tx`select status,count(*)::int records from sports_feed.nfl_worker_runs where started_at>now()-interval '2 hours' group by status order by status`;
        const errors =
          await tx`select detail->>'code' code,count(*)::int records from sports_feed.nfl_worker_runs where started_at>now()-interval '2 hours' and detail ? 'code' group by detail->>'code' order by 1`;
        const [sourceRetention] =
          await tx`select count(*)::int total,count(*)filter(where body is null)::int purged,count(*)filter(where purged_at>now()-interval '2 hours')::int recent_purges,count(*)filter(where purged_at is not null and purged_at<expires_at)::int early_purges from sports_feed.raw_revisions`;
        return {
          recentWindowHours: 2,
          recent,
          errors,
          sourceRetention,
          collectionFailureIsSeparateFromIssuedCardReveal: true,
          operationalDriftFullyClassified: false,
        };
      },
    );
    const evidence = {
      at: new Date().toISOString(),
      fixture,
      workers,
      productionWrites: 0,
      previewWrites: 0,
      sms: 0,
      purchases: 0,
      approvalOrActivation: false,
    };
    writeFileSync(
      "docs/qa/overnight-launch-20261117/device-readiness.json",
      JSON.stringify(evidence, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(JSON.stringify(evidence));
  } finally {
    await Promise.all([
      preview.end({ timeout: 5 }),
      production.end({ timeout: 5 }),
    ]);
  }
}
main().catch(() => {
  console.error(
    "Read-only device readiness incomplete; no mutations or private responses emitted.",
  );
  process.exitCode = 1;
});
