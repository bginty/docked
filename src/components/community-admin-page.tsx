import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/server/auth";
import { communityModeration } from "@/server/community-social";
import { AppShell } from "./app-shell";
import { AppHeading, CommunityEmpty } from "./community-basics";
import { ModerationPanel, AdminReadPanel } from "./community-admin";
import { communityAdminSections } from "@/core/community-navigation";
export async function CommunityAdminPage({ section }: { section: string }) {
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
  if (!audit && ["analytics", "notifications"].includes(section))
    return (
      <CommunityEmpty title="Additional permission required">
        Return to reports for moderation.
      </CommunityEmpty>
    );
  const moderation = ["overview", "reports", "integrity"].includes(section)
    ? await communityModeration()
    : null;
  return (
    <AppShell authenticated>
      <AppHeading
        eyebrow="FANTASY COMMUNITY"
        title={communityAdminSections.find(([id]) => id === section)![1]}
      />
      <nav aria-label="Community operations">
        {communityAdminSections
          .filter(
            ([id]) => audit || !["analytics", "notifications"].includes(id),
          )
          .map(([id, label]) => (
            <p key={id}>
              <Link href={"/admin/community/" + id}>{label}</Link>
            </p>
          ))}
      </nav>
      {moderation &&
        (moderation.status === "ready" ? (
          <ModerationPanel
            data={moderation}
            canWrite={staff.role !== "auditor"}
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
