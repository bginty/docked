import type {
  IngestionHealth,
  IngestionJobs,
  IngestionDiagnostics,
} from "../core/multisport-health";
const date = (n: number | null | undefined) =>
  n == null
    ? "Not observed"
    : new Intl.DateTimeFormat("en-AU", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Australia/Sydney",
      }).format(new Date(n * 1000));
const ratio = (n: number | undefined, d: number | undefined) =>
  n == null || d == null ? "Not reported" : `${n}/${d}`;
const names: Record<string, string> = {
  synthetic_only: "Synthetic only",
  blocked_pending_Docked_contract_and_activation:
    "Awaiting Docked scoring and activation approval",
  approved_use_configured: "Approved use configured",
  unconfigured: "Not configured",
};
const label = (value: string) => names[value] ?? value.replaceAll("_", " ");
export function IngestionOperationsView({
  health,
  jobs,
  diagnostics,
  retry,
  requestId,
  notice,
}: {
  health: IngestionHealth;
  jobs: IngestionJobs | null;
  diagnostics?: IngestionDiagnostics | null;
  retry?: (form: FormData) => Promise<void>;
  requestId: string;
  notice?: string;
}) {
  return (
    <section
      className="admin-workspace sport-readiness ingestion-operations"
      aria-label="Statistics ingestion"
    >
      <h1>Statistics ingestion</h1>
      <p>
        Postgame data · Times in Sydney · Source access is separate from
        competition activation.
      </p>
      <p>
        <a href="/admin/nfl-history">NFL operations</a> ·{" "}
        <a href="/admin/sports">Sport activation evidence</a>
      </p>
      {notice && <p role="status">{notice}</p>}
      {health.state === "disabled" ? (
        <p>Service connection is not configured. No new sport is activated.</p>
      ) : health.state === "unavailable" ? (
        <p role="alert">
          Service status is unavailable.{" "}
          <a href="/admin/ingestion">Retry status</a>
        </p>
      ) : (
        <>
          {health.synthetic && (
            <p className="ingestion-warning">
              Isolated synthetic data. These records do not verify real players,
              provider rights or hosted acceptance.
            </p>
          )}
          <div className="admin-records">
            {health.data.map((s) => (
              <article key={s.sport} className="admin-workspace-panel">
                <h2>{s.sport.toUpperCase()}</h2>
                <p>
                  {s.provider ?? "No provider"} · {label(s.activation)}
                </p>
                <dl>
                  <dt>Licence configuration</dt>
                  <dd>
                    {label(s.licence_status ?? "Not reported")} ·{" "}
                    {s.source_environment ?? "No environment"}
                  </dd>
                  <dt>Licence review expiry</dt>
                  <dd>{date(s.licence_expires_at)}</dd>
                  <dt>Last successful source sync</dt>
                  <dd>{date(s.last_source_success)}</dd>
                  <dt>Last delivery</dt>
                  <dd>{date(s.last_delivery)}</dd>
                  <dt>Next scheduled sync</dt>
                  <dd>{date(s.next_sync)}</dd>
                  <dt>Worker heartbeat</dt>
                  <dd>{date(s.worker_heartbeat)}</dd>
                  <dt>Overdue or expired-lease jobs</dt>
                  <dd>{s.overdue_jobs ?? "Not reported"}</dd>
                  <dt>Docked-mapped players</dt>
                  <dd>{ratio(s.mapped_players, s.players_total)}</dd>
                  <dt>Complete fixture snapshots</dt>
                  <dd>{ratio(s.fixtures_complete, s.fixtures_total)}</dd>
                  <dt>Complete player-game records</dt>
                  <dd>{ratio(s.complete_player_records, s.player_records)}</dd>
                  <dt>Unresolved mappings / quarantined</dt>
                  <dd>
                    {s.missing_mappings} / {s.invalid_records}
                  </dd>
                  <dt>Corrections / failed attempts / blocked jobs</dt>
                  <dd>
                    {s.corrections ?? "Not reported"} / {s.errors} /{" "}
                    {s.blocked_jobs}
                  </dd>
                  <dt>Scoring publication</dt>
                  <dd>{label(s.scoring_publication)}</dd>
                  <dt>Latest failure</dt>
                  <dd>{s.last_error ?? "None reported"}</dd>
                </dl>
              </article>
            ))}
          </div>
        </>
      )}
      <details>
        <summary>Historical coverage and reconciliation</summary>
        {!diagnostics ? (
          <p>Diagnostics unavailable. Retry status to reconnect.</p>
        ) : (
          <>
            <p>
              Recorded fixtures only; this does not establish complete provider
              season coverage or Docked scoring reconciliation.
            </p>
            {diagnostics.data.coverage.length ? (
              diagnostics.data.coverage.map((c) => (
                <article
                  key={`${c.sport}:${c.season}`}
                  className="admin-workspace-panel"
                >
                  <h3>
                    {c.sport.toUpperCase()} · {c.season}
                  </h3>
                  <p>
                    {c.imported}/{c.fixtures} fixtures imported · {c.complete}{" "}
                    complete source snapshots
                  </p>
                  <p>
                    {date(c.first_kickoff)} – {date(c.last_kickoff)}
                  </p>
                  <p>Last successful check: {date(c.last_success)}</p>
                </article>
              ))
            ) : (
              <p>No historical fixtures imported.</p>
            )}
            <details>
              <summary>
                Unmatched player identities ({diagnostics.data.reviews.length})
              </summary>
              {diagnostics.data.reviews.length ? (
                diagnostics.data.reviews.map((r) => (
                  <p key={r.id}>
                    {r.sport.toUpperCase()} · {r.provider} · {r.external_id} ·{" "}
                    {label(r.reason)} · {date(r.created_at)}
                  </p>
                ))
              ) : (
                <p>No unresolved mapping reviews reported.</p>
              )}
            </details>
            <details>
              <summary>
                Quarantined imports ({diagnostics.data.failures.length})
              </summary>
              {diagnostics.data.failures.length ? (
                diagnostics.data.failures.map((r) => (
                  <p key={r.id}>
                    {r.sport.toUpperCase()} ·{" "}
                    {r.fixture ?? "No fixture assigned"} · {label(r.reason)} ·{" "}
                    {date(r.created_at)}
                  </p>
                ))
              ) : (
                <p>No quarantined imports reported.</p>
              )}
            </details>
            <details>
              <summary>
                Recent source corrections ({diagnostics.data.corrections.length}
                )
              </summary>
              <p>
                Source revisions require Docked reconciliation. These are not
                confirmations of changed competition results.
              </p>
              {diagnostics.data.corrections.length ? (
                diagnostics.data.corrections.map((r) => (
                  <p key={r.seq}>
                    {r.sport.toUpperCase()} · {r.entity} · Revision {r.revision}{" "}
                    · {label(r.kind)}
                  </p>
                ))
              ) : (
                <p>No source corrections reported.</p>
              )}
            </details>
            <details>
              <summary>
                Recent operational audit ({diagnostics.data.audit.length})
              </summary>
              {diagnostics.data.audit.length ? (
                diagnostics.data.audit.map((r) => (
                  <p key={r.id}>
                    {date(r.at)} · {label(r.action.replace("multisport.", ""))}{" "}
                    · {r.actor}
                  </p>
                ))
              ) : (
                <p>No operational audit events reported.</p>
              )}
            </details>
            {!!diagnostics.data.truncated.length && (
              <p>
                Latest 50 records shown for:{" "}
                {diagnostics.data.truncated.join(", ")}. Full records remain in
                the service audit store.
              </p>
            )}
          </>
        )}
      </details>
      <details>
        <summary>Scheduled jobs and failures</summary>
        {jobs === null ? (
          <p>Job status unavailable. Existing data has not been cleared.</p>
        ) : !jobs.length ? (
          <p>No pending jobs reported.</p>
        ) : (
          jobs.map((j) => (
            <article className="admin-workspace-panel" key={j.id}>
              <h3>
                {j.kind} · {j.state}
              </h3>
              <p>
                Due {date(j.due)} · Attempts {j.attempts}
              </p>
              <p>{j.last_error ?? "No error reported"}</p>
              {retry && (
                <form action={retry}>
                  <input type="hidden" name="job_id" value={j.id} />
                  <input type="hidden" name="request_id" value={requestId} />
                  <label>
                    Retry reason
                    <textarea
                      name="reason"
                      minLength={10}
                      maxLength={1000}
                      required
                    />
                  </label>
                  <button
                    className="button"
                    type="submit"
                    disabled={j.state === "running"}
                  >
                    Retry job
                  </button>
                </form>
              )}
            </article>
          ))
        )}
      </details>
      <p>
        Retries are owner-authorised and audited. A heartbeat is not proof of a
        successful hosted provider import.
      </p>
    </section>
  );
}
