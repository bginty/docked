import "server-only";
import { adminRoles } from "@/core/admin-navigation";
import { adminRecordInput, type AdminRecord } from "@/core/admin-record";
import { requireRole } from "./auth";
import { db, rateLimit } from "./db";

export async function adminRecord(
  input: Record<string, string | undefined>,
): Promise<AdminRecord | null> {
  const actor = await requireRole([...adminRoles]);
  const parsed = adminRecordInput(input, actor.role);
  if (process.env.DOCKED_BETA_STAGING !== "true")
    throw Error("Record source unavailable");
  if (!(await rateLimit(`admin-record:${actor.user.id}`, 40, 60)))
    throw Error("Record rate limit");
  return db().begin(async (tx) => {
    // Admission checks take FOR SHARE locks; SQL READ ONLY would reject them.
    // Read branches still call only permission-scoped reporting projections.
    await tx`set local statement_timeout='4000ms'`;
    await tx`select set_config('request.jwt.claim.sub',${actor.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: actor.user.id, session_id: actor.sessionId, aal: actor.aal })},true)`;
    const current =
      await tx`select role from private.roles where user_id=${actor.user.id}`;
    if (current[0]?.role !== actor.role) throw Error("Role denied");
    const result =
      await tx`select private.admin_record_detail(${parsed.category},${parsed.id},${parsed.page}) record`;
    return result[0]?.record as AdminRecord | null;
  });
}
