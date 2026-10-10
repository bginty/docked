import { ownerOperations } from "@/server/owner-operations";
import { requireRole } from "@/server/auth";
import { AppShell } from "@/components/app-shell";
import { OwnerDashboard } from "@/components/owner-dashboard";
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
  try {
    await requireRole(["owner"]);
  } catch {
    notFound();
  }
  const query = await searchParams;
  try {
    const { filters, data } = await ownerOperations(query);
    const params = new URLSearchParams({
      start: filters.start,
      end: filters.end,
      sport: filters.sport,
      scope: filters.scope,
      staff: filters.staff,
    });
    return (
      <AppShell authenticated>
        <section className="scoring-review">
          <h1>Owner dashboard</h1>
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
                <option value="afl">AFL</option>
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
            <button className="button">Apply filters</button>
          </form>
          <p>
            <a href={`/api/admin/operations?${params}&format=csv`}>
              Download inventory CSV
            </a>{" "}
            · <a href="/fantasy/profile">Back to Profile</a>
          </p>
          <OwnerDashboard data={data} />
        </section>
      </AppShell>
    );
  } catch {
    return (
      <AppShell authenticated>
        <h1>Report unavailable</h1>
        <p>
          Check the date range and try again. No cached or estimated totals are
          shown.
        </p>
        <a href="/admin/operations">Reset report filters</a>
      </AppShell>
    );
  }
}
