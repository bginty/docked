import Link from "next/link";
import type { RecognizedEdge } from "@/core/community-recognition";
import type { CommunityRecognition } from "@/server/community-recognition";
import type { MonitoredMarkets } from "@/core/market-data";
import type { CommunityEdge } from "@/core/community-edge";
import type { PublicTip } from "@/server/queries";
import { SportIcon } from "./sport-icon";
import { LocalTimestamp } from "./local-timestamp";

function InterestCard({
  item,
  weekly = false,
}: {
  item: RecognizedEdge;
  weekly?: boolean;
}) {
  return (
    <article className="recognition-card">
      <div className="recognition-meta">
        <span>
          <SportIcon sport={item.edge.sport} size={16} /> COMMUNITY EDGE
        </span>
        <span>{weekly ? "SETTLED WIN" : "COMMUNITY INTEREST"}</span>
      </div>
      <Link
        className="recognition-author"
        href={`/profile/${item.edge.handle}`}
      >
        {item.edge.displayName} <span>@{item.edge.handle}</span>
      </Link>
      <p>{item.edge.event}</p>
      <h3>
        <Link href={`/community/edges/${item.edge.id}`}>
          {item.edge.selection}
        </Link>
      </h3>
      <p className="recognition-market">
        {item.edge.market} · {item.edge.competition}
      </p>
      <dl className="recognition-facts">
        <div>
          <dt>Submission market reference</dt>
          <dd>{item.edge.odds}</dd>
        </div>
        <div>
          <dt>{weekly ? "1-unit net result" : "Eligible members"}</dt>
          <dd>{weekly ? `+${item.netUnits}` : item.uniqueMembers}</dd>
        </div>
        <div>
          <dt>Eligible likes</dt>
          <dd>{item.uniqueReactions}</dd>
        </div>
      </dl>
      <p className="recognition-time">
        {weekly ? "Settled" : "Starts"}{" "}
        <LocalTimestamp
          value={(weekly ? item.edge.settledAt : item.edge.startAt)!}
        />
      </p>
      <Link
        className="recognition-record"
        href={`/community/edges/${item.edge.id}`}
      >
        Permanent record & discussion <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}
export function TrendingEdges({ data }: { data: CommunityRecognition }) {
  return (
    <section
      className="edge-discovery-section"
      aria-labelledby="trending-title"
    >
      <div className="section-row">
        <h2 id="trending-title">Trending Community Edges</h2>
        <Link href="/edges?tab=community">All community</Link>
      </div>
      <p className="edge-section-note">
        Eligible member interest, not a performance ranking or a Docked
        recommendation.
      </p>
      {data.trending.length ? (
        <div className="recognition-list">
          {data.trending.slice(0, 3).map((item) => (
            <InterestCard key={item.edge.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="edge-quiet-state">
          <strong>No eligible trending Edges yet.</strong>
          <p>
            {data.status === "READY"
              ? "Verified community records need independent member interest and pass account-age and burst checks before appearing here."
              : data.message}
          </p>
        </div>
      )}
      <details className="edge-rule-disclosure">
        <summary>How trending works</summary>
        <p>
          Up to three eligible Edges. At least three eligible members, seven-day
          account age, unique likes and substantive comments. One member cannot
          inflate the count by repeating an action. Self-interactions, reported
          content and suspicious bursts are excluded. Recency reduces older
          interest. Likes measure interest, not probability or quality. Rule{" "}
          {data.ruleVersion}.
        </p>
        <Link href="/top-docked">
          Top Docked uses settled performance separately
        </Link>
      </details>
    </section>
  );
}
export function WeeklyEdge({ data }: { data: CommunityRecognition }) {
  return (
    <section className="edge-discovery-section" aria-labelledby="weekly-title">
      <div className="section-row">
        <h2 id="weekly-title">Edge of the Week</h2>
        <Link href="/edges?tab=community&view=recent">Community history</Link>
      </div>
      <p className="edge-section-note">
        Community recognition · completed week {data.weekly.start.slice(0, 10)}{" "}
        to {data.weekly.end.slice(0, 10)} UTC (end exclusive).
      </p>
      {data.weekly.winner ? (
        <InterestCard item={data.weekly.winner} weekly />
      ) : (
        <div className="edge-quiet-state">
          <strong>No qualifying Edge this week yet.</strong>
          <p>
            {data.weekly.status === "WITHHELD"
              ? "This week's recognition is unavailable under current privacy or integrity checks. No replacement winner is inferred."
              : data.weekly.status === "AWAITING_REVIEW"
                ? "A complete-week record awaits an audited recognition snapshot."
                : "A settled positive standard record, sufficient history and genuine member interest are required. No unsettled selection receives this recognition."}
          </p>
        </div>
      )}
      <details className="edge-rule-disclosure">
        <summary>Recognition criteria</summary>
        <p>
          At least 20 settled non-void records across seven active days, three
          eligible engaged members, clear integrity review and a positive
          standard 1-unit result. Interest ranks first; positive return is
          capped for tie-breaking. Complete history remains available. No prize,
          payment or guarantee of future results.
        </p>
      </details>
    </section>
  );
}
export function MonitoredFixtures({
  data,
  weekend = false,
}: {
  data: MonitoredMarkets;
  weekend?: boolean;
}) {
  return (
    <section
      className="edge-discovery-section"
      aria-labelledby={weekend ? "weekend-title" : "monitor-title"}
    >
      <div className="section-row">
        <h2 id={weekend ? "weekend-title" : "monitor-title"}>
          {weekend
            ? "Weekend Watchlist"
            : data.window === "today"
              ? "Today's monitored events"
              : "Upcoming monitored events"}
        </h2>
        <Link href="/sports">Sports</Link>
      </div>
      <p className="edge-data-label">
        {weekend
          ? "WATCHLIST — NOT A DOCKED EDGE"
          : "MARKET DATA — NOT A RECOMMENDATION"}
      </p>
      {data.events.length ? (
        <div className="monitored-list">
          {data.events.map((event) => (
            <article className="monitored-event" key={event.eventId}>
              <div className="recognition-meta">
                <span>
                  <SportIcon sport={event.sport} size={16} />{" "}
                  {event.competition}
                </span>
                <span>{event.status}</span>
              </div>
              <h3>{event.eventLabel}</h3>
              <p className="recognition-time">
                <LocalTimestamp value={event.startAt} />
              </p>
              {event.markets.length ? (
                <ul>
                  {event.markets.map((market) => (
                    <li key={`${market.marketId}:${market.label}`}>
                      <span>{market.label}</span>
                      <span>
                        {market.referencePrice &&
                        market.freshness === "FRESH" &&
                        market.standardStatus === "STANDARD_VERIFIED"
                          ? `Market reference ${market.referencePrice}`
                          : "Reference unavailable"}
                      </span>
                      <small>
                        {market.freshness === "STALE" ? (
                          "Stale source · reference withheld"
                        ) : market.sourceAt ? (
                          <>
                            Source <LocalTimestamp value={market.sourceAt} />
                          </>
                        ) : (
                          "Source freshness unknown"
                        )}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="edge-section-note">
                  No approved market reference is available.
                </p>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="edge-quiet-state">
          <strong>
            {data.status === "READY"
              ? "No monitored fixtures in this window."
              : "Market data not available yet."}
          </strong>
          <p>{data.message}</p>
        </div>
      )}
      <p className="edge-section-note">
        {data.provider ?? "Provider not configured"} · Window{" "}
        {data.from.slice(0, 10)}–{data.to.slice(0, 10)} UTC. Research estimates
        are not shown as recommendations.
      </p>
    </section>
  );
}
export function RecentEdgeResults({
  official,
  community,
}: {
  official: PublicTip[];
  community: CommunityEdge[];
}) {
  const records = [
    ...official
      .filter((t) => t.settled_at && t.result !== "pending")
      .map((t) => ({
        id: t.id,
        label: "OFFICIAL DOCKED",
        event: t.participants.join(" v "),
        selection: t.selection,
        result: t.result.toUpperCase(),
        at: new Date(t.settled_at!).toISOString(),
        href: `/tips/${t.id}`,
      })),
    ...community
      .filter((t) => t.settledAt && t.result !== "PENDING")
      .map((t) => ({
        id: t.id,
        label: "COMMUNITY",
        event: t.eventLabel,
        selection: t.selection,
        result: t.result.replaceAll("_", " "),
        at: t.settledAt!,
        href: `/community/edges/${t.id}`,
      })),
  ]
    .sort(
      (a, b) => Date.parse(b.at) - Date.parse(a.at) || a.id.localeCompare(b.id),
    )
    .slice(0, 3);
  return (
    <section
      className="edge-discovery-section"
      aria-labelledby="recent-results-title"
    >
      <div className="section-row">
        <h2 id="recent-results-title">Recent results</h2>
        <Link href="/edges?tab=community&view=recent">Community history</Link>
      </div>
      <p className="edge-section-note">
        Latest completed records from the fetched pages. Wins, losses, voids and
        disputes remain in complete histories.
      </p>
      {records.length ? (
        <ol className="edge-result-list">
          {records.map((r) => (
            <li key={`${r.label}-${r.id}`}>
              <span className="edge-data-label">
                {r.label} · {r.result}
              </span>
              <Link href={r.href}>{r.selection}</Link>
              <span>{r.event}</span>
              <small>
                <LocalTimestamp value={r.at} />
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <div className="edge-quiet-state">
          <strong>No completed records available.</strong>
          <p>
            Results stay pending until an authorised outcome is recorded.
            Nothing is filled with demonstration results.
          </p>
        </div>
      )}
      <Link className="edge-history-link" href="/results">
        Complete official Docked results
      </Link>
    </section>
  );
}
