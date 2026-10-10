import "server-only";
import { requireRole } from "./auth";
import { db } from "./db";
import { operationFilters, type Operations } from "../core/owner-operations";
export async function ownerOperations(
  input: Record<string, string | undefined>,
) {
  const who = await requireRole(["owner"]),
    filters = operationFilters(input);
  if (filters.scope === "live" || process.env.DOCKED_BETA_STAGING !== "true")
    return { filters, data: null };
  const data = await db().begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    const [r] =
      await tx`select private.owner_operations(${filters.startAt}::timestamptz,${filters.endAt}::timestamptz,${filters.sport === "all" ? null : filters.sport},${filters.staff === "true"}) value`;
    return r.value as Operations;
  });
  return { filters, data: data as Operations };
}
