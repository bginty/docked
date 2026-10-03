import Link from "next/link";
import { publicTips, serviceStatus } from "@/server/queries";
import { listCommunityEdges } from "@/server/community-edges";
import { AppShell } from "./app-shell";
import {
  CommunityEmpty,
  IntegrityNote,
  OfficialBadge,
} from "./community-basics";
import { EdgeBoardHeader, edgeBoardHref } from "./edge-board-header";
import { EdgeCard } from "./edge-card";
import { CommunityEdgeCard } from "./community-performance";
import { PinnedDocked } from "./pinned-docked";
import { communityRecognition } from "@/server/community-recognition";
import { monitoredMarkets } from "@/server/market-data";
import { TrendingEdges, WeeklyEdge, MonitoredFixtures, RecentEdgeResults } from "./edge-discovery";
import { BetaReading } from "./beta-reading";

export async function AppEdgeBoard({
  query,
  timezone,
  format,
}: {
  query: Record<string, string | undefined>;
  timezone: string;
  format: "decimal" | "fractional" | "american";
}) {
  const tab = ["community", "following", "settled"].includes(query.tab ?? "")
    ? query.tab!
    : "docked";
  const view =
    tab === "settled" || query.view === "recent"
      ? "recent"
      : query.view === "upcoming"
        ? "upcoming"
        : "featured";
  const href = (change: Record<string, string>) =>
    edgeBoardHref(query, tab, view, change);
  const [official, community, status, recognition, monitored, weekend, completed] = await Promise.all([
    publicTips(),
    tab !== "docked"
      ? listCommunityEdges({
          sport: query.sport,
          competition: query.competition,
          following: tab === "following",
          settled: tab === "settled",
          before: query.cursor,
        })
      : Promise.resolve(null),
    serviceStatus(),
    tab === "docked" ? communityRecognition() : Promise.resolve(null),
    tab === "docked" ? monitoredMarkets({ window: view === "upcoming" ? "upcoming" : "today", limit: 5 }) : Promise.resolve(null),
    tab === "docked" && view === "featured" ? monitoredMarkets({ window: "weekend", limit: 3 }) : Promise.resolve(null),
    tab === "docked" ? listCommunityEdges({ settled: true, limit: 10 }) : Promise.resolve(null),
  ]);
  const communityEdges = (community?.edges ?? []).filter(
    (edge) =>
      view === "recent" ||
      (edge.result === "PENDING" && Date.parse(edge.startAt) > Date.now()),
  );
  if (view === "upcoming")
    communityEdges.sort(
      (a, b) => Date.parse(a.startAt) - Date.parse(b.startAt),
    );
  const settledOfficial = official.filter(
    (t) =>
      t.display_status === "settled" &&
      (!query.competition || query.competition === t.competition_id) &&
      (!query.sport ||
        query.sport ===
          (t.market_rules.market.startsWith("nba_")
            ? "basketball"
            : t.market_rules.market.startsWith("football_")
              ? "football"
              : t.market_rules.market)),
  );
  return (
    <AppShell authenticated>
      <div className="mobile-edge-board">
        <EdgeBoardHeader query={query} tab={tab} view={view} status={status} />
        {view !== "featured" && <p className="form-help">
          {view === "upcoming"
              ? "Published records for future events, ordered by start time within this page. A record is not a new recommendation."
              : "Recent records include every outcome, including losses and reviews."}
        </p>}
        {tab === "docked" ? (
          <><PinnedDocked
            timezone={timezone}
            format={format}
            compact
            view={view}
            sport={query.sport}
            competition={query.competition}
            showReading={false}
          />
          {view !== "recent" && recognition && <TrendingEdges data={recognition} />}
          {view !== "recent" && monitored && <MonitoredFixtures data={monitored} />}
          {weekend && <MonitoredFixtures data={weekend} weekend />}
          {recognition && <WeeklyEdge data={recognition} />}
          <RecentEdgeResults official={official} community={completed?.edges ?? []} />
          <BetaReading />
          </>
        ) : (
          <>
            {!!settledOfficial.length && (
              <section>
                <h2>Official Docked history</h2>
                <OfficialBadge />
                <div className="app-feed">
                  {settledOfficial.map((t) => (
                    <EdgeCard
                      key={t.id}
                      tip={t}
                      timezone={timezone}
                      format={format}
                      compact
                    />
                  ))}
                </div>
              </section>
            )}
            <h2 className="app-section-title">
              {tab === "settled" ? "Community outcomes" : "Community Edges"}
            </h2>
            {communityEdges.length ? (
              <div className="app-feed">
                {communityEdges.map((edge) => (
                  <CommunityEdgeCard key={edge.id} edge={edge} compact />
                ))}
              </div>
            ) : (
              <CommunityEmpty title="No records match this view">
                {community?.message ||
                  "No eligible records are available on this page. Recent includes all outcomes; no opportunities are invented."}
              </CommunityEmpty>
            )}
            {community?.nextCursor && (
              <Link
                className="button ghost"
                href={href({ cursor: community.nextCursor })}
              >
                Older records
              </Link>
            )}
          </>
        )}
        <IntegrityNote />
      </div>
    </AppShell>
  );
}
