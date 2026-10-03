import Link from "next/link";
import { requireRole } from "@/server/auth";
import {
  scannerDashboard,
  candidateQueue,
  candidateDetail,
  dailyOperations,
} from "@/server/edge-scanner";
import { AppShell } from "./app-shell";
import { AppHeading, CommunityEmpty } from "./community-basics";
import { ApiForm } from "./forms";
import {
  ManualCandidateForm,
  ScannerScheduleForm,
  CandidateReview,
} from "./scanner-controls";
import { LocalTimestamp } from "./local-timestamp";
import {
  scannerStatuses,
  type ScannerCandidate,
  type ScannerDashboard,
  type ScannerStatus,
} from "@/core/edge-scanner";
import { recognitionRuleV1 } from "@/core/community-recognition";
import { recognitionAudit } from "@/server/community-recognition";
import { ScannerDataOnly } from "./scanner-data-only";
const labels: Record<string, string> = {
  events: "Events",
  markets: "Markets",
  fresh: "Fresh markets",
  stale: "Stale markets",
  candidates: "Candidates",
  qualified: "Qualified",
  rejected: "Rejected",
  errors: "Errors",
};
export function ScannerSummary({ data }: { data: ScannerDashboard }) {
  return (
    <section className="app-panel">
      <h2>Scanner status: {data.status}</h2>
      <p>
        {data.configured
          ? "Durable server jobs; current cached data only. Approval remains a separate operation."
          : "Scanner is NOT_CONFIGURED. No scan statistics are inferred."}
      </p>
      {data.dataOnly && <ScannerDataOnly data={data.dataOnly} />}
      <dl className="scanner-metrics">
        <div>
          <dt>Provider</dt>
          <dd>{data.provider ?? "Not configured"}</dd>
        </div>
        <div>
          <dt>Quota remaining</dt>
          <dd>{data.quotaRemaining ?? "Unknown"}</dd>
        </div>
        <div>
          <dt>Last successful scan</dt>
          <dd>
            {data.lastSuccessfulScan ? (
              <LocalTimestamp value={data.lastSuccessfulScan} />
            ) : (
              "No successful scan"
            )}
          </dd>
        </div>
        <div>
          <dt>Next scheduled scan</dt>
          <dd>
            {data.nextScheduledScan ? (
              <LocalTimestamp value={data.nextScheduledScan} />
            ) : (
              "Not scheduled"
            )}
          </dd>
        </div>
        {Object.entries(data.metrics).map(([key, value]) => (
          <div key={key}>
            <dt>{labels[key] ?? key}</dt>
            <dd>{value ?? "Unavailable"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
export function ScannerCandidateCard({
  candidate: c,
  detail = false,
}: {
  candidate: ScannerCandidate;
  detail?: boolean;
}) {
  const fields: [string, string][] = [
    ["Research probability", c.probability],
    ["Docked fair odds", c.fairOdds],
    ["Minimum acceptable price", c.minimumOdds],
    ["Required EV", c.requiredEV],
    ["Captured scan reference", c.currentMarketReference],
    ["Estimated EV", c.estimatedEV],
    ["Independent sources", String(c.sourceCount)],
    ["Source age at render", `${c.dataAgeSeconds}s`],
    ["Strategy version", c.strategyVersion],
    ["Model version", c.modelVersion],
  ];
  return (
    <article className="app-panel scanner-candidate">
      <p className="eyebrow">
        {c.purpose.toUpperCase()} · {c.status.replaceAll("_", " ")}
      </p>
      <h2>
        {detail ? (
          c.event
        ) : (
          <Link href={`/admin/candidate-edges/${c.id}`}>{c.event}</Link>
        )}
      </h2>
      <p>
        {c.sport} · {c.competition} · {c.market}
      </p>
      <h3>{c.selection}</h3>
      <dl className="scanner-metrics">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p>
        Scanned <LocalTimestamp value={c.scannedAt} /> · Starts{" "}
        <LocalTimestamp value={c.startAt} /> · Evidence expires{" "}
        <LocalTimestamp value={c.expiresAt} />
      </p>
      <p className="form-help">
        Research estimates are not validated performance or guaranteed profit.
        Approval always reloads the current evidence.
      </p>
      {c.warnings.length > 0 && (
        <ul>
          {c.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {c.publicationId && (
        <p>
          Canonical publication recorded: <code>{c.publicationId}</code>
        </p>
      )}
    </article>
  );
}
export async function ScannerAdminPage({
  section,
  query = {},
  id,
}: {
  section: "scanner" | "candidates" | "daily";
  query?: Record<string, string | undefined>;
  id?: string;
}) {
  let staff;
  try {
    staff = await requireRole(["owner", "admin", "analyst", "auditor"]);
  } catch {
    return (
      <div className="community-public">
        <AppHeading
          eyebrow="PRIVATE RESEARCH OPERATIONS"
          title="Verified staff access required."
        />
        <CommunityEmpty title="Staff role and MFA required">
          Scanner schedules, research estimates and review controls are private.
          No operational payload is available anonymously.
        </CommunityEmpty>
        <Link className="button" href="/app/login">
          Sign in
        </Link>
      </div>
    );
  }
  const canWrite = staff.role !== "auditor",
    canManage = ["owner", "admin"].includes(staff.role);
  try {
    const dashboard =
      section !== "candidates" ? await scannerDashboard() : null;
    const candidate =
      id && /^[0-9a-f-]{36}$/i.test(id) ? await candidateDetail(id) : null;
    const queue =
      section === "candidates" && !id
        ? await candidateQueue({
            status: scannerStatuses.includes(query.status as ScannerStatus)
              ? (query.status as ScannerStatus)
              : undefined,
            cursor:
              query.cursor && /^[0-9a-f-]{36}$/i.test(query.cursor)
                ? query.cursor
                : undefined,
          })
        : null;
    const daily = section === "daily" ? await dailyOperations() : null;
    const recognition = section === "daily" ? await recognitionAudit() : null;
    return (
      <AppShell authenticated>
        <AppHeading
          eyebrow="PRIVATE RESEARCH OPERATIONS"
          title={
            section === "scanner"
              ? "Edge Scanner"
              : section === "daily"
                ? "Daily operations"
                : "Candidate Edges"
          }
        >
          Research, paper and live records remain distinct. No external emails
          are sent by these controls.
        </AppHeading>
        <nav className="scanner-nav" aria-label="Research operations">
          <Link href="/admin/edge-scanner">Scanner</Link>
          <Link href="/admin/candidate-edges">Candidate queue</Link>
          <Link href="/admin/daily">Daily summary</Link>
          <Link href="/admin/data-health">Data health</Link>
          <Link href="/admin">All operations</Link>
        </nav>
        {dashboard && <ScannerSummary data={dashboard} />}
        {section === "scanner" && dashboard && (
          <>
            <section className="app-panel">
              <h2>Installed schedules</h2>
              {dashboard.schedules.length ? (
                dashboard.schedules.map((s) => (
                  <div key={s.id}>
                    <h3>{s.id}</h3>
                    <p>
                      {s.sport} · {s.competition} · {s.purpose} ·{" "}
                      {s.enabled ? "Enabled" : "Paused"} · base{" "}
                      {s.intervalSeconds}s / near event {s.nearIntervalSeconds}s
                    </p>
                    {canWrite && (
                      <ApiForm
                        endpoint="/api/admin/scanner"
                        action="run_now"
                        defaults={{ scheduleId: s.id }}
                        submit="Queue scan now"
                      >
                        <p className="form-help">
                          Uses the durable worker and approved cached data. No
                          publication.
                        </p>
                      </ApiForm>
                    )}
                  </div>
                ))
              ) : (
                <p>No schedules have been configured.</p>
              )}
            </section>
            {canManage && (
              <>
                <section className="app-panel">
                  <h2>Global scanner control</h2>
                  <ApiForm
                    endpoint="/api/admin/scanner"
                    action={dashboard.status === "PAUSED" ? "resume" : "pause"}
                    submit={
                      dashboard.status === "PAUSED"
                        ? "Request scanner resume"
                        : "Pause scanner"
                    }
                  >
                    <label>
                      Operational reason
                      <textarea
                        name="reason"
                        minLength={12}
                        maxLength={1000}
                        required
                      />
                    </label>
                    <p className="form-help">
                      Deployment enablement and all provider/strategy gates
                      still apply.
                    </p>
                  </ApiForm>
                </section>
                <ScannerScheduleForm />
              </>
            )}
            <section className="app-panel">
              <h2>Recent runs</h2>
              {dashboard.runs.length ? (
                <ul>
                  {dashboard.runs.map((run) => (
                    <li key={run.id}>
                      {run.status} · <LocalTimestamp value={run.startedAt} /> ·
                      qualified {run.metrics.qualified ?? "Unavailable"}, errors{" "}
                      {run.metrics.errors ?? "Unavailable"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No recorded scans yet.</p>
              )}
            </section>
          </>
        )}
        {section === "candidates" && (
          <>
            {!id && (
              <form className="form-stack" method="get">
                <label>
                  Candidate status
                  <select name="status" defaultValue={query.status ?? ""}>
                    <option value="">All states</option>
                    {scannerStatuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>
                <button className="button">Filter queue</button>
              </form>
            )}
            {candidate ? (
              <>
                <ScannerCandidateCard candidate={candidate} detail />
                {canWrite && <CandidateReview candidate={candidate} />}
              </>
            ) : id ? (
              <CommunityEmpty title="Candidate unavailable">
                This ID is not available for review.
              </CommunityEmpty>
            ) : queue?.candidates.length ? (
              queue.candidates.map((c) => (
                <ScannerCandidateCard key={c.id} candidate={c} />
              ))
            ) : (
              <div className="edge-quiet-state">
                <strong>No candidates in this view.</strong>
                <p>
                  Fresh approved data and a research strategy are required. No
                  candidates are created to fill the queue.
                </p>
              </div>
            )}
            {queue?.nextCursor && (
              <Link
                className="button ghost"
                href={`/admin/candidate-edges?${new URLSearchParams({ cursor: queue.nextCursor, ...(query.status ? { status: query.status } : {}) })}`}
              >
                More candidates
              </Link>
            )}
            {canWrite && !id && <ManualCandidateForm />}
          </>
        )}
        {daily && (
          <>
            <section className="app-panel">
              <h2>Observed operational records</h2>
              <p>
                As of <LocalTimestamp value={daily.asOf} />. Stored event/market
                totals do not establish current provider health.
              </p>
              <dl className="scanner-metrics">
                {Object.entries(daily.counts).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replaceAll("_", " ")}</dt>
                    <dd>{String(value ?? "Unavailable")}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section className="app-panel">
              <h2>Strategy and forward paper</h2>
              {daily.strategies.map((s) => (
                <p key={s.id}>
                  {s.id} · {s.state} · Research validation{" "}
                  {s.researchValidated ? "recorded" : "pending"} · Forward paper{" "}
                  {s.paperStarted ? "running" : "not running"}
                </p>
              ))}
              <Link href="/admin/forward-paper">
                Full forward-paper evidence
              </Link>
            </section>
            <section className="app-panel">
              <h2>Community recognition review</h2>
              {recognition && (
                <>
                  <p>
                    Eligible candidate records evaluated:{" "}
                    {recognition.candidatesEvaluated}. Trending display entries:{" "}
                    {recognition.trendingShown}. Suspicious bursts held:{" "}
                    {recognition.burstReviewIds.length}.
                  </p>
                  {recognition.burstReviewIds.length > 0 && (
                    <ul>
                      {recognition.burstReviewIds.map((id) => (
                        <li key={id}>
                          <Link href={`/community/edges/${id}`}>
                            Inspect held community record {id}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p>
                    {recognition.weeklyCandidate
                      ? "A complete-week candidate is eligible for snapshot review."
                      : "No complete-week candidate currently meets the recognition guards."}
                  </p>
                </>
              )}
              <p>
                {recognitionRuleV1.version}. A snapshot retains the first
                complete-week decision; corrected or hidden records are
                withheld. No winner or monetary award can be typed into this
                form.
              </p>
              {canWrite && (
                <ApiForm
                  endpoint="/api/admin/community-recognition"
                  action="snapshot"
                  submit="Capture completed-week recognition"
                >
                  <p>
                    Uses canonical standard records and all eligibility guards.
                  </p>
                </ApiForm>
              )}
              <Link href="/admin/community/reports">Moderation reports</Link>
            </section>
          </>
        )}
        {dashboard && (
          <section className="app-panel">
            <h2>Operational alerts</h2>
            {dashboard.alerts.length ? (
              <ul>
                {dashboard.alerts.map((alert) => (
                  <li key={alert.id}>
                    <strong>{alert.severity}: </strong>
                    {alert.message}
                    {alert.href && <Link href={alert.href}> Review</Link>}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No current recorded alerts. Missing services must still be
                configured.
              </p>
            )}
          </section>
        )}
      </AppShell>
    );
  } catch {
    return (
      <AppShell authenticated>
        <AppHeading
          eyebrow="PRIVATE RESEARCH OPERATIONS"
          title="Operations temporarily unavailable"
        />
        <CommunityEmpty title="Current records could not be loaded">
          No counts or approvals have been inferred. Retry after the service is
          restored.
        </CommunityEmpty>
        <Link href="/admin">Return to operations</Link>
      </AppShell>
    );
  }
}
