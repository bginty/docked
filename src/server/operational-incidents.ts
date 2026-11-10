import "server-only";
import { requireRole } from "./auth";
import { db } from "./db";
export async function operationalIncidents(
  action = "read",
  payload: Record<string, unknown> = {},
) {
  const who = await requireRole(["owner"]);
  return db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true), set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    const [row] =
      await tx`select operations.review(${action},${tx.json(payload as never)}) result`;
    return row.result;
  });
}
