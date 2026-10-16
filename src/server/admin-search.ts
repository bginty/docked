import "server-only";
import {
  adminRoles,
  adminSearchInput,
  searchDestination,
  type AdminSearchResponse,
  type AdminSearchCategory,
} from "../core/admin-navigation";
import { requireRole } from "./auth";
import { db, rateLimit } from "./db";

export async function adminSearch(
  input: Record<string, string | undefined>,
): Promise<AdminSearchResponse> {
  // Includes verified user, current live session, admission, enabled account,
  // AAL2 and current database role. Never accepts an actor from the request.
  const actor = await requireRole([...adminRoles]);
  const parsed = adminSearchInput(input, actor.role);
  const response: AdminSearchResponse = {
    query: parsed.query,
    page: parsed.page,
    pageSize: parsed.pageSize,
    hasMore: false,
    results: [],
    categories: parsed.permitted,
  };
  if (parsed.query.length < 2) return response;
  if (process.env.DOCKED_BETA_STAGING !== "true")
    throw Error("Search source unavailable");
  if (!(await rateLimit(`admin-search:${actor.user.id}`, 40, 60)))
    throw Error("Search rate limit");
  const rows = await db().begin(async (tx) => {
    // Admission checks take FOR SHARE locks; SQL READ ONLY would reject them.
    // Read branches still call only permission-scoped reporting projections.
    await tx`set local statement_timeout='4000ms'`;
    await tx`select set_config('request.jwt.claim.sub',${actor.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: actor.user.id, session_id: actor.sessionId, aal: actor.aal })},true)`;
    // Recheck current role in the transaction; revocation between authentication
    // and this read cannot widen the allowed category projection.
    const current =
      await tx`select role from private.roles where user_id=${actor.user.id}`;
    if (current[0]?.role !== actor.role) throw Error("Role denied");
    const records =
      await tx`select private.admin_search(${parsed.query},${input.category ?? "all"},${parsed.page}) records`;
    return records[0].records as {
      id: string;
      category: AdminSearchCategory;
      title: string;
      detail: string;
    }[];
  });
  response.hasMore = rows.length > parsed.pageSize;
  response.results = rows.slice(0, parsed.pageSize).map((row) => {
    const category = row.category as AdminSearchCategory;
    return {
      id: String(row.id),
      category,
      title: String(row.title),
      detail: String(row.detail),
      href: searchDestination(category, String(row.id)),
    };
  });
  return response;
}
