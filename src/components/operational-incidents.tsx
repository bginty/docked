"use client";
import { useState } from "react";
type Incident = {
  code: string;
  severity: string;
  state: string;
  observed_count: number;
  revision: number;
  last_seen: string;
};
type Event = {
  id: number;
  code: string;
  action: string;
  reason: string | null;
  created_at: string;
};
type Delivery = {
  id: string;
  state: string;
  attempts: number;
  phase: string;
  outcome: string;
  deliveryVerified: false;
};
export type IncidentReport = {
  incidents: Incident[];
  events: Event[];
  delivery: Delivery[];
  emailEnabled: boolean;
  recipient: string;
  custodian: string;
  channel: string;
};
export function OperationalIncidents({ initial }: { initial: IncidentReport }) {
  const [report, setReport] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [filter, setFilter] = useState("active"),
    [selected, setSelected] = useState<Incident | null>(null),
    [reason, setReason] = useState("");
  const [reportCode, setReportCode] = useState("security_auth_incident"),
    [reportReason, setReportReason] = useState("");
  async function command(action: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "report"
            ? { code: reportCode, reason: reportReason }
            : ["refresh", "drill"].includes(action)
              ? {}
              : { code: selected?.code, revision: selected?.revision, reason }),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      setReport(data);
      setSelected(null);
      setReason("");
      setReportReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please reload.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="scoring-review operational-incidents">
      <h1>Operational incidents</h1>
      <p>
        {report.custodian} · {report.channel} · {report.recipient}
      </p>
      <p>
        Email delivery {report.emailEnabled ? "configured" : "disabled"}.
        Provider acceptance alone does not prove inbox delivery.
      </p>
      <div className="scoring-controls">
        <button
          className="admin-control"
          disabled={busy}
          onClick={() => void command("refresh")}
        >
          Check current health
        </button>
        <button
          className="admin-control"
          disabled={busy}
          onClick={() => void command("drill")}
        >
          Record delivery drill
        </button>
        <label>
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="active">Active</option>
            <option value="resolved">Resolved</option>
            <option value="all">All incidents</option>
          </select>
        </label>
      </div>
      <p>
        Recording a drill does not send email. Dispatch requires the separately
        approved alert configuration.
      </p>
      <details>
        <summary>Record an operational issue</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void command("report");
          }}
        >
          <label>
            Category
            <select
              value={reportCode}
              onChange={(e) => setReportCode(e.target.value)}
            >
              {[
                "security_auth_incident",
                "database_unavailable",
                "ingestion_failure",
                "unresolved_operational_exception",
              ].map((c) => (
                <option key={c} value={c}>
                  {c.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Evidence · no customer details or secrets
            <textarea
              required
              minLength={12}
              maxLength={600}
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
            />
          </label>
          <button className="admin-control" disabled={busy}>
            Record incident
          </button>
        </form>
        <p>
          Record database outages after service recovers. External uptime
          monitoring is still required during a database outage.
        </p>
      </details>
      {error && <p role="alert">{error}</p>}
      <ul>
        {report.incidents
          .filter(
            (i) =>
              filter === "all" ||
              (filter === "resolved"
                ? i.state === "RESOLVED"
                : i.state !== "RESOLVED"),
          )
          .map((i) => (
            <li key={i.code}>
              <strong>{i.code.replaceAll("_", " ")}</strong> · {i.severity} ·{" "}
              {i.state} · {i.observed_count} observed{" "}
              <button
                className="admin-control"
                onClick={() => {
                  setSelected(i);
                  setReason("");
                }}
              >
                Review
              </button>
            </li>
          ))}
      </ul>
      {!report.incidents.length && (
        <p>
          No recorded incidents. Run a health check to collect the current
          state.
        </p>
      )}
      {selected && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void command("acknowledge");
          }}
        >
          <h2>{selected.code.replaceAll("_", " ")}</h2>
          <label>
            Review evidence · do not include passwords, tokens or customer
            details
            <textarea
              value={reason}
              minLength={12}
              maxLength={600}
              required
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="scoring-controls">
            <button
              className="admin-control"
              disabled={busy || reason.trim().length < 12}
            >
              Acknowledge
            </button>
            <button
              type="button"
              className="admin-control"
              disabled={busy || reason.trim().length < 12}
              onClick={() => void command("resolve")}
            >
              Resolve with evidence
            </button>
            {selected.code === "support_delivery_drill" && (
              <button
                type="button"
                className="admin-control"
                disabled={busy || reason.trim().length < 12}
                onClick={() => void command("confirm_delivery")}
              >
                Confirm inbox receipt
              </button>
            )}
            <button
              type="button"
              className="admin-control"
              onClick={() => setSelected(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <h2>Email attempts</h2>
      <ul>
        {report.delivery.map((d) => (
          <li key={d.id}>
            {d.state} · {d.attempts} attempts · {d.outcome || d.phase} · Inbox
            delivery unverified
          </li>
        ))}
      </ul>
      <h2>Audit trail</h2>
      <ul>
        {report.events.map((e) => (
          <li key={e.id}>
            {e.created_at} · {e.code.replaceAll("_", " ")} · {e.action}
            {e.reason ? ` · ${e.reason}` : ""}
          </li>
        ))}
      </ul>
      <p>
        Resolving an incident changes its review status only. Wallets, recovery
        holds, cards and activation controls are unchanged.
      </p>
    </section>
  );
}
