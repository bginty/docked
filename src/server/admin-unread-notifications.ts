import "server-only";
import { communityNotifications } from "./community-social";
/** Reuse the member's authorized notification projection; unknown is not zero. */
export async function adminUnreadNotifications() {
  try {
    const result = await communityNotifications();
    return result.status === "ready" ? result.unread : null;
  } catch {
    return null;
  }
}
