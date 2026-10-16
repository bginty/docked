import "server-only";
import {
  moderationRetentionMutation,
  type RetentionView,
  type RetentionRecord,
} from "@/core/moderation-retention";
import { requireRole } from "./auth";
import { db, rateLimit } from "./db";
export async function moderationRetention(
  page = 1,
  input?: unknown,
): Promise<RetentionView | RetentionRecord> {
  const actor = await requireRole(["owner", "admin", "editor", "auditor"]);
  if (process.env.DOCKED_BETA_STAGING !== "true")
    throw Error("Retention source unavailable");
  const mutation =
    input === undefined ? undefined : moderationRetentionMutation.parse(input);
  if (mutation && !["owner", "admin"].includes(actor.role))
    throw Error("Role denied");
  if (!(await rateLimit(`retention:${actor.user.id}`, mutation ? 15 : 45, 60)))
    throw Error("Retention rate limit");
  return db().begin(async (tx) => {
    // Admission checks take FOR SHARE locks; SQL READ ONLY would reject them.
    // Read branches call only permission-scoped reporting projections.
    await tx`set local statement_timeout='4000ms'`;
    await tx`select set_config('request.jwt.claim.sub',${actor.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: actor.user.id, session_id: actor.sessionId, aal: actor.aal })},true)`;
    if (mutation) {
      const [row] =
        await tx`select private.moderation_retention_command(${tx.json(mutation)}::jsonb) value`;
      return row.value as RetentionRecord;
    }
    const [row] =
      await tx`select private.moderation_retention_list(${page}) value`;
    const view = row.value as RetentionView;
    return {
      ...view,
      page,
      hasMore: view.records.length > 25,
      records: view.records.slice(0, 25),
    };
  });
}
