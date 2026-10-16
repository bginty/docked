import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth";
import { adminSearch } from "@/server/admin-search";
import {
  adminRoles,
  adminNavigation,
  canAccessAdminSection,
  type AdminSearchResponse,
  type AdminSection,
} from "@/core/admin-navigation";
import { adminWorkspaces } from "@/core/admin-workspaces";
import { AdminAnnouncementDraft } from "@/components/admin-announcement-draft";
import { AdminShell } from "@/components/admin-shell";
import { adminDisplayName } from "@/server/admin-display-name";
import { adminUnreadNotifications } from "@/server/admin-unread-notifications";
import { AppAuthShell } from "@/components/app-auth-shell";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Docked administrative workspace",
  robots: { index: false, follow: false },
};
export default async function AdminWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section } = await params;
  const item = adminNavigation.find((item) => item.id === section);
  if (!item || section === "dashboard") notFound();
  let who;
  try {
    who = await requireRole([...adminRoles]);
  } catch {
    return (
      <AppAuthShell>
        <h1>Verified staff access required</h1>
        <p>Assigned permissions and MFA are required.</p>
        <Link href="/app/login">Sign in</Link>
      </AppAuthShell>
    );
  }
  if (!canAccessAdminSection(who.role, section))
    return (
      <AppAuthShell>
        <h1>Additional permission required</h1>
        <p>This workspace is not available to your assigned role.</p>
        <Link href="/admin">Back to staff portal</Link>
      </AppAuthShell>
    );
  const workspace =
    adminWorkspaces[section as Exclude<AdminSection, "dashboard">];
  const query = await searchParams;
  const q =
    typeof query.record === "string"
      ? query.record
      : typeof query.q === "string"
        ? query.q
        : "";
  const page = typeof query.page === "string" ? query.page : "1";
  let search: AdminSearchResponse | null = null;
  let problem = "";
  if (workspace.category && q.trim().length >= 2) {
    try {
      search = await adminSearch({ q, page, category: workspace.category });
    } catch {
      problem =
        "Records are unavailable. Check your permissions and try again.";
    }
  }
  const [displayName, unreadCount] = await Promise.all([adminDisplayName(who), adminUnreadNotifications()]);
  return (
    <AdminShell
      role={who.role}
      displayName={displayName}
      unreadCount={unreadCount}
      active={item.id}
    >
      <section className="admin-workspace owner-command-page">
        <p className="eyebrow">DOCKED OPERATIONS · {who.role}</p>
        <h1>{item.label}</h1>
        <p>{workspace.description}</p>
        <nav className="actions" aria-label={`${item.label} tools`}>
          {workspace.actions
            .filter(
              (action) =>
                !action.roles ||
                action.roles.includes(who.role as (typeof adminRoles)[number]),
            )
            .map((action) => (
              <Link
                key={action.href}
                className="button ghost"
                href={action.href}
              >
                {action.label}
              </Link>
            ))}
        </nav>
        {workspace.category && (
          <section className="admin-workspace-panel">
            <h2>Find records</h2>
            <form className="admin-workspace-search" method="get">
              <label>
                Search by name or record ID
                <input
                  name="q"
                  minLength={2}
                  maxLength={120}
                  defaultValue={q}
                  required
                />
              </label>
              <button className="button" type="submit">
                Search
              </button>
            </form>
            {problem && <p role="alert">{problem}</p>}
            {search && (
              <>
                <p>
                  {search.results.length
                    ? `Page ${search.page}`
                    : "No matching records."}
                </p>
                <ul className="admin-records">
                  {search.results.map((record) => (
                    <li key={`${record.category}:${record.id}`}>
                      <strong>{record.title}</strong>
                      <span>{record.detail}</span>
                      <small>Record: {record.id}</small>
                    </li>
                  ))}
                </ul>
                <nav className="actions" aria-label="Record pages">
                  {search.page > 1 && (
                    <Link
                      className="button ghost"
                      href={`?q=${encodeURIComponent(q)}&page=${search.page - 1}`}
                    >
                      Previous
                    </Link>
                  )}
                  {search.hasMore && (
                    <Link
                      className="button ghost"
                      href={`?q=${encodeURIComponent(q)}&page=${search.page + 1}`}
                    >
                      Next
                    </Link>
                  )}
                </nav>
              </>
            )}
          </section>
        )}
        {section === "communications" && who.role !== "auditor" && (
          <AdminAnnouncementDraft />
        )}
        <section className="admin-workspace-panel">
          <h2>Access & activation</h2>
          {workspace.restrictions.map((restriction) => (
            <p key={restriction}>{restriction}</p>
          ))}
        </section>
        <Link
          className="button ghost"
          href={who.role === "owner" ? "/admin/operations" : "/admin"}
        >
          Back to dashboard
        </Link>
      </section>
    </AdminShell>
  );
}
