import "server-only";
import { ownerSupportCommand } from "@/core/public-owner-support";
import { requireRole } from "./auth";
import { db, rateLimit } from "./db";

export async function publicOwnerSupport(input: unknown) {
  const actor = await requireRole(["owner"]);
  if (process.env.DOCKED_BETA_STAGING === "true")
    throw Error("Public support unavailable");
  const command = ownerSupportCommand.parse(input);
  if (!(await rateLimit(`owner-support:${actor.user.id}`, 20, 60)))
    throw Error("Support rate limit");
  return db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${actor.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: actor.user.id, session_id: actor.sessionId, aal: actor.aal })},true)`;
    const [row] =
      await tx`select private.owner_support_command(${tx.json(command)}::jsonb) value`;
    return row.value;
  });
}
