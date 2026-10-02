import Link from "next/link";
import { requireRole } from "@/server/auth";
import { dataHealth } from "@/server/data-health";
import { PageHeading, Notice } from "@/components/ui";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Admin data health",
  robots: { index: false, follow: false },
};
export default async function DataHealth() {
  try {
    await requireRole(["owner", "admin", "analyst", "auditor"]);
  } catch {
    return (
      <div className="page">
        <PageHeading eyebrow="RESTRICTED OPERATIONS" title="Data health" />
        <Notice>
          Verified staff access and MFA are required to inspect provider
          diagnostics.
        </Notice>
        <Link href="/login">Log in</Link>
      </div>
    );
  }
  const h = await dataHealth();
  return (
    <div className="page">
      <PageHeading
        eyebrow="OPERATIONS / DATA HEALTH"
        title="Know what the feed can support."
      />
      <p>
        ODDS_PROVIDER_STATUS={h.oddsStatus} · RESULTS_PROVIDER_STATUS=
        {h.resultsStatus}
      </p>
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
          <h2>Candidate opportunities</h2>
          <p>
            {h.candidateCount ?? "N/A"} awaiting review from the last 24 hours
          </p>
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
