// Explicit isolated DEMO. Never imported by any application route, API or provider.
import { createRoot } from "react-dom/client";
import { AppShell } from "../../src/components/app-shell";
import { EdgeBoardHeader } from "../../src/components/edge-board-header";
import { PinnedDockedEmpty } from "../../src/components/pinned-docked-empty";
import {
  TrendingEdges,
  WeeklyEdge,
  MonitoredFixtures,
  RecentEdgeResults,
} from "../../src/components/edge-discovery";
import {
  ManualCandidateForm,
  CandidateReview,
  ScannerScheduleForm,
} from "../../src/components/scanner-controls";
import type { CommunityRecognition } from "../../src/server/community-recognition";
import type { ScannerCandidate } from "../../src/core/edge-scanner";
const item = {
  edge: {
    id: "11111111-1111-4111-8111-111111111111",
    profileId: "demo-author",
    handle: "demo_member",
    displayName: "DEMO Member",
    event: "DEMO Harbour v DEMO City",
    sport: "football",
    competition: "DEMO competition",
    market: "Full-time result",
    selection: "DEMO Harbour",
    submittedAt: "2026-10-05T10:00:00Z",
    startAt: "2026-10-05T18:00:00Z",
    odds: "2.50",
    result: "PENDING" as const,
    settledAt: null,
  },
  uniqueMembers: 3,
  uniqueReactions: 3,
  uniqueCommenters: 1,
  score: 15,
  netUnits: null,
};
const data: CommunityRecognition = {
  status: "READY",
  message: "DEMO fixtures only. No real records.",
  asOf: "2026-10-05T12:00:00Z",
  ruleVersion: "community-recognition-v1",
  trending: [item],
  weekly: {
    start: "2026-09-28T00:00:00Z",
    end: "2026-10-05T00:00:00Z",
    status: "PUBLISHED",
    winner: {
      ...item,
      edge: {
        ...item.edge,
        result: "WON",
        settledAt: "2026-10-01T21:00:00Z",
        startAt: "2026-10-01T18:00:00Z",
      },
      netUnits: "1.5000",
    },
    snapshotId: "demo-only",
  },
};
const candidate: ScannerCandidate = {
  id: item.edge.id,
  purpose: "research",
  status: "NEEDS_REVIEW",
  sport: "football",
  competition: "DEMO",
  event: item.edge.event,
  eventId: "demo-event",
  market: "football_1x2",
  marketId: "demo-market",
  selection: "DEMO Harbour",
  probability: "0.45",
  fairOdds: "2.2222",
  minimumOdds: "2.40",
  requiredEV: "0.08",
  currentMarketReference: "2.50",
  estimatedEV: "0.125",
  sourceCount: 3,
  dataAgeSeconds: 20,
  strategyVersion: "DEMO-unvalidated",
  modelVersion: "DEMO",
  scannedAt: data.asOf,
  startAt: item.edge.startAt,
  expiresAt: "2026-10-05T12:02:00Z",
  warnings: ["DEMO only"],
  publicationId: null,
};
const root = createRoot(document.getElementById("demo-root")!);
Object.assign(window, {
  renderPhase5Fixture(view: string) {
    const empty = view === "empty";
    const state = empty
      ? {
          ...data,
          status: "NOT_CONFIGURED" as const,
          trending: [],
          weekly: {
            ...data.weekly,
            status: "UNAVAILABLE" as const,
            winner: null,
            snapshotId: null,
          },
        }
      : data;
    root.render(
      <>
        <p className="demo-label">
          ISOLATED DEMO · fictional interface fixtures · no account, provider or
          performance records
        </p>
        <AppShell authenticated>
          {view === "admin" ? (
            <>
              <h1>DEMO scanner controls</h1>
              <ManualCandidateForm />
              <CandidateReview candidate={candidate} />
              <ScannerScheduleForm />
            </>
          ) : (
            <div className="mobile-edge-board">
              <EdgeBoardHeader
                query={{}}
                tab="docked"
                view="featured"
                status={{ strategy: false, feed: false, publication: false }}
              />
              <section className="pinned-docked">
                <div className="section-row">
                  <h2>DOCKED EDGES</h2>
                  <a href="/results">Official history</a>
                </div>
                <PinnedDockedEmpty
                  compact
                  regionAllowed
                  feedReady={false}
                  view="featured"
                />
              </section>
              <TrendingEdges data={state} />
              <MonitoredFixtures
                weekend
                data={{
                  status: empty ? "NOT_CONFIGURED" : "READY",
                  message: "DEMO provider is not a configured service.",
                  observedAt: empty ? null : data.asOf,
                  provider: empty ? null : "DEMO ONLY",
                  window: "weekend",
                  from: "2026-10-10T00:00:00Z",
                  to: "2026-10-12T00:00:00Z",
                  timezone: "UTC",
                  events: empty
                    ? []
                    : [
                        {
                          eventId: "demo-only",
                          eventLabel: item.edge.event,
                          sport: "football",
                          competition: "DEMO competition",
                          startAt: "2026-10-10T18:00:00Z",
                          status: "scheduled",
                          markets: [
                            {
                              marketId: "demo-only",
                              label: "DEMO Harbour · Full-time result",
                              referencePrice: "2.50",
                              sourceAt: data.asOf,
                              observedAt: data.asOf,
                              freshness: "STALE",
                              standardStatus: "STANDARD_VERIFIED",
                            },
                            {
                              marketId: "demo-only",
                              label: "DEMO City · Full-time result",
                              referencePrice: null,
                              sourceAt: null,
                              observedAt: null,
                              freshness: "UNKNOWN",
                              standardStatus: "UNKNOWN_REVIEW",
                            },
                          ],
                        },
                      ],
                }}
              />
              <WeeklyEdge data={state} />
              <RecentEdgeResults official={[]} community={[]} />
            </div>
          )}
        </AppShell>
      </>,
    );
  },
});
