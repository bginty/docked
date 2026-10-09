// Isolated interactive UI fixtures only. Never imported by application routes,
// provider ingestion, the official ledger, community storage or rankings.
import { createRoot } from "react-dom/client";
import { AppShell } from "../../src/components/app-shell";
import {
  FollowingContent,
  PointsContent,
  MyEdgeContent,
} from "../../src/components/app-member-ui";
import { EdgeBoardHeader } from "../../src/components/edge-board-header";
import { FeedTabs, FeedContent } from "../../src/components/community-feed";
import { PinnedDockedEmpty } from "../../src/components/pinned-docked-empty";
import { topDockedRuleV1 } from "../../src/core/top-docked";
import {
  AppHeading,
  OfficialBadge,
} from "../../src/components/community-basics";
import { SocialComposer } from "../../src/components/social-composer";
import {
  SocialCard,
  ProfileActions,
  ProfileEditor,
} from "../../src/components/social-interactions";
import {
  CommunityEdgeCard,
  PerformanceMetrics,
  PerformanceChart,
  LeaderboardTable,
} from "../../src/components/community-performance";
import { NotificationCentre } from "../../src/components/notification-centre";
import {
  ModerationPanel,
  DisabledBenefitsDraft,
} from "../../src/components/community-admin";
import { CommunityIntegrityControls } from "../../src/components/community-integrity-controls";
import { CommunityShare } from "../../src/components/community-share";
import {
  communityPerformance,
  calculateTopDocked,
  type CanonicalCommunityRecord,
} from "../../src/core/top-docked";
import {
  permanentEdgeStatement,
  type CommunityEdge,
  type CommunityReview,
} from "../../src/core/community-edge";
import type {
  SocialProfile,
  SocialPost,
} from "../../src/core/community-social";
const now = new Date(),
  start = new Date(now.getTime() + 7200000),
  source = new Date(now.getTime() - 30000);
