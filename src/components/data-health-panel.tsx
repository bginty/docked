import Link from "next/link";
import type { dataHealth } from "@/server/data-health";
import { PageHeading, Notice } from "./ui";
import {
  trialMetric,
  trialEvidenceUrl,
  trialRequestDescription,
  type ProviderTrialHealth,
} from "@/core/provider-trial-health";

export type DataHealthView = Awaited<ReturnType<typeof dataHealth>>;

function HealthFields({
  fields,
}: {
  fields: [string, string | number | null][];
}) {
  return (
    <dl className="detail-list">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value ?? "Unknown"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A separate trial ledger must never be presented as production approval. */
export function ProviderTrialHealthPanel({
  trial: t,
}: {
  trial: ProviderTrialHealth;
}) {
  return (
    <section aria-labelledby="trial-health-title">
      <h2 id="trial-health-title">The Odds API · controlled Preview trial</h2>
      <Notice>
        Preview trial rights do not approve production use. Strategy
        UNVALIDATED; forward paper not started and official live publication off
        for this trial.
      </Notice>
      <div className="grid two">
        <section className="card">
          <h3>Rights and request authority</h3>
          <HealthFields
            fields={[
              ["Rights status", t.rights.state],
              ["Provider state", t.status],
              ["Rights last reviewed (UTC)", t.rights.reviewedAt],
              ["Next rights review (UTC)", t.rights.nextReviewAt],
              ["Reviewer", t.rights.reviewer],
              ["Continuous polling", t.pollingEnabled ? "Enabled" : "Off"],
              ["Production use", "Not approved by this trial"],
            ]}
          />
          {t.rights.evidenceLinks.length > 0 && (
            <ul>
              {t.rights.evidenceLinks
                .map(trialEvidenceUrl)
                .filter((url): url is string => url !== null)
                .map((url, index) => (
                  <li key={`${url}:${index}`}>
                    <a href={url} rel="noreferrer">
                      Official review source {index + 1}
                    </a>
                  </li>
                ))}
            </ul>
          )}
        </section>
        <section className="card">
          <h3>Fetch history</h3>
          <p>{trialRequestDescription(t)}</p>
          <HealthFields
            fields={[
              ["Recorded attempts", trialMetric(t.requests.attempted)],
              ["Successful HTTP responses", trialMetric(t.requests.successful)],
              ["Last successful fetch (UTC)", t.requests.lastSuccessAt],
              ["Last failed fetch (UTC)", t.requests.lastFailureAt],
              [
                "Last error code",
                t.requests.lastErrorCode ?? "No error record available",
              ],
            ]}
          />
          <p className="small-note">
            HTTP success does not establish mapping, reference availability or
            model quality.
          </p>
        </section>
        <section className="card">
          <h3>Provider credits</h3>
          <HealthFields
            fields={[
              ["Trial credit cap", trialMetric(t.quota.trialCap)],
              ["Trial credits reserved", trialMetric(t.quota.reservedTotal)],
              [
                "Trial charges reported by provider",
                trialMetric(t.quota.reportedTotal),
              ],
              [
                "Provider balance remaining",
                trialMetric(t.quota.providerRemaining),
              ],
              ["Accounting day (UTC)", t.quota.utcDate],
              ["Credits reserved today", trialMetric(t.quota.reservedToday)],
              ["Charges reported today", trialMetric(t.quota.reportedToday)],
            ]}
          />
          <p className="small-note">
            Reservations protect the trial budget, including failed or
            interrupted requests. Unknown charges or account balances are not
            zeroes.
          </p>
        </section>
        <section className="card">
          <h3>Latest measured data quality</h3>
          {!t.latestBatch && (
            <p>No completed data-quality observation is available.</p>
          )}
          <HealthFields
            fields={[
              ["Measured at (UTC)", t.latestBatch?.observedAt ?? null],
              ["Events", trialMetric(t.latestBatch?.events)],
              ["Markets", trialMetric(t.latestBatch?.markets)],
              ["Sources", trialMetric(t.latestBatch?.sources)],
              ["Fresh quotes", trialMetric(t.latestBatch?.freshQuotes)],
              ["Stale quotes", trialMetric(t.latestBatch?.staleQuotes)],
              ["Mapping failures", trialMetric(t.latestBatch?.mappingFailures)],
              [
                "Timestamp anomalies",
                trialMetric(t.latestBatch?.timestampAnomalies),
              ],
              [
                "Suspended markets",
                trialMetric(t.latestBatch?.suspendedMarkets),
              ],
              ["Provider errors", trialMetric(t.latestBatch?.providerErrors)],
            ]}
          />
        </section>
        <section className="card">
          <h3>Reference availability</h3>
          <HealthFields
            fields={[
              ["Evaluated at (UTC)", t.references.observedAt],
              ["Selections evaluated", trialMetric(t.references.evaluated)],
              [
                "Availability references ready",
                trialMetric(t.references.availabilityReady),
              ],
              [
                "Pricing references ready",
                trialMetric(t.references.pricingReady),
              ],
            ]}
          />
          <p>
            Availability reference measures standard-market price availability.
            Pricing reference measures market-implied probability with a
            separate source cohort. Neither establishes proprietary Docked Fair
            or a validated Edge.
          </p>
          {t.references.diagnostics.length === 0 && (
            <p>Reference unavailable: no reference evaluation is recorded.</p>
          )}
        </section>
        <section className="card">
          <h3>Historical access</h3>
          <HealthFields
            fields={[
              ["Account access status", t.historical.status],
              ["Last checked (UTC)", t.historical.checkedAt],
              [
                "Earliest observation in inspected sample",
                t.historical.earliestObservedAt,
              ],
              [
                "Observed snapshot interval (seconds)",
                trialMetric(t.historical.snapshotIntervalSeconds),
              ],
              [
                "Inspected sample credit cost",
                trialMetric(t.historical.sampleCreditCost),
              ],
            ]}
          />
          <p className="small-note">
            Published product coverage is not evidence of this account's
            entitlement. A tiny sample is not validation or profitability
            evidence.
          </p>
        </section>
      </div>
      <section className="card">
        <h3>Canonical trial fixtures · staff only</h3>
        <p>
          Retained trial evidence for mapping review. Staff access does not
          grant member display or community composition approval.
        </p>
        {t.fixtures?.length ? (
          <ul>
            {t.fixtures.map((event) => (
              <li key={event.eventId}>
                <strong>{event.eventLabel}</strong>
                <p>
                  {event.sport} · {event.competition} · {event.status} · Starts{" "}
                  {event.startAt} UTC
                </p>
                <details>
                  <summary>Canonical identifier</summary>
                  <code>{event.eventId}</code>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p>No retained canonical trial fixtures are available to inspect.</p>
        )}
      </section>
      {t.references.diagnostics.map((reference, index) => (
        <details
          className="card"
          key={`${reference.marketId}:${reference.selection}:${index}`}
        >
          <summary>
            {reference.selection} ·{" "}
            {reference.status === "READY"
              ? "Reference evaluated"
              : "Reference unavailable"}
          </summary>
          <HealthFields
            fields={[
              ["Canonical market", reference.marketId],
              ["Status", reference.status],
              ["Reference method", reference.methodVersion],
              [
                "Availability reference",
                reference.status === "READY"
                  ? reference.availabilityPrice
                  : null,
              ],
              [
                "Availability sources",
                trialMetric(reference.availabilitySources),
              ],
              ["Pricing sources", trialMetric(reference.pricingSources)],
              [
                "Eligible observations",
                trialMetric(reference.eligibleObservations),
              ],
              [
                "Excluded observations",
                trialMetric(reference.excludedObservations),
              ],
              ["Stale observations", trialMetric(reference.staleObservations)],
              ["Outliers", trialMetric(reference.outliers)],
              [
                "Source age at evaluation (seconds)",
                trialMetric(reference.sourceAgeSeconds),
              ],
            ]}
          />
        </details>
      ))}
    </section>
  );
}

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
      <ProviderTrialHealthPanel trial={h.trial} />
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
            <h2>No recorded provider health measurements</h2>
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
