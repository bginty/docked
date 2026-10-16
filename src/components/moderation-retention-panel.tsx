"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { z } from "zod";
import {
  moderationRetentionMutation,
  type RetentionView,
} from "@/core/moderation-retention";
import { boundedFetch } from "@/core/bounded-request";
type Mutation = z.infer<typeof moderationRetentionMutation>;
export function ModerationRetentionPanel() {
  const [view, setView] = useState<RetentionView | null>(null),
    [selected, setSelected] = useState(""),
    [reason, setReason] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState<Mutation | null>(null);
  const flight = useRef(false),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function read(page: number) {
    const response = await boundedFetch(
      `/api/admin/moderation-retention?page=${page}`,
      { cache: "no-store" },
    );
    const data = await response.json();
    if (!response.ok) throw Error(data.error ?? "Retention unavailable");
    if (mounted.current) {
      setView(data);
      setSelected("");
      setReason("");
      setConfirmation("");
    }
  }
  async function reload(page = 1) {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setMessage("");
    try {
      await read(page);
    } catch (e) {
      if (mounted.current)
        setMessage(e instanceof Error ? e.message : "Retention unavailable");
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const record = view?.records.find(
    (row) => `${row.target_type}:${row.target_id}` === selected,
  );
  async function change(action: Mutation["action"], retry?: Mutation) {
    if (flight.current || !record) return;
    const payload = retry ?? {
      requestId: crypto.randomUUID(),
      targetType: record.target_type,
      targetId: record.target_id,
      version: record.version,
      action,
      reason: reason.trim(),
      confirmation,
    };
    if (!moderationRetentionMutation.safeParse(payload).success) {
      setMessage(
        "Provide a reason of at least 12 characters and the required confirmation.",
      );
      return;
    }
    flight.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await boundedFetch("/api/admin/moderation-retention", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!mounted.current) return;
      if (!response.ok) {
        setUncertain(response.status >= 500 ? payload : null);
        setMessage(data.error ?? "Review failed");
        return;
      }
      setUncertain(null);
      setMessage("Audited evidence review saved.");
      await read(view?.page ?? 1);
    } catch (e) {
      if (mounted.current) {
        setUncertain(payload);
        setMessage(
          e instanceof Error
            ? e.message
            : "Outcome uncertain. Retry the same review.",
        );
      }
    } finally {
      flight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <section
      className="app-panel"
      aria-label="Evidence retention review"
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
          borderColor: "#29405a",
        } as CSSProperties
      }
    >
      <div className="section-row">
        <h2>Evidence retention review</h2>
        <button
          className="button ghost"
          disabled={busy || !!uncertain}
          onClick={() => reload(view?.page ?? 1)}
        >
          {view ? "Reload retention queue" : "Open retention queue"}
        </button>
      </div>
      <p className="small-note">
        Removed content stays hidden. Reviews are due within 90 days under the
        approved beta privacy policy. Author deletion still takes precedence.
      </p>
      {message && <p role="status">{message}</p>}
      {view && (
        <>
          <p>
            {view.records.length === 0
              ? "No retained evidence awaiting review."
              : "Select evidence to review its existing hold."}
          </p>
          <ul>
            {view.records.map((row) => (
              <li key={`${row.target_type}:${row.target_id}`}>
                <button
                  className="button ghost"
                  disabled={busy || !!uncertain}
                  onClick={() => {
                    setSelected(`${row.target_type}:${row.target_id}`);
                    setReason("");
                    setConfirmation("");
                  }}
                >
                  {row.target_type} · {row.target_id.slice(0, 8)} · Review by{" "}
                  {row.review_due_at
                    ? new Date(row.review_due_at).toLocaleDateString()
                    : "Unavailable"}
                </button>
              </li>
            ))}
          </ul>
          {record && (
            <div>
              <p>{record.reason}</p>
              <p className="small-note">
                Policy {record.policy_version} · Version {record.version}
              </p>
              {record.target_type === "media" && (
                <a
                  className="button ghost"
                  href={`/api/community?view=media&id=${encodeURIComponent(record.target_id)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View retained image
                </a>
              )}
              {view.canManage ? (
                <fieldset
                  disabled={busy || !!uncertain}
                  className="form-stack"
                  style={{
                    border: 0,
                    padding: 0,
                    margin: 0,
                    minWidth: 0,
                    width: "100%",
                  }}
                >
                  <label>
                    Review reason
                    <textarea
                      aria-label="Evidence review reason"
                      minLength={12}
                      maxLength={1000}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <div className="actions">
                    <button
                      className="button ghost"
                      disabled={reason.trim().length < 12}
                      onClick={() => change("review")}
                    >
                      Continue hold · review in 90 days
                    </button>
                    <button
                      className="button ghost"
                      disabled={reason.trim().length < 12}
                      onClick={() => change("restore")}
                    >
                      Restore visibility
                    </button>
                  </div>
                  <label>
                    Type ERASE to permanently erase this evidence
                    <input
                      value={confirmation}
                      maxLength={10}
                      onChange={(e) => setConfirmation(e.target.value)}
                    />
                  </label>
                  <button
                    className="button ghost"
                    disabled={
                      reason.trim().length < 12 || confirmation !== "ERASE"
                    }
                    onClick={() => change("erase")}
                  >
                    Confirm evidence erasure
                  </button>
                </fieldset>
              ) : (
                <p>
                  Read-only access. An owner or administrator must review
                  retention.
                </p>
              )}
            </div>
          )}
          {uncertain && (
            <button
              className="button"
              disabled={busy}
              onClick={() => change(uncertain.action, uncertain)}
            >
              Retry same review
            </button>
          )}
          <div className="actions">
            <button
              className="button ghost"
              disabled={busy || !!uncertain || view.page <= 1}
              onClick={() => reload(view.page - 1)}
            >
              Previous evidence page
            </button>
            <button
              className="button ghost"
              disabled={busy || !!uncertain || !view.hasMore}
              onClick={() => reload(view.page + 1)}
            >
              Next evidence page
            </button>
          </div>
        </>
      )}
    </section>
  );
}
