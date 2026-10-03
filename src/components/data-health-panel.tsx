import Link from "next/link";
import type { dataHealth } from "@/server/data-health";
import { PageHeading, Notice } from "./ui";

export type DataHealthView = Awaited<ReturnType<typeof dataHealth>>;

/** Presentation only: the route retains the staff/MFA gate and private reads. */
export function DataHealthPanel({ health: h }: { health: DataHealthView }) {
  return (
    <div className="page data-health-panel">
      <PageHeading
        eyebrow="OPERATIONS / DATA HEALTH"
        title="Know what the feed can support."
      />
      <p>
        Legacy publication odds: {h.oddsStatus} · RESULTS_PROVIDER_STATUS=
        {h.resultsStatus}
      </p>
      <section className="card">
        <h2>Current market-data ingestion</h2>
        <p>
          MARKET_DATA_STATUS={h.marketData.status} · Provider:{" "}
          {h.marketData.provider ?? "N/A"}
        </p>
        <p>
          Reviewed rights/configuration:{" "}
          {h.marketData.rightsApproved
            ? h.marketData.configurationVersion
            : "Pending"}{" "}
          · Last successful poll: {h.marketData.lastSuccess ?? "N/A"} · Quota
          remaining: {h.marketData.remaining ?? "N/A"}
        </p>
        <p>
          Market observations are separate from research candidates, forward
          paper and live publications.
        </p>
        <Link href="/api/admin/market-data-editorial?window=weekend">
          Review optional factual editorial draft
        </Link>
      </section>
      <Notice>
        Unknown values remain N/A. A successful HTTP request alone does not
        establish valid markets, current prices or permission to publish.
      </Notice>
      <div className="grid two">
        {h.providers.length ? (
          h.providers.map((p) => (
            <section className="card" key={String(p.provider)}>
              <h2>{String(p.provider)}</h2>
              <dl className="detail-list">
                {Object.entries(p)
                  .filter(([key]) => key !== "diagnostics")
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{key.replaceAll("_", " ")}</dt>
                      <dd>
                        {value instanceof Date
                          ? value.toISOString()
                          : value === null
                            ? "N/A"
                            : String(value)}
                      </dd>
                    </div>
                  ))}
              </dl>
              <h3>Latest poll measurements</h3>
              <pre className="safe-json">
                {JSON.stringify(p.diagnostics, null, 2)}
              </pre>
            </section>
          ))
        ) : (
          <section className="card">
            <h2>No configured provider</h2>
            <p>
              Last successful poll: N/A · Last failed poll: N/A · Quota
              remaining: N/A
            </p>
            <p>
              Events received, markets received, valid/rejected/stale markets,
              mapping failures and source timestamp age: N/A
            </p>
          </section>
        )}
        <section className="card">
          <h2>Candidate review activity</h2>
          <p>
            Legacy publication decisions awaiting review:{" "}
            {h.candidateCount ?? "N/A"}. Scanner candidates captured in the last
            24 hours: {h.scannerCandidateCount ?? "N/A"}.
          </p>
          <Link href="/admin/edge-scanner">Open scanner review</Link>
          <h3>Operational incidents</h3>
          {h.incidents.length ? (
            h.incidents.map((i, n) => <p key={n}>{i}</p>)
          ) : (
            <p>
              No recorded job incidents returned. This is not evidence that
              polling is configured.
            </p>
          )}
        </section>
      </div>
      <h2>Recent poll attempts</h2>
      <div
        className="table-wrap"
        role="region"
        aria-label="Recent provider poll attempts"
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              <th>Provider / sport</th>
              <th>Started</th>
              <th>Status</th>
              <th>Provider errors</th>
              <th>Measurements</th>
            </tr>
          </thead>
          <tbody>
            {h.polls.map((p, i) => (
              <tr key={i}>
                <td>
                  {String(p.provider)} / {String(p.sport)}
                </td>
                <td>{new Date(String(p.started_at)).toISOString()}</td>
                <td>{String(p.status)}</td>
                <td>{String(p.error_code ?? "None recorded")}</td>
                <td>
                  <pre className="safe-json">
                    {JSON.stringify(p.diagnostics, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
