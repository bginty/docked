import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AdminShell } from "../../src/components/admin-shell";
import { OwnerDashboard } from "../../src/components/owner-dashboard";
import { AdminAnnouncementDraft } from "../../src/components/admin-announcement-draft";
import { ModerationPanel } from "../../src/components/community-admin";
import { moderationQueueKind } from "../../src/core/community-social";
import type { Operations } from "../../src/core/owner-operations";

/** Actual presentation components with local synthetic aggregates. Not an auth override. */
Object.assign(window, { demoPath: window.location.pathname });

function Fixture() {
  const announcement =
    window.location.pathname === "/admin/workspace/communications";
  const moderation = window.location.pathname === "/admin/community/reports";
  const kind = moderationQueueKind(
    new URLSearchParams(window.location.search).get("kind") ?? undefined,
  );
  const [state, setState] = useState<{
    data: Operations | null;
    role: string;
  } | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    void fetch("/fixture-state" + window.location.search, {
      signal: abort.signal,
    })
      .then((response) => response.json())
      .then(setState)
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError"))
          throw error;
      });
    return () => abort.abort();
  }, []);
  if (!state) return <p role="status">Loading isolated dashboard fixture…</p>;
  return (
    <AdminShell
      role={state.role}
      displayName="Admin"
      active={
        announcement
          ? "communications"
          : moderation
            ? "moderation"
            : "dashboard"
      }
      moderationCount={state.data?.reports.length ?? 0}
      unreadCount={null}
      build="Isolated UI review"
    >
      {announcement ? (
        <AdminAnnouncementDraft />
      ) : moderation ? (
        <ModerationPanel
          canWrite={false}
          initialKind={kind === "listings" ? undefined : kind}
          data={{
            status: "ready",
            message: "Isolated report fixture",
            media: [],
            reports: [
              {
                id: "fixture-post",
                targetId: "fixture-post",
                targetType: "post",
                reason: "content_case",
                details: "Synthetic content review",
                status: "open",
                createdAt: "2026-10-16T12:00:00Z",
              },
              {
                id: "fixture-profile",
                targetId: "fixture-profile",
                targetType: "profile",
                reason: "member_case",
                details: "Synthetic member review",
                status: "open",
                createdAt: "2026-10-16T12:00:00Z",
              },
              {
                id: "fixture-dismissed",
                targetId: "fixture-comment",
                targetType: "comment",
                reason: "closed_case",
                details: "Synthetic dismissed review",
                status: "dismissed",
                createdAt: "2026-10-16T12:00:00Z",
              },
            ],
          }}
        />
      ) : (
        <OwnerDashboard
          data={state.data}
          displayName="Admin"
          siteUrl="/fantasy/play"
          period={
            new URLSearchParams(window.location.search).get("period") ?? "30"
          }
        />
      )}
    </AdminShell>
  );
}

createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