export const demoProfile: SocialProfile = {
  id: "11111111-1111-4111-8111-111111111111",
  handle: "demo_member",
  displayName: "DEMO Member",
  bio: "Fictional UI fixture. No actual sporting performance.",
  avatarUrl: null,
  isOfficial: false,
  visibility: "members",
  status: "active",
  joinedAt: "2026-09-01T00:00:00Z",
  followers: 0,
  following: 0,
  isFollowing: false,
  isMuted: false,
  isBlocked: false,
  isOwn: false,
};
// Presentation stress cases only: no seeded users, relationships or performance.
const demoSuggestedProfiles: SocialProfile[] = [
  {
    ...demoProfile,
    id: "11111111-1111-4111-8111-111111111112",
    handle: "demo_official",
    displayName: "DEMO Docked Official",
    isOfficial: true,
  },
  {
    ...demoProfile,
    id: "11111111-1111-4111-8111-111111111113",
    handle: "demo_long_member",
    displayName: "DEMO Alexandria Montgomery Sports Perspective",
  },
];
export const demoReview: CommunityReview = {
  snapshotId: "demo-snapshot",
  marketId: "football_1x2",
  marketLabel: "Full-time result · regulation only",
  sport: "football",
  competition: "DEMO league",
  eventId: "demo-event",
  eventLabel: "DEMO Team A vs DEMO Team B",
  startAt: start.toISOString(),
  selection: "DEMO Team A",
  bookmaker: "DEMO Book",
  odds: "2.10",
  sourceAt: source.toISOString(),
  receivedAt: now.toISOString(),
  cutoffAt: new Date(start.getTime() - 600000).toISOString(),
  classification: "STANDARD_VERIFIED",
  ruleVersion: "DEMO-community-standard-v1",
  reviewToken: "a".repeat(64),
  permanentStatement: permanentEdgeStatement,
};
export const demoEdge: CommunityEdge = {
  ...demoReview,
  id: "22222222-2222-4222-8222-222222222222",
  profileId: demoProfile.id,
  handle: demoProfile.handle,
  displayName: demoProfile.displayName,
  submittedAt: now.toISOString(),
  units: "1.00",
  result: "PENDING",
  settledAt: null,
  corrections: 0,
  integrity: "CLEAR",
  interactionsAllowed: true,
};
export const demoPost: SocialPost = {
  id: "33333333-3333-4333-8333-333333333333",
  author: demoProfile,
  kind: "analysis",
  body: "DEMO discussion: the regulation-time rules matter. This is fictional content used only to check the interface.",
  sport: "football",
  createdAt: now.toISOString(),
  moderationStatus: "visible",
  claimLabel: "social_only",
  officialTipId: null,
  communityEdgeId: null,
  media: [],
  reactionCount: 0,
  commentCount: 0,
  isReacted: false,
  isSaved: false,
  comments: [],
};
const record: CanonicalCommunityRecord = {
  id: demoEdge.id,
  profileId: demoProfile.id,
  submittedAt: "2026-09-01T12:00:00Z",
  startAt: "2026-09-01T14:00:00Z",
  sport: "football",
  odds: "2.10",
  units: "1.00",
  classification: "STANDARD_VERIFIED",
  ruleVersion: "community-standard-v1",
  verified: true,
  demo: false,
  official: false,
  integrityClear: true,
  result: "LOST",
  settledAt: "2026-09-01T16:00:00Z",
  settlementId: "demo-settlement",
};
// Function-only arithmetic fixture; never eligible for any persistence/import.
const performance = communityPerformance([record]);
const ranking = calculateTopDocked([record], {
  period: "all",
  asOf: now.toISOString(),
});
const rows = ranking.rows.map((r) => ({
  ...r,
  handle: demoProfile.handle,
  displayName: demoProfile.displayName,
  interactionsAllowed: true,
}));
const root = createRoot(document.getElementById("demo-root")!);
export function renderDemo(
  view: string,
  profileOverrides?: Partial<SocialProfile>,
) {
  Object.assign(window, {
    demoPath: view.startsWith("mobile-")
      ? `/${view === "mobile-edge-record" ? "edges" : view === "mobile-following-suggestions" ? "following" : view.slice(7)}`
      : view === "compose"
        ? "/compose"
        : view === "profile"
          ? "/profile"
          : view === "leaderboard"
            ? "/top-docked"
            : view === "notifications"
              ? "/notifications"
              : ["audit", "benefits", "moderation"].includes(view)
                ? "/admin/community"
                : "/home",
  });
  const body =
    view === "mobile-points" ? (
      <PointsContent
        month={null}
        lifetime={null}
        board={{
          status: "RESTRICTED",
          message: "DEMO: no authorised leaderboard or performance data.",
          rule: topDockedRuleV1,
          period: "month",
          asOf: now.toISOString(),
          sport: null,
          rows: [],
          availableSports: [],
        }}
      />
    ) : view === "mobile-my-edge" ? (
      <MyEdgeContent
        profile={{ ...demoProfile, ...profileOverrides, isOwn: true }}
        status="ready"
        message=""
        performance={null}
      />
    ) : view === "mobile-following" ||
      view === "mobile-following-suggestions" ? (
      <FollowingContent
        filter="all"
        feed={{
          status: "ready",
          message: "",
          viewer: { ...demoProfile, isOwn: true },
          posts: [],
          profiles: [],
          nextCursor: null,
        }}
        graph={null}
        discovery={{
          profiles:
            view === "mobile-following-suggestions"
              ? demoSuggestedProfiles
              : [],
          nextCursor: null,
          message: "No real members are loaded in this isolated fixture.",
        }}
      />
    ) : view === "mobile-feed" ? (
      <div className="feed-screen">
        <AppHeading eyebrow="FEED" title="Your sporting perspective." />
        <FeedTabs
          base="/feed"
          compact
          action={
            <a className="button feed-compose-link" href="/compose">
              Write post
            </a>
          }
        />
        <FeedContent
          base="/feed"
          tab="for_you"
          compact
          feed={{
            status: "ready",
            message: "",
            viewer: demoProfile,
            posts: (window as any).demoTimelinePosts ?? [
              demoPost,
              {
                ...demoPost,
                id: "33333333-3333-4333-8333-333333333334",
                body: "DEMO long-content check. Regulation and overtime settlement rules remain part of the permanent record. ".repeat(
                  3,
                ),
              },
            ],
            profiles: [],
            nextCursor: "fixture-cursor",
          }}
        />
      </div>
    ) : view === "mobile-edges" || view === "mobile-edge-record" ? (
      <div className="mobile-edge-board">
        <EdgeBoardHeader
          query={{}}
          tab="docked"
          view="featured"
          status={{ strategy: false, feed: false, publication: false }}
        />
        {view === "mobile-edge-record" ? (
          <div
            dangerouslySetInnerHTML={{
              __html: (window as any).demoCompactHtml,
            }}
          />
        ) : (
          <PinnedDockedEmpty compact regionAllowed={false} feedReady={false} />
        )}
      </div>
    ) : view === "compose" ||
      view === "mobile-compose" ||
      view === "mobile-preview-edge" ? (
      <>
        <AppHeading eyebrow="DEMO COMPOSER" title="Share a perspective." />
        <SocialComposer previewFixtures={view === "mobile-preview-edge"} />
      </>
    ) : view === "profile" ? (
      <>
        <AppHeading eyebrow="DEMO PROFILE" title={demoProfile.displayName} />
        <ProfileActions profile={{ ...demoProfile, ...profileOverrides }} />
        <PerformanceMetrics performance={performance} />
        <PerformanceChart performance={performance} />
        <CommunityEdgeCard
          edge={{ ...demoEdge, result: "LOST", settledAt: record.settledAt }}
        />
        <CommunityShare id={demoEdge.id} />
        <ProfileEditor profile={{ ...demoProfile, isOwn: true }} />
      </>
    ) : view === "leaderboard" ? (
      <>
        <AppHeading
          eyebrow="DEMO TOP DOCKED"
          title="The record earns the rank."
        />
        <LeaderboardTable rows={rows} />
        <p>
          PROVISIONAL: no rank with a tiny sample. These are fictional
          arithmetic fixtures.
        </p>
      </>
    ) : view === "notifications" ? (
      <>
        <AppHeading eyebrow="DEMO NOTIFICATIONS" title="Your notifications" />
        <NotificationCentre
          data={{
            status: "ready",
            message: "",
            viewer: demoProfile,
            items: [
              {
                id: "44444444-4444-4444-8444-444444444444",
                type: "account",
                title: "DEMO system notice",
                href: "/profile",
                createdAt: now.toISOString(),
                readAt: null,
                groupKey: "account",
              },
            ],
            unread: 1,
            preferences: null,
          }}
        />
      </>
    ) : view === "benefits" ? (
      <>
        <AppHeading
          eyebrow="DEMO DISABLED COMMERCIAL DRAFT"
          title="Future deal configuration"
        />
        <DisabledBenefitsDraft kind="deal" />
      </>
    ) : view === "audit" ? (
      <>
        <AppHeading eyebrow="DEMO LEDGER AUDIT" title="Audited rankings" />
        <CommunityIntegrityControls snapshot />
      </>
    ) : view === "moderation" ? (
      <>
        <AppHeading eyebrow="DEMO STAFF UI" title="Reports & moderation" />
        <ModerationPanel
          canWrite
          data={{
            status: "ready",
            message: "",
            reports: [
              {
                id: "55555555-5555-4555-8555-555555555555",
                targetType: "post",
                targetId: demoPost.id,
                reason: "privacy",
                details:
                  "DEMO report: a fictional image may contain an account identifier.",
                status: "open",
                createdAt: now.toISOString(),
              },
            ],
            media: [],
          }}
        />
      </>
    ) : (
      <>
        <AppHeading eyebrow="DEMO HOME" title="Sport. Perspective. Evidence." />
        <section className="pinned-docked">
          <h2>DOCKED EDGES</h2>
          <OfficialBadge />
          {/* Actual server EdgeCard markup from the separate authored fixture renderer. */}
          <div
            className="pinned-track"
            dangerouslySetInnerHTML={{
              __html: (window as any).demoOfficialHtml,
            }}
          />
        </section>
        <h2>Community discussion</h2>
        <SocialCard post={demoPost} />
        <CommunityEdgeCard edge={demoEdge} />
        <h2>Top Docked · DEMO provisional state</h2>
        <LeaderboardTable rows={rows} />
      </>
    );
  root.render(
    <>
      <div className="demo-label" role="note">
        DEMO · ISOLATED FICTIONAL UI · NO AUTHENTICATED SESSION · NO REAL DATA
      </div>
      <AppShell authenticated>{body}</AppShell>
    </>,
  );
}
Object.assign(window, { renderDemo, demoReview, demoEdge, demoPost });
renderDemo("home");
