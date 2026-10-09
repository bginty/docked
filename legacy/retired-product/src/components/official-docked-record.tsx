import Link from "next/link";
import {
  officialRecordMetrics,
  officialRecordScope,
  type OfficialRecordFilters,
  type OfficialDockedRecord,
} from "@/core/official-docked-record";
import { LedgerChart } from "./ledger-chart";
import { LocalTimestamp } from "./local-timestamp";
import { Metric, Notice } from "./ui";

export function OfficialRecord({
  record,
  filters = {},
}: {
  record: OfficialDockedRecord;
  filters?: OfficialRecordFilters;
}) {
  const metrics = officialRecordMetrics(officialRecordScope(record, filters));
  const filterRows =
    record.status === "READY"
      ? record.rows.filter((row) => row.evidence === "live_published")
      : [];
  const filtered = Object.values(filters).some(Boolean);
  const show = (value: string | number | null, suffix = "") =>
    value === null ? "Unavailable" : `${value}${suffix}`;
  const notStarted =
    metrics.available &&
    record.officialRecordStart === null &&
    metrics.published === 0;
  return (
    <section
      className="official-docked-record"
      aria-label="Docked official forward record"
    >
      <p className="lede">
        Docked’s official record begins with its first genuine forward-published
        Edge. We do not reconstruct historical tips.
      </p>
      <span className="pill">
        GENUINE FORWARD PUBLICATIONS · FIXED ONE-UNIT BENCHMARK
      </span>
      {record.officialRecordStart ? (
        <p>
          Since <LocalTimestamp value={record.officialRecordStart} />. This is
          the global first-publication boundary, not the first row visible in
          your region.
        </p>
      ) : notStarted ? (
        <p className="notice">
          <strong>The record has not started yet.</strong> The “Since” date
          remains unset until the first genuine publication.
        </p>
      ) : (
        <Notice>
          The official record is{" "}
          {record.status === "RESTRICTED"
            ? "not available in your region"
            : "currently unavailable"}
          . Its start date and performance cannot be inferred from an
          inaccessible record.
        </Notice>
      )}
      {!metrics.available && record.officialRecordStart && (
        <Notice>
          The global start date is recorded, but publication details and
          performance are unavailable for this view. This does not imply an
          empty record or zero returns.
        </Notice>
      )}
      <form className="filters" action="/results">
        <label>
          From publication date
          <input type="date" name="from" defaultValue={filters.from} />
        </label>
        <label>
          To publication date
          <input type="date" name="to" defaultValue={filters.to} />
        </label>
        <label>
          Competition
          <select name="sport" defaultValue={filters.sport ?? ""}>
            <option value="">All competitions</option>
            {[
              ...new Set(
                filterRows
                  .map((row) => row.competition)
                  .filter((value): value is string => !!value),
              ),
            ]
              .sort()
              .map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
          </select>
        </label>
        <label>
          Model version
          <select name="strategy" defaultValue={filters.strategy ?? ""}>
            <option value="">All model versions</option>
            {[...new Set(filterRows.map((row) => row.modelVersion))]
              .sort()
              .map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
          </select>
        </label>
        <button className="button" type="submit">
          Apply filters
        </button>
        <Link href="/results">Complete all-time record</Link>
      </form>
      {filtered && (
        <p className="notice">
          Filtered view: metrics, chart and table use the same selected
          publications. The global “Since” boundary remains unchanged.{" "}
          <Link href="/results">Return to the complete record.</Link>
        </p>
      )}
      <div className="metrics">
        {(
          [
            ["Published", metrics.published, ""],
            ["Settled", metrics.settled, ""],
            ["Wins", metrics.wins, ""],
            ["Losses", metrics.losses, ""],
            ["Voids", metrics.voids, ""],
            ["Pending", metrics.pending, ""],
            ["Net Units", metrics.netUnits, " u"],
            ["ROI", metrics.roi, "%"],
            ["Avg Published Odds", metrics.averagePublishedOdds, ""],
            ["Avg Estimated Edge", metrics.averageEstimatedEdge, "%"],
            ["Max Drawdown", metrics.maximumDrawdown, " u"],
            ["Longest Losing Run", metrics.longestLosingRun, ""],
          ] as const
        ).map(([label, value, suffix]) => (
          <Metric key={label} label={label} value={show(value, suffix)} />
        ))}
      </div>
      <Notice>
        All accessible genuine official publications are included, with losses,
        voids and corrections. Research, forward paper, demonstrations and
        reconstructed history are excluded. Estimates can be wrong; this record
        does not promise future profit.{" "}
        {metrics.disputed
          ? `${metrics.disputed} disputed record(s) remain listed while settlement is unresolved.`
          : ""}
      </Notice>
      <LedgerChart curve={metrics.curve} />
      <h2>Every official publication</h2>
      <div
        className="table-wrap"
        role="region"
        aria-label="Complete official publication ledger"
        tabIndex={0}
      >
        <table>
          <caption>
            One unit at the locked publication odds. Current prices never
            rewrite the benchmark.
          </caption>
          <thead>
            <tr>
              <th>Publication / event</th>
              <th>Selection</th>
              <th>Model version</th>
              <th>Published odds</th>
              <th>Estimated edge</th>
              <th>Result</th>
              <th>Net units</th>
              <th>Corrections</th>
            </tr>
          </thead>
          <tbody>
            {metrics.rows.map((row) => (
              <tr key={row.publicationId}>
                <td>
                  <Link href={`/tips/${row.publicationId}`}>
                    {row.eventLabel ?? row.eventId}
                  </Link>
                  <br />
                  <LocalTimestamp value={row.publishedAt} />
                </td>
                <td>{row.selection}</td>
                <td>{row.modelVersion}</td>
                <td>{row.odds}</td>
                <td>
                  {row.estimatedEv === null
                    ? "Unavailable"
                    : `${(Number(row.estimatedEv) * 100).toFixed(2)}%`}
                </td>
                <td>{row.result.toUpperCase()}</td>
                <td>{row.netUnits ?? "Unavailable"}</td>
                <td>{row.correctionCount}</td>
              </tr>
            ))}
            {!metrics.rows.length && (
              <tr>
                <td colSpan={8}>
                  {notStarted
                    ? "The record has not started yet."
                    : "No accessible genuine official publications. Unavailable records are not zero performance."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="small-note">
        ROI is net units divided by settled non-void one-unit stakes. Pending
        and disputed entries have no assumed return. Voids return the unit and
        do not enter the ROI denominator. Published-odds and estimated-edge
        averages include pending and void publications; missing observations
        make that average unavailable. Drawdown and losing runs use settlement
        order, including corrected outcomes.
      </p>
      <section id="weekly-performance">
        <h2>Performance over time</h2>
        {Object.keys(metrics.months).length ? (
          <div
            className="table-wrap"
            role="region"
            aria-label="Official monthly results"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Settlement month (UTC)</th>
                  <th>Net units</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(metrics.months).map(([month, units]) => (
                  <tr key={month}>
                    <td>{month}</td>
                    <td>{units}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            Monthly performance will appear when genuine settlements are
            available. No historical results are filled in.
          </p>
        )}
        <Link href="/methodology">Methodology and model changes</Link>
      </section>
    </section>
  );
}
