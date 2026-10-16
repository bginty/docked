import "server-only";
import { adminRoles } from "../core/admin-navigation";
import { db } from "./db";
/** Call only after requireRole. Display identity never comes from account email. */
export async function adminDisplayName(actor: { user: { id: string }; role: string }) {
  if (!(adminRoles as readonly string[]).includes(actor.role)) throw Error("Role denied");
  try {
    const rows = await db()`select display_name from private.social_profiles where user_id=${actor.user.id} and status='active' limit 1`;
    return typeof rows[0]?.display_name === "string" && rows[0].display_name.trim() ? rows[0].display_name.trim() : "Admin";
  } catch { return "Admin"; }
}
