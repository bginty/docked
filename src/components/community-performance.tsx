import Link from "next/link";
import type {
  CommunityPerformance,
  TopDockedRow,
  PerformanceBadge,
} from "@/core/top-docked";
import type { CommunityEdge } from "@/core/community-edge";
import { SportIcon } from "./sport-icon";
import { CommunityEmpty } from "./community-basics";
export function CommunityEdgeCard({ edge }: { edge: CommunityEdge }) {
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
          {edge.marketId} · {edge.bookmaker}
        </p>
        <dl className="edge-facts">
          <div>
            <dt>Verified standard odds</dt>
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
          stroke="#92a499"
          strokeDasharray="4 4"
        />
        <polyline
          points={points}
          fill="none"
          stroke="#146d61"
          strokeWidth="3"
        />
        <text x="30" y="220" fontSize="12" fill="#53666b">
          Start · 0 units
        </text>
        <text x="630" y="220" fontSize="12" textAnchor="end" fill="#53666b">
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
