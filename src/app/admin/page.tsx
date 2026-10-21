import Link from "next/link";
import { requireRole } from "@/server/auth";
import { AppAuthShell } from "@/components/app-auth-shell";
import { AdminShell } from "@/components/admin-shell";
import { adminDisplayName } from "@/server/admin-display-name";
import { adminUnreadNotifications } from "@/server/admin-unread-notifications";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Fantasy operations",
  robots: { index: false, follow: false },
};
export default async function Admin() {
  let who;
  try {
    who = await requireRole(["owner", "admin", "analyst", "editor", "auditor"]);
  } catch {
    return (
      <AppAuthShell>
        <h1>Verified staff access required</h1>
        <p>Assigned permissions and MFA are required.</p>
        <Link href="/app/login">Sign in</Link>
      </AppAuthShell>
    );
  }
  const [displayName, unreadCount] = await Promise.all([
    adminDisplayName(who),
    adminUnreadNotifications(),
  ]);
  return (
    <AdminShell
      role={who.role}
      displayName={displayName}
      unreadCount={unreadCount}
    >
      <section className="scoring-review owner-command-page">
        <p className="eyebrow">RESTRICTED OPERATIONS</p>
        <h1>Staff portal</h1>
        <p>Signed in with the {who.role} role · Verified MFA</p>
        <nav className="command-workspaces" aria-label="Operations">
          {["owner","admin"].includes(who.role) && <Link href="/admin/coupons"><strong>Pack coupons</strong><span>Draft, review and manage pack discounts</span></Link>}
          {who.role === "owner" && (
            <Link href="/admin/operations">
              <strong>Owner Command Centre</strong>
              <span>Business oversight and operational exceptions</span>
            </Link>
          )}
          <Link href="/fantasy/admin">
            <strong>Cards & competitions</strong>
            <span>Review catalogue, schedules and existing operations</span>
          </Link>
          {who.role !== "analyst" && (
            <Link href="/admin/community">
              <strong>Community moderation</strong>
              <span>Reports, member safety and audit history</span>
            </Link>
          )}
          {["owner", "admin", "auditor"].includes(who.role) && (
            <Link href="/admin/analytics">
              <strong>Acquisition & retention</strong>
              <span>Consent-based measurements and definitions</span>
            </Link>
          )}
        </nav>
        <p>
          Each workspace enforces its own permissions. Gameplay activation
          remains separately gated.
        </p>
      </section>
    </AdminShell>
  );
}
