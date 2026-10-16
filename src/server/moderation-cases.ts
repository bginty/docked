import "server-only";
import {
  moderationCaseMutation,
  type ModerationCase,
  type ModerationCaseView,
} from "@/core/moderation-cases";
import { requireRole } from "./auth";
import { db, rateLimit } from "./db";
export async function moderationCase(input: {
  id: string;
  mutation?: unknown;
}): Promise<ModerationCaseView | ModerationCase> {
  const actor = await requireRole(["owner", "admin", "editor", "auditor"]);
  if (process.env.DOCKED_BETA_STAGING !== "true")
    throw Error("Case source unavailable");
  const mutation =
    input.mutation === undefined
      ? undefined
      : moderationCaseMutation.parse(input.mutation);
  if (mutation && actor.role === "auditor") throw Error("Role denied");
  if (
    !(await rateLimit(
      `moderation-case:${actor.user.id}`,
      mutation ? 20 : 60,
      60,
    ))
  )
    throw Error("Case rate limit");
  return db().begin(async (tx) => {
    // Admission checks take FOR SHARE locks; SQL READ ONLY would reject them.
    // Read branches still call only permission-scoped reporting projections.
    await tx`set local statement_timeout='4000ms'`;
    await tx`select set_config('request.jwt.claim.sub',${actor.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: actor.user.id, session_id: actor.sessionId, aal: actor.aal })},true)`;
    if (mutation) {
      const [row] =
        await tx`select private.moderation_case_mutate(${tx.json(mutation)}::jsonb) value`;
      return row.value as ModerationCase;
    }
    const [row] =
      await tx`select private.moderation_case_read(${input.id}::uuid) value`;
    return row.value as ModerationCaseView;
  });
}
