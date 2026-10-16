import { ownerOperations } from "@/server/owner-operations";
import { requireRole } from "@/server/auth";
import { AdminShell } from "@/components/admin-shell";
import { OwnerDashboard } from "@/components/owner-dashboard";
import { ownerReportPeriod } from "@/core/owner-report-period";
import { adminDisplayName } from "@/server/admin-display-name";
import { adminUnreadNotifications } from "@/server/admin-unread-notifications";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Owner dashboard",
  robots: { index: false, follow: false },
};
export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  let who;
  try {
    who = await requireRole(["owner"]);
  } catch {
    notFound();
  }
  const [displayName, unreadCount] = await Promise.all([
    adminDisplayName(who),
    adminUnreadNotifications(),
  ]);
  const selected = ownerReportPeriod(await searchParams);
  try {
    const { filters, data } = await ownerOperations({
      ...selected.query,
      scope:
        selected.query.scope ??
        (process.env.DOCKED_BETA_STAGING === "true" ? "beta" : "live"),
    });
    const params = new URLSearchParams({
      start: filters.start,
      end: filters.end,
      sport: filters.sport,
      scope: filters.scope,
      staff: filters.staff,
    });
    return (
      <AdminShell
        role={who.role}
        displayName={displayName}
        moderationCount={
          data?.reference
            ? data.reference.moderation.content +
              data.reference.moderation.members
            : 0
        }
        unreadCount={unreadCount}
        build={process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)}
      >
        <OwnerDashboard
          data={data}
          displayName={displayName}
          siteUrl={process.env.SITE_URL ?? "/"}
          period={selected.period}
        />
        <details className="owner-reference-detail">
          <summary>Advanced reporting filters & export</summary>
          <form className="scoring-controls">
            <label>
              From · Sydney
              <input
                type="date"
                name="start"
                defaultValue={filters.start}
                required
              />
            </label>
            <label>
              Through · Sydney
              <input
                type="date"
                name="end"
                defaultValue={filters.end}
                required
              />
            </label>
            <label>
              Sport
              <select name="sport" defaultValue={filters.sport}>
                <option value="all">All sports</option>
                <option value="football">EPL</option>
                <option value="nfl">NFL</option>
              </select>
            </label>
            <label>
              Records
              <select name="scope" defaultValue={filters.scope}>
                <option value="live">Live</option>
                <option value="beta">Beta / test</option>
              </select>
            </label>
            <label>
              Staff activity
              <select name="staff" defaultValue={filters.staff}>
                <option value="false">Exclude owner/admin</option>
                <option value="true">Include owner/admin</option>
              </select>
            </label>
            <button className="admin-control">Apply filters</button>
          </form>
          <a
            className="admin-control"
            href={`/api/admin/operations?${params}&format=csv`}
          >
            Download inventory CSV
          </a>
        </details>
      </AdminShell>
    );
  } catch {
    return (
      <AdminShell role={who.role} displayName={displayName}>
        <section className="scoring-review">
          <h1>Report unavailable</h1>
          <p>
            Check the date range and try again. No cached or estimated totals
            are shown.
          </p>
          <a className="admin-control" href="/admin/operations">
            Reset report filters
          </a>
        </section>
      </AdminShell>
    );
  }
}
