import Link from "next/link";
import type {
  ResearchDashboard,
  MatchResearchEnvelope,
} from "@/core/research-contracts";
import type { ResearchFactType } from "@/core/research-engine";
import { LocalTimestamp } from "./local-timestamp";
import {
  MatchResearchView,
  ResearchModelBoundary,
  researchLabel,
} from "./research-file";
import {
  FeatureGovernanceForm,
  ManualResearchFactForm,
  ResearchContentReviewForm,
  ResearchDraftForm,
  ResearchEnqueueForm,
  ResearchPolicyForm,
  ResearchRecalculationForm,
  ResearchScheduleForm,
  ResearchSnapshotForm,
  SourceGovernanceForm,
} from "./research-controls";

export function ResearchNavigation() {
  return (
    <nav className="scanner-nav" aria-label="Research operations">
      <Link href="/admin/research">Research sources and matches</Link>
      <Link href="/admin/model-performance">Model performance</Link>
      <Link href="/admin/data-health">Market data health</Link>
      <Link href="/admin/edge-scanner">Edge scanner</Link>
    </nav>
  );
}
export function ResearchDashboardView({
  data,
  factTypes,
}: {
  data: ResearchDashboard;
  factTypes: readonly ResearchFactType[];
}) {
  return (
    <div className="research-workspace">
      <section className="research-panel">
        <h2>Research service</h2>
        <p className="research-status">
          {data.status === "READY"
            ? "Connected"
            : data.status.replaceAll("_", " ")}
        </p>
        <p>{data.message}</p>
        <dl className="research-summary">
          <div>
            <dt>Retained facts</dt>
            <dd>{data.counts?.facts ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Immutable snapshots</dt>
            <dd>{data.counts?.snapshots ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Pending jobs</dt>
            <dd>{data.counts?.pendingJobs ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Research automation</dt>
            <dd>
              {data.automationEnabled
                ? "Enabled within source controls"
                : "Disabled"}
            </dd>
          </div>
        </dl>
        <p>
          Counts describe retained research records, not model quality. An
          official website is not automatically a licensed source.
        </p>
      </section>
      <ResearchModelBoundary />
      <section className="research-panel">
        <h2>Canonical matches</h2>
        <p>
          English Premier League pre-match research. Only genuine mapped
          fixtures appear.
        </p>
        {data.matches.length ? (
          <ul className="research-timeline">
            {data.matches.map((match) => (
              <li key={match.eventId}>
                <Link
                  className="research-inline-link"
                  href={`/admin/research/${encodeURIComponent(match.eventId)}`}
                >
                  {match.homeTeam} v {match.awayTeam}
                </Link>
                <p>
                  <LocalTimestamp value={match.startAt} /> · {match.status}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No mapped fixtures are available for research. No placeholder match
            has been created.
          </p>
        )}
      </section>
      <section className="research-panel">
        <h2>Versioned source registry</h2>
        {data.sources.length ? (
          <div
            className="table-scroll"
            role="region"
            aria-label="Research source registry"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Source and version</th>
                  <th>Rights and use</th>
                  <th>Review and retention</th>
                  <th>Acquisition</th>
                </tr>
              </thead>
              <tbody>
                {data.sources.map(({ id, configuration: s, current }) => (
                  <tr key={id}>
                    <td>
                      <strong>{s.name}</strong>
                      <p>
                        {s.sourceId} · {s.version} ·{" "}
                        {current ? "Current review" : "Superseded review"}
                      </p>
                      <p>{s.reliability.replaceAll("_", " ")}</p>
                    </td>
                    <td>
                      {s.rightsState.replaceAll("_", " ")}
                      <p>
                        Public display: {s.publicDisplay}; model use:{" "}
                        {s.modelUse}; automation: {s.automation}
                      </p>
                      <p>Jurisdictions: {s.jurisdictions.join(", ")}</p>
                    </td>
                    <td>
                      Reviewed <LocalTimestamp value={s.reviewedAt} />
                      <p>
                        Next review <LocalTimestamp value={s.reviewDueAt} />
                      </p>
                      <p>
                        Retention:{" "}
                        {s.storage.maxDays === null
                          ? "Unknown"
                          : `${s.storage.maxDays} days`}{" "}
                        · {s.storage.permission}
                      </p>
                    </td>
                    <td>
                      {s.accessMethod} · {s.domain}
                      <p>
                        Daily request cap:{" "}
                        {s.etiquette.maximumRequestsPerDay ?? "Unknown"}
                      </p>
                      <p>
                        Minimum interval:{" "}
                        {s.etiquette.minimumIntervalSeconds === null
                          ? "Unknown"
                          : `${s.etiquette.minimumIntervalSeconds}s`}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            No reviewed source is configured. Missing permission is not
            approval.
          </p>
        )}
      </section>
      <section className="research-panel">
        <h2>Source health and cost</h2>
        {data.sources.some((s) => s.current) ? (
          <div
            className="table-scroll"
            role="region"
            aria-label="Research source health"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Last successful fetch</th>
                  <th>Last failed fetch</th>
                  <th>Request ledger</th>
                  <th>Quota and cost</th>
                </tr>
              </thead>
              <tbody>
                {data.sources
                  .filter((s) => s.current)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>{s.configuration.name}</td>
                      <td>
                        {s.health.lastSuccess ? (
                          <LocalTimestamp value={s.health.lastSuccess} />
                        ) : (
                          "No successful fetch recorded"
                        )}
                      </td>
                      <td>
                        {s.health.lastFailure ? (
                          <LocalTimestamp value={s.health.lastFailure} />
                        ) : (
                          "No failed fetch recorded"
                        )}
                        <p>{s.health.errorCode ?? "No failure code"}</p>
                      </td>
                      <td>
                        {s.health.requestsToday} attempts today (UTC)
                        <p>{s.health.reservedRequests} reserved</p>
                        <p>
                          Last HTTP status:{" "}
                          {s.health.lastHttpStatus ?? "Unknown"}
                        </p>
                      </td>
                      <td>
                        Remaining provider quota: Unknown
                        <p>Daily/monthly cost projection: Unknown</p>
                        <p>Mapping failures: Unknown</p>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No current source health measurements are available.</p>
        )}
        <p>
          A registry entry or manual fact is not evidence of an automated
          request. Unmeasured provider quota and costs stay unknown.
        </p>
        <p>
          Market-provider diagnostics remain separate in{" "}
          <Link href="/admin/data-health">Data health</Link>.
        </p>
      </section>
      <section className="research-panel">
        <h2>Feature governance</h2>
        {data.features.length ? (
          <ul className="research-timeline">
            {data.features.map(({ id, configuration: f, current }) => (
              <li key={id}>
                <strong>
                  {f.featureId} · {f.version} · {f.state.replaceAll("_", " ")}
                </strong>
                <p>
                  {current ? "Current version" : "Superseded version"} ·{" "}
                  {f.modelVersion ?? "No model binding"}
                </p>
                <p>{f.causalRationale}</p>
                <p>Limitations: {f.limitations}</p>
                <p>
                  Inputs: {f.factTypes.map(researchLabel).join(", ")} ·{" "}
                  {f.acceptedConfidence.join(", ")} · max age {f.maxAgeSeconds}s
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            No feature reviews are configured. Display-only research cannot
            silently become a model input.
          </p>
        )}
      </section>
      <section className="research-panel">
        <h2>Jobs and schedules</h2>
        {data.schedules.length ? (
          <ul className="research-timeline">
            {data.schedules.map((s) => (
              <li key={s.id}>
                <code>{s.id}</code> · {s.enabled ? "Enabled" : "Disabled"}
                <p>
                  Next run:{" "}
                  {s.nextRun ? (
                    <LocalTimestamp value={s.nextRun} />
                  ) : (
                    "Not scheduled"
                  )}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>No source schedules are configured.</p>
        )}
        {data.jobs.length ? (
          <div
            className="table-scroll"
            role="region"
            aria-label="Research job history"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>Job</th>
                  <th>State</th>
                  <th>Attempts</th>
                  <th>Queued</th>
                </tr>
              </thead>
              <tbody>
                {data.jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <code>{j.id}</code>
                    </td>
                    <td>{j.state}</td>
                    <td>{j.attempts}</td>
                    <td>
                      <LocalTimestamp value={j.createdAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            No job runs have been recorded. No success or request counts are
            invented.
          </p>
        )}
      </section>
      <section className="research-panel">
        <h2>Editorial research queue</h2>
        <p>
          Research, match updates and lineup updates use reviewed facts. They
          are never official Edges.
        </p>
        {data.content.length ? (
          <ul className="research-timeline">
            {data.content.map((c) => (
              <li key={c.id}>
                <span className="research-content-label">
                  {c.type.replaceAll("_", " ")} · {c.status}
                </span>
                <h3>{c.headline}</h3>
                <Link
                  className="research-inline-link"
                  href={`/admin/research/${encodeURIComponent(c.eventId)}?snapshot=${encodeURIComponent(c.snapshotId)}`}
                >
                  Inspect retained draft evidence
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>No research drafts are queued.</p>
        )}
      </section>
      {data.capabilities.govern && (
        <div className="research-grid">
          <SourceGovernanceForm factTypes={factTypes} />
          <FeatureGovernanceForm factTypes={factTypes} models={data.models} />
          <ResearchPolicyForm factTypes={factTypes} />
          <ResearchScheduleForm data={data} />
        </div>
      )}
    </div>
  );
}

export function ResearchMatchPanel({
  data,
  snapshotId,
}: {
  data: MatchResearchEnvelope;
  snapshotId?: string;
}) {
  const dashboard = data.dashboard;
  const manual = dashboard.sources.filter(
    (s) =>
      s.current &&
      ["APPROVED_MANUAL_ONLY", "APPROVED_AUTOMATED"].includes(
        s.configuration.rightsState,
      ),
  );
  const displayedSnapshot = snapshotId
    ? data.snapshots.find(
        (s) => s.id === snapshotId && s.hash === data.file?.snapshotHash,
      )
    : data.snapshots.find((s) => s.hash === data.file?.snapshotHash);
  const drafts = displayedSnapshot
    ? dashboard.content.filter(
        (c) =>
          c.eventId === data.event?.eventId &&
          c.snapshotId === displayedSnapshot.id,
      )
    : [];
  return (
    <div className="research-workspace">
      <p>{data.message}</p>
      {data.file ? (
        <MatchResearchView file={data.file} />
      ) : (
        <section className="research-panel">
          <h2>No retained research file available</h2>
          <p>
            DATA NOT AVAILABLE. The match may need approved sources and a
            completeness policy, or access may be unavailable.
          </p>
          <ResearchModelBoundary />
        </section>
      )}
      {data.event && (
        <>
          <section className="research-panel">
            <h2>Immutable snapshot history</h2>
            {data.snapshots.length ? (
              <ol className="research-timeline">
                {data.snapshots.map((snapshot) => (
                  <li key={snapshot.id}>
                    <Link
                      className="research-inline-link"
                      href={`/admin/research/${encodeURIComponent(data.event!.eventId)}?snapshot=${encodeURIComponent(snapshot.id)}`}
                    >
                      <LocalTimestamp value={snapshot.asOfTime} />
                    </Link>
                    <p>
                      <code>{snapshot.hash}</code>
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No snapshots have been recorded.</p>
            )}
          </section>
          <div className="research-grid">
            {dashboard.capabilities.recordFacts && (
              <>
                <ManualResearchFactForm
                  eventId={data.event.eventId}
                  sources={manual}
                />
                <ResearchSnapshotForm
                  eventId={data.event.eventId}
                  data={dashboard}
                />
                <ResearchRecalculationForm
                  snapshots={data.snapshots}
                  models={dashboard.models}
                />
              </>
            )}
            {dashboard.capabilities.editorial && (
              <ResearchDraftForm snapshots={data.snapshots} />
            )}{" "}
            {dashboard.capabilities.enqueue && (
              <ResearchEnqueueForm
                eventId={data.event.eventId}
                schedules={dashboard.schedules}
              />
            )}
          </div>
          {drafts.length > 0 && (
            <section className="research-panel">
              <h2>Editorial review of this exact snapshot</h2>
              {drafts.map((draft) => (
                <article key={draft.id}>
                  <p className="research-content-label">
                    {draft.type.replaceAll("_", " ")} · {draft.status}
                  </p>
                  <h3>{draft.headline}</h3>
                  {dashboard.capabilities.editorial && (
                    <ResearchContentReviewForm
                      id={draft.id}
                      published={draft.status === "PUBLISHED"}
                    />
                  )}
                </article>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
