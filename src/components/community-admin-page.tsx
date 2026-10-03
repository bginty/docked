import Link from "next/link";
import { requireRole } from "@/server/auth";
import { communityModeration } from "@/server/community-social";
import { AppHeading, CommunityEmpty } from "./community-basics";
import { AppShell } from "./app-shell";
import {
  ModerationPanel,
  AdminReadPanel,
  DisabledBenefitsDraft,
} from "./community-admin";
import { communityAdminSections } from "@/core/community-navigation";
import { topDockedRuleV1 } from "@/core/top-docked";
import { CommunityIntegrityControls } from "./community-integrity-controls";
export async function CommunityAdminPage({ section }: { section: string }) {
  let staff;
  try {
    staff = await requireRole(["owner", "admin", "auditor", "editor"]);
  } catch {
    return (
      <div className="community-public">
        <AppHeading
          eyebrow="COMMUNITY OPERATIONS"
          title="Verified staff access required."
        />
        <CommunityEmpty title="Staff role and MFA required">
          Reports, identity reviews, provider payloads and audit records are
          private. No operational data are available through this public
          interface.
        </CommunityEmpty>
        <Link className="button" href="/login">
          Sign in
        </Link>
      </div>
    );
  }
  const canWrite = staff.role === "owner" || staff.role === "admin";
  const canModerate = canWrite || staff.role === "editor";
  const canReadAudit = canWrite || staff.role === "auditor";
  const editorSections = [
    "overview",
    "reports",
    "integrity",
    "rules",
    "notifications",
  ];
  if (!canReadAudit && !editorSections.includes(section))
    return (
      <AppShell authenticated>
        <AppHeading
          eyebrow="RESTRICTED OPERATIONS"
          title="Additional staff permissions required."
        />
        <CommunityEmpty title="This section is not available to your role">
          Return to community reports for your permitted moderation controls.
        </CommunityEmpty>
        <Link className="button" href="/admin/community/reports">
          Reports & moderation
        </Link>
      </AppShell>
    );
  const title =
    communityAdminSections.find(([id]) => id === section)?.[1] ??
    "Community overview";
  const moderation = ["reports", "integrity", "overview"].includes(section)
    ? await communityModeration()
    : null;
  return (
    <AppShell authenticated>
      <AppHeading eyebrow="RESTRICTED OPERATIONS" title={title}>
        Audited operations. Community moderation never rewrites the performance
        ledger.
      </AppHeading>
      <nav className="moderation-nav" aria-label="Community operations">
        {communityAdminSections
          .filter(([id]) => canReadAudit || editorSections.includes(id))
          .map(([id, label]) => (
            <Link
              key={id}
              href={`/admin/community/${id}`}
              aria-current={section === id ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        <Link href="/admin">Official operations</Link>
      </nav>
      {moderation &&
        (moderation.status === "ready" ? (
          <ModerationPanel data={moderation} canWrite={canModerate} />
        ) : (
          <CommunityEmpty title="Moderation data unavailable">
            {moderation.message}
          </CommunityEmpty>
        ))}
      {canReadAudit && ["overview", "analytics"].includes(section) && (
        <AdminReadPanel
          endpoint="/api/admin/community-analytics"
          title="Observed social activity"
        />
      )}
      {section === "rules" && (
        <section className="app-panel">
          <h2>Installed immutable ranking rule</h2>
          <pre className="audit-json" tabIndex={0}>
            {JSON.stringify(topDockedRuleV1, null, 2)}
          </pre>
          <p>
            Changing the rule requires a new reviewed version and reproducible
            recalculation. This screen cannot grant rank or performance badges.
          </p>
        </section>
      )}
      {["competitions", "deals", "prizes", "membership"].includes(section) && (
        <>
          <AdminReadPanel
            endpoint="/api/admin/benefits"
            title="Disabled commercial configuration"
          />
          {canWrite && (section === "competitions" || section === "deals") && (
            <DisabledBenefitsDraft
              kind={section === "competitions" ? "competition" : "deal"}
            />
          )}
          <p className="app-state-banner">
            Billing, Pro, competitions, prizes, deals and affiliates remain OFF.
            No activation or award control is offered.
          </p>
        </>
      )}
      {["verification", "promotions", "leaderboard-audit"].includes(
        section,
      ) && (
        <AdminReadPanel
          endpoint={`/api/admin/community-edges?view=${section}`}
          title={title}
        />
      )}{" "}
      {section === "notifications" && (
        <section className="app-panel">
          <h2>In-app only</h2>
          <p>
            Member category preferences, consent, quiet hours and caps control
            optional delivery. External email and push are disabled.
            Account/system notices remain distinct.
          </p>
          <Link className="text-link" href="/admin">
            Existing outbox and worker operations
          </Link>
          {canReadAudit && (
            <AdminReadPanel
              endpoint="/api/admin/community-analytics?view=notifications"
              title="In-app queue and delivery observations"
            />
          )}
        </section>
      )}
      {canWrite &&
        ["verification", "promotions", "leaderboard-audit"].includes(
          section,
        ) && (
          <CommunityIntegrityControls
            snapshot={section === "leaderboard-audit"}
          />
        )}
    </AppShell>
  );
}
