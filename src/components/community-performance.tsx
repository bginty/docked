import Link from "next/link";
import type {
  CommunityPerformance,
  TopDockedRow,
  PerformanceBadge,
} from "@/core/top-docked";
import type { CommunityEdge } from "@/core/community-edge";
import { SportIcon } from "./sport-icon";
import { CommunityEmpty } from "./community-basics";
export function CommunityEdgeCard({
  edge,
  compact = false,
}: {
  edge: CommunityEdge;
  compact?: boolean;
}) {
  if (compact) return <CompactCommunityEdgeCard edge={edge} />;
  return (
    <article className="social-card">
      <div className="social-author">
        <span className="avatar">
          <SportIcon sport={edge.sport} />
        </span>
        <div>
          {edge.interactionsAllowed ? (
            <Link
              className="social-author-name"
              href={`/profile/${edge.handle}`}
            >
              {edge.displayName}
            </Link>
          ) : (
            <strong>{edge.displayName}</strong>
          )}
          <span className="social-author-meta">
            {edge.interactionsAllowed
              ? `@${edge.handle}`
              : "Identity unavailable"}{" "}
            · Community Edge
          </span>
        </div>
        <span className="community-badge">COMMUNITY</span>
      </div>
      <div className="community-edge-summary">
        <span className={`status-chip ${edge.result.toLowerCase()}`}>
          {edge.result.replaceAll("_", " ")}
        </span>
        <p className="small-note">{edge.eventLabel}</p>
        <h3>
          <Link href={`/community/edges/${edge.id}`}>{edge.selection}</Link>
        </h3>
        <p>
          {edge.marketLabel ?? edge.marketId} ·{" "}
          {edge.pricingModel === "market_reference_v1"
            ? "Market reference methodology"
            : `${edge.bookmaker} · original bookmaker methodology`}
        </p>
        <dl className="edge-facts">
          <div>
            <dt>
              {edge.pricingModel === "market_reference_v1"
                ? "Submission market reference"
                : "Verified standard odds"}
            </dt>
            <dd>{edge.odds}</dd>
          </div>
          <div>
            <dt>Benchmark</dt>
            <dd>{edge.units} unit</dd>
          </div>
          <div>
            <dt>Event starts</dt>
            <dd>
              <time dateTime={edge.startAt}>
                {new Date(edge.startAt).toLocaleString("en-AU", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </time>
            </dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>
              <time dateTime={edge.submittedAt}>
                {new Date(edge.submittedAt).toLocaleString("en-AU", {
                  timeZone: "UTC",
                })}{" "}
                UTC
              </time>
            </dd>
          </div>
        </dl>
        {edge.pricingModel === "market_reference_v1" && (
          <p className="form-help">
            Locked benchmark for this permanent 1.00-unit record. Methodology
            UNVALIDATED; the market reference is not a guaranteed execution
            price.
          </p>
        )}
        {(edge.personalPrice || edge.personalBookmaker) && (
          <p className="promotion-label">
            Member-reported social context:{" "}
            {edge.personalBookmaker ?? "Bookmaker unspecified"} ·{" "}
            {edge.personalPrice ?? "Price unspecified"}
            {edge.personalPromotional ? " · promotional" : ""}. Unverified and
            excluded from competitive grading.
          </p>
        )}
        <p className="small-note">
          {edge.classification.replaceAll("_", " ")} · {edge.ruleVersion}
        </p>
        {edge.integrity === "REVIEW" && (
          <p className="promotion-label">INTEGRITY REVIEW · Not ranked</p>
        )}
        {edge.corrections > 0 && (
          <Link
            className="text-link"
            href={`/community/edges/${edge.id}#corrections`}
          >
            {edge.corrections} visible correction
            {edge.corrections === 1 ? "" : "s"}
          </Link>
        )}
      </div>
      <p className="form-help">
        Permanent record. Losses remain visible. No guarantee of future results.
      </p>
      <Link className="text-link" href={`/community/edges/${edge.id}`}>
        Record, evidence and discussion
      </Link>
    </article>
  );
}
export function CompactCommunityEdgeCard({ edge }: { edge: CommunityEdge }) {
  const reference = edge.pricingModel === "market_reference_v1";
  return (
    <article className="social-card compact-edge-card compact-community-edge">
      <div className="compact-edge-meta">
        <span>
          <SportIcon sport={edge.sport} size={18} /> COMMUNITY EDGE
        </span>
        <span className={`status-chip ${edge.result.toLowerCase()}`}>
          {edge.result.replaceAll("_", " ")}
        </span>
      </div>
      <div className="social-author-name">
        {edge.interactionsAllowed ? (
          <Link href={`/profile/${edge.handle}`}>{edge.displayName}</Link>
        ) : (
          <strong>{edge.displayName}</strong>
        )}
        <span className="social-author-meta">
          {edge.interactionsAllowed
            ? `@${edge.handle}`
            : "Identity unavailable"}
        </span>
      </div>
      <p className="edge-event">{edge.eventLabel}</p>
      <h3 className="compact-edge-selection">
        <Link href={`/community/edges/${edge.id}`}>{edge.selection}</Link>
      </h3>
      <p className="edge-market">{edge.marketLabel ?? edge.marketId}</p>
      <div className="compact-edge-prices">
        <div>
          <span>
            {reference
              ? "Submission market reference"
              : "Verified standard odds"}
          </span>
          <strong>{edge.odds}</strong>
          <small>Locked · decimal</small>
        </div>
        <div>
          <span>Fixed benchmark</span>
          <strong>{edge.units} unit</strong>
        </div>
        {reference && edge.dockedFairPrice && (
          <div>
            <span>Docked fair price</span>
            <strong>{edge.dockedFairPrice}</strong>
            <small>Estimate at submission</small>
          </div>
        )}
        {reference && edge.minimumEdgePrice && (
          <div>
            <span>Minimum at submission</span>
            <strong>{edge.minimumEdgePrice}+</strong>
          </div>
        )}
      </div>
      <p className="small-note">
        Starts{" "}
        <time dateTime={edge.startAt}>
          {new Date(edge.startAt).toLocaleString("en-AU", { timeZone: "UTC" })}{" "}
          UTC
        </time>
      </p>
      <p className="small-note">
        Submitted{" "}
        <time dateTime={edge.submittedAt}>
          {new Date(edge.submittedAt).toLocaleString("en-AU", {
            timeZone: "UTC",
          })}{" "}
          UTC
        </time>{" "}
        ·{" "}
        {reference
          ? "Methodology UNVALIDATED"
          : `${edge.bookmaker} · original bookmaker methodology`}
      </p>
      {(edge.personalPrice || edge.personalBookmaker) && (
        <p className="promotion-label">
          Member-reported: {edge.personalBookmaker ?? "Bookmaker unspecified"} ·{" "}
          {edge.personalPrice ?? "Price unspecified"}
          {edge.personalPromotional ? " · promotional" : ""}. Unverified;
          excluded from grading.
        </p>
      )}
      {edge.integrity === "REVIEW" && (
        <p className="promotion-label">INTEGRITY REVIEW · Not ranked</p>
      )}
      <div className="compact-edge-footer">
        <Link className="text-link" href={`/community/edges/${edge.id}`}>
          Record and evidence ↗
        </Link>
        {edge.corrections > 0 && (
          <Link href={`/community/edges/${edge.id}#corrections`}>
            {edge.corrections} visible correction
            {edge.corrections === 1 ? "" : "s"}
          </Link>
        )}
        <p className="edge-warning">
          Permanent record. Losses remain visible. No guaranteed profit.
        </p>
      </div>
    </article>
  );
}
export function PerformanceMetrics({
  performance,
}: {
  performance: CommunityPerformance | null;
}) {
  const entries: [string, string | number | null | undefined][] = [
    ["Verified Edges", performance?.verifiedEdges],
    ["Net standard units", performance?.netUnits],
    ["ROI", performance?.roi == null ? null : `${performance.roi}%`],
    [
      "Win rate",
      performance?.winRate == null ? null : `${performance.winRate}%`,
    ],
    ["Average odds", performance?.averageOdds],
    ["Settled picks", performance?.settled],
    [
      "Maximum drawdown",
      performance?.maxDrawdown == null ? null : `${performance.maxDrawdown} u`,
    ],
    ["Longest losing run", performance?.longestLosingRun],
  ];
  return (
    <div className="profile-metrics">
      {entries.map(([label, value]) => (
        <div className="profile-metric" key={label}>
          <p>{label}</p>
          <strong>{value ?? "N/A"}</strong>
        </div>
      ))}
    </div>
  );
}
export function PerformanceChart({
  performance,
}: {
  performance: CommunityPerformance | null;
}) {
  if (!performance?.curve.length)
    return (
      <CommunityEmpty title="No settled performance curve">
        A chart appears only after authorised results settle eligible records.
        Pending selections and missing outcomes are not zero returns.
      </CommunityEmpty>
    );
  const values = [0, ...performance.curve.map((p) => Number(p.units))],
    min = Math.min(...values),
    max = Math.max(...values),
    span = max - min || 1;
  const points = values
    .map(
      (v, i) =>
        `${30 + (i / (values.length - 1 || 1)) * 600},${190 - ((v - min) / span) * 150}`,
    )
    .join(" ");
  return (
    <figure className="performance-chart">
      <svg
        viewBox="0 0 660 230"
        role="img"
        aria-label={`Cumulative standard units, ending at ${performance.netUnits}. Maximum drawdown ${performance.maxDrawdown} units.`}
      >
        <line
          x1="30"
          x2="630"
          y1={190 - ((0 - min) / span) * 150}
          y2={190 - ((0 - min) / span) * 150}
          stroke="var(--border-control)"
          strokeDasharray="4 4"
        />
        <polyline
          points={points}
          fill="none"
          stroke="var(--brand-blue)"
          strokeWidth="3"
        />
        <text x="30" y="220" fontSize="12" fill="var(--muted)">
          Start · 0 units
        </text>
        <text
          x="630"
          y="220"
          fontSize="12"
          textAnchor="end"
          fill="var(--muted)"
        >
          {performance.netUnits} units
        </text>
      </svg>
      <figcaption>
        Cumulative fixed one-unit results, including losses. Data table follows.
      </figcaption>
      <details>
        <summary>Read chart data</summary>
        <div
          className="table-wrap"
          role="region"
          aria-label="Performance chart data"
          tabIndex={0}
        >
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Settled at (UTC)</th>
                <th>Cumulative units</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {performance.curve.map((p) => (
                <tr key={p.edgeId}>
                  <td>{p.at}</td>
                  <td>{p.units}</td>
                  <td>
                    <Link href={`/community/edges/${p.edgeId}`}>View Edge</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
export function LeaderboardTable({
  rows,
}: {
  rows: (TopDockedRow & {
    handle: string;
    displayName: string;
    interactionsAllowed: boolean;
    followers?: number | null;
    badges?: PerformanceBadge[];
  })[];
}) {
  return (
    <div
      className="table-wrap"
      role="region"
      aria-label="Top Docked rankings"
      tabIndex={0}
    >
      <table className="leaderboard-table">
        <caption className="small-note">
          Net standardised units, subject to qualification. Official Docked
          performance is separate.
        </caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Member</th>
            <th scope="col">Qualification</th>
            <th scope="col">Net units</th>
            <th scope="col">ROI</th>
            <th scope="col">Settled</th>
            <th scope="col">Average odds</th>
            <th scope="col">Win rate</th>
            <th scope="col">Drawdown</th>
            <th scope="col">Followers</th>
            <th scope="col">Latest Edge (UTC)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.profileId}>
              <td>{r.rank ?? "—"}</td>
              <td>
                {r.interactionsAllowed ? (
                  <Link href={`/profile/${r.handle}`}>
                    {r.displayName}
                    <br />@{r.handle}
                  </Link>
                ) : (
                  <span>
                    {r.displayName}
                    <br />
                    Identity unavailable
                  </span>
                )}
              </td>
              <td>
                <strong>{r.qualification.replaceAll("_", " ")}</strong>
                <br />
                {r.qualificationMessage}
                {r.badges?.map((badge) => (
                  <span className="status-chip" key={badge.code}>
                    {badge.label}
                  </span>
                ))}
              </td>
              <td>{r.performance.netUnits ?? "N/A"}</td>
              <td>
                {r.performance.roi === null ? "N/A" : `${r.performance.roi}%`}
              </td>
              <td>{r.performance.settled}</td>
              <td>{r.performance.averageOdds ?? "N/A"}</td>
              <td>
                {r.performance.winRate === null
                  ? "N/A"
                  : `${r.performance.winRate}%`}
              </td>
              <td>{r.performance.maxDrawdown ?? "N/A"}</td>
              <td>{r.followers ?? "N/A"}</td>
              <td>
                {r.performance.lastSubmissionAt ? (
                  <time dateTime={r.performance.lastSubmissionAt}>
                    {new Date(r.performance.lastSubmissionAt)
                      .toISOString()
                      .replace("T", " ")
                      .slice(0, 16)}
                  </time>
                ) : (
                  "N/A"
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
