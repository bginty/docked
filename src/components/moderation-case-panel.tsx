"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type {
  ModerationCaseMutation,
  ModerationCaseView,
} from "@/core/moderation-cases";
export function ModerationCasePanel({ reportId }: { reportId: string }) {
  const [view, setView] = useState<ModerationCaseView | null>(null);
  const [assignee, setAssignee] = useState("");
  const [severity, setSeverity] =
    useState<ModerationCaseMutation["severity"]>("untriaged");
  const [status, setStatus] =
    useState<ModerationCaseMutation["status"]>("triage");
  const [resolution, setResolution] =
    useState<ModerationCaseMutation["resolution"]>("pending");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState<ModerationCaseMutation | null>(
    null,
  );
  const inFlight = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function accept(data: ModerationCaseView) {
    setView(data);
    setAssignee(data.case?.assignee ?? (data.canAssign ? "" : data.actor));
    setSeverity(data.case?.severity ?? "untriaged");
    setStatus(data.case?.status ?? "triage");
    setResolution(data.case?.resolution ?? "pending");
    setReason("");
  }
  async function read() {
    const response = await fetch(
      `/api/admin/moderation-cases?id=${encodeURIComponent(reportId)}`,
      { cache: "no-store" },
    );
    const data = await response.json();
    if (!response.ok) throw Error(data.error ?? "Case unavailable");
    if (mounted.current) accept(data);
  }
  async function reload() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      await read();
    } catch (error) {
      if (mounted.current)
        setMessage(error instanceof Error ? error.message : "Case unavailable");
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function change(
    action: ModerationCaseMutation["action"],
    retry?: ModerationCaseMutation,
  ) {
    if (inFlight.current || !view) return;
    const payload: ModerationCaseMutation = retry ?? {
      requestId: crypto.randomUUID(),
      reportId,
      version: view.case?.version ?? 0,
      action,
      assignee: assignee || null,
      severity,
      status,
      resolution,
      reason: reason.trim(),
    };
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/moderation-cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!mounted.current) return;
      if (!response.ok) {
        setUncertain(response.status >= 500 ? payload : null);
        setMessage(data.error ?? "Case save failed");
        return;
      }
      setUncertain(null);
      setView({ ...view, case: data });
      setReason("");
      setMessage("Case action recorded. Member assets are unchanged.");
      await read().catch(() => {
        if (mounted.current)
          setMessage("Case saved; reload to refresh its history.");
      });
    } catch {
      if (mounted.current) {
        setUncertain(payload);
        setMessage(
          "Outcome uncertain. Retry the same case request before continuing.",
        );
      }
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const locked = busy || Boolean(uncertain);
  const dirty = Boolean(
    view?.case &&
    (assignee !== (view.case.assignee ?? "") ||
      severity !== view.case.severity ||
      status !== view.case.status ||
      resolution !== view.case.resolution),
  );
  const canEdit = Boolean(
    view?.canWrite &&
    (view.canAssign ||
      !view.case?.assignee ||
      view.case.assignee === view.actor),
  );
  return (
    <section
      aria-label="Case assignment and review"
      style={
        {
          "--ink": "#f5f7ff",
          "--muted": "#b5c5d9",
          "--brand-white": "#041424",
          "--surface-card": "#041424",
          "--surface-info": "#102c47",
          "--surface-info-hover": "#163b64",
          "--border-control": "#29405a",
          overflowWrap: "anywhere",
        } as CSSProperties
      }
    >
      <h4>Case assignment & review</h4>
      <p>
        Assignment and severity describe staff triage. Hiding content keeps its
        existing record private while reviewed; it does not change cards or
        wallet balances.
      </p>
      <button
        type="button"
        className="button ghost"
        disabled={locked}
        onClick={() => void reload()}
      >
        {view ? "Discard changes and reload case" : "Open case workflow"}
      </button>
      <p role="status">{message}</p>
      {uncertain && (
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void change(uncertain.action, uncertain)}
        >
          Retry same case request
        </button>
      )}
      {view && (
        <>
          <p>
            Report status: {view.reportStatus} · Case version{" "}
            {view.case?.version ?? 0}
          </p>
          {view.case?.content_hold && (
            <p>
              Content is held for review. Review due{" "}
              {view.case.review_due_at
                ? new Date(view.case.review_due_at).toLocaleString()
                : "unavailable"}
              . Releasing this case cannot override another report's hold.
            </p>
          )}
          <fieldset
            className="app-form"
            disabled={locked || !canEdit}
            style={{ minWidth: 0, border: 0, padding: 0 }}
          >
            <legend>Staff case metadata</legend>
            <label>
              Assigned reviewer
              <select
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                disabled={!view.canAssign}
              >
                <option value="">Unassigned</option>
                {view.staff.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} · {staff.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            {!view.canAssign && canEdit && !view.case?.assignee && (
              <p>Saving claims this unassigned case for your review.</p>
            )}
            <label>
              Severity
              <select
                value={severity}
                onChange={(event) =>
                  setSeverity(event.target.value as typeof severity)
                }
              >
                {["untriaged", "low", "medium", "high", "urgent"].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Case status
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as typeof status);
                  setResolution(
                    event.target.value === "resolved" ? "no_action" : "pending",
                  );
                }}
              >
                {["triage", "investigating", "escalated", "resolved"].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </label>
            {status === "resolved" && (
              <label>
                Resolution
                <select
                  value={resolution}
                  onChange={(event) =>
                    setResolution(event.target.value as typeof resolution)
                  }
                >
                  <option value="no_action">No further action</option>
                  <option value="action_taken">
                    Action taken through existing controls
                  </option>
                </select>
              </label>
            )}
            <label>
              Audited case reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={12}
                maxLength={1000}
                rows={3}
              />
            </label>
            <div className="actions">
              <button
                className="button"
                type="button"
                disabled={reason.trim().length < 12}
                onClick={() => void change("update")}
              >
                Save case review
              </button>
              {view.case &&
                !dirty &&
                status !== "resolved" &&
                ["post", "comment"].includes(view.targetType) && (
                  <button
                    className="button ghost"
                    type="button"
                    disabled={
                      reason.trim().length < 12 ||
                      (!view.case.content_hold &&
                        !["visible", "review"].includes(
                          view.targetStatus ?? "",
                        ))
                    }
                    onClick={() =>
                      void change(view.case!.content_hold ? "restore" : "hide")
                    }
                  >
                    {view.case.content_hold
                      ? "Release this content hold"
                      : "Hide while under review"}
                  </button>
                )}
              {view.case?.content_hold && !dirty && (
                <button
                  className="button ghost"
                  type="button"
                  disabled={reason.trim().length < 12}
                  onClick={() => void change("review_hold")}
                >
                  Record hold review · next review within 90 days
                </button>
              )}
            </div>
          </fieldset>
          {!canEdit && (
            <p>
              Read-only case access. Ask an authorised administrator to review
              assignment.
            </p>
          )}
          <details>
            <summary>Case history · latest 50 actions</summary>
            <ol>
              {view.events.map((event) => (
                <li key={event.version}>
                  <strong>
                    Version {event.version} · {event.action}
                  </strong>
                  <p>{event.reason}</p>
                  <small>
                    {new Date(event.created_at).toLocaleString()} · Staff record{" "}
                    {event.actor}
                  </small>
                </li>
              ))}
            </ol>
          </details>
        </>
      )}
    </section>
  );
}
