"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { CommunityModeration } from "@/core/community-social";
import { communityAction } from "./social-interactions";
export function ModerationPanel({
  data,
  canWrite,
}: {
  data: CommunityModeration;
  canWrite: boolean;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  async function moderate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await communityAction({
        action: "moderate",
        reportId: d.get("reportId") || undefined,
        targetType: d.get("targetType"),
        targetId: d.get("targetId"),
        decision: d.get("decision"),
        reason: d.get("reason"),
      });
      setMessage(
        "Audited moderation action recorded. Reload to review the queue.",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action not confirmed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="app-state-banner">
        Moderation controls commentary, media and account participation. It
        cannot change a locked Edge or its settlement. Corrections use the
        separate integrity workflow.
      </p>
      <h2>Reports</h2>
      {data.reports.length ? (
        data.reports.map((r) => (
          <section className="app-panel" key={r.id}>
            <h3>{r.reason.replaceAll("_", " ")}</h3>
            <p>{r.details}</p>
            <p className="small-note">
              {r.targetType} · {r.targetId} · {r.status} · {r.createdAt}
            </p>
            {canWrite && (
              <form className="app-form" onSubmit={moderate}>
                <input type="hidden" name="reportId" value={r.id} />
                <input type="hidden" name="targetId" value={r.targetId} />
                <input type="hidden" name="targetType" value={r.targetType} />
                <label>
                  Action
                  <select name="decision">
                    {[
                      "dismiss",
                      "remove",
                      "warn",
                      "restrict",
                      "suspend",
                      "restore",
                      "escalate",
                    ].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Audited reason
                  <textarea
                    name="reason"
                    required
                    minLength={12}
                    maxLength={1000}
                  />
                </label>
                <button className="button" disabled={busy}>
                  Record moderation action
                </button>
              </form>
            )}
          </section>
        ))
      ) : (
        <p>No report records are available in this view.</p>
      )}
      <h2>Media review</h2>
      {data.media.length ? (
        data.media.map((m) => (
          <section key={m.id} className="app-panel">
            <p>
              {m.alt} · {m.status}
            </p>
            {m.url && (
              <img
                className="social-photo"
                src={m.url}
                width={m.width}
                height={m.height}
                alt={m.alt}
              />
            )}
            <p className="small-note">{m.id}</p>
            {canWrite && (
              <form className="app-form" onSubmit={moderate}>
                <input type="hidden" name="targetId" value={m.id} />
                <input type="hidden" name="targetType" value="media" />
                <label>
                  Media action
                  <select name="decision">
                    <option value="reject">Reject</option>
                    <option value="approve">Approve for social display</option>
                  </select>
                </label>
                <label>
                  Review reason
                  <textarea
                    name="reason"
                    required
                    minLength={12}
                    maxLength={1000}
                  />
                </label>
                <p className="form-help">
                  Approval permits social display only. A screenshot cannot
                  verify odds or settle a record.
                </p>
                <button className="button" disabled={busy}>
                  Record image decision
                </button>
              </form>
            )}
          </section>
        ))
      ) : (
        <p>No quarantined media are available.</p>
      )}
      <p role="status">{message}</p>
    </>
  );
}
export function AdminReadPanel({
  endpoint,
  title,
}: {
  endpoint: string;
  title: string;
}) {
  const [data, setData] = useState<unknown>(null),
    [message, setMessage] = useState("Loading authorised records…");
  useEffect(() => {
    let live = true;
    void fetch(endpoint, { cache: "no-store" })
      .then(async (r) => {
        const v = await r.json();
        if (!live) return;
        if (!r.ok) {
          setMessage(v.error ?? "Records unavailable.");
          return;
        }
        setData(v);
        setMessage("");
      })
      .catch(() => {
        if (live)
          setMessage(
            "Service unavailable. No operational figures have been substituted.",
          );
      });
    return () => {
      live = false;
    };
  }, [endpoint]);
  return (
    <section className="app-panel">
      <h2>{title}</h2>
      {message && <p role="status">{message}</p>}
      {data !== null && (
        <pre className="audit-json" tabIndex={0} aria-label={title}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </section>
  );
}
export { DisabledBenefitsDraft } from "./benefits-draft";
