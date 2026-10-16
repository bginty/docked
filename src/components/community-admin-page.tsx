import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth";
import { communityModeration } from "@/server/community-social";
import { AppShell } from "./app-shell";
import { AppHeading, CommunityEmpty } from "./community-basics";
import { ModerationPanel, AdminReadPanel } from "./community-admin";
import { communityAdminSections } from "@/core/community-navigation";
import { moderationQueueKind } from "@/core/community-social";
export async function CommunityAdminPage({
  section,
  kind,
}: {
  section: string;
  kind?: string;
}) {
  if (!communityAdminSections.some(([id]) => id === section)) notFound();
  let staff;
  try {
    staff = await requireRole(["owner", "admin", "auditor", "editor"]);
  } catch {
    return (
      <CommunityEmpty title="Verified staff access required">
        Staff role and MFA are required. <Link href="/app/login">Sign in</Link>
      </CommunityEmpty>
    );
  }
  const audit = ["owner", "admin", "auditor"].includes(staff.role);
  const queueKind =
    section === "reports" ? moderationQueueKind(kind) : undefined;
  if (!audit && ["analytics", "notifications"].includes(section))
    return (
      <CommunityEmpty title="Additional permission required">
        Return to reports for moderation.
      </CommunityEmpty>
    );
  const moderation =
    ["overview", "reports", "integrity"].includes(section) &&
    queueKind !== "listings"
      ? await communityModeration(queueKind)
      : null;
  return (
    <AppShell authenticated>
      <AppHeading
        eyebrow="FANTASY COMMUNITY"
        title={communityAdminSections.find(([id]) => id === section)![1]}
      />
      <nav className="actions" aria-label="Community operations">
        {communityAdminSections
          .filter(
            ([id]) => audit || !["analytics", "notifications"].includes(id),
          )
          .map(([id, label]) => (
            <Link
              key={id}
              href={"/admin/community/" + id}
              className={`button ${id === section ? "" : "ghost"}`}
              aria-current={id === section ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
      </nav>
      {queueKind && queueKind !== "listings" && (
        <p className="small-note">
          Showing outstanding {queueKind === "members" ? "member" : "content"}{" "}
          reports.{" "}
          <Link href="/admin/community/reports">
            View all report categories
          </Link>
        </p>
      )}
      {queueKind === "listings" && (
        <CommunityEmpty title="Listing case queue unavailable">
          Marketplace-specific case intake is not configured. Existing social
          reports do not establish a count of listing cases.
          <Link className="button ghost" href="/admin/workspace/marketplace">
            Review marketplace operations
          </Link>
        </CommunityEmpty>
      )}
      {moderation &&
        (moderation.status === "ready" ? (
          <ModerationPanel
            key={queueKind ?? "all"}
            data={moderation}
            canWrite={staff.role !== "auditor"}
            initialKind={queueKind === "listings" ? undefined : queueKind}
          />
        ) : (
          <CommunityEmpty title="Moderation unavailable">
            {moderation.message}
          </CommunityEmpty>
        ))}
      {audit && section === "analytics" && (
        <AdminReadPanel
          endpoint="/api/admin/community-analytics"
          title="Observed social activity"
        />
      )}
      {audit && section === "notifications" && (
        <AdminReadPanel
          endpoint="/api/admin/community-analytics?view=notifications"
          title="In-app notifications"
        />
      )}
    </AppShell>
  );
}
