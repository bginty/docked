"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { boundedFetch } from "@/core/bounded-request";
import type { CommunityModeration } from "@/core/community-social";
import {
  moderationActions,
  filterModerationReports,
} from "@/core/community-social";
import { LocalTimestamp } from "./local-timestamp";
import { communityAction } from "./social-interactions";
export function ModerationPanel({
  data,
  canWrite,
  initialKind,
}: {
  data: CommunityModeration;
  canWrite: boolean;
  initialKind?: "content" | "members";
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const router = useRouter();
  const [status, setStatus] = useState(initialKind ? "outstanding" : "");
  const [type, setType] = useState(
    initialKind === "members"
      ? "profile"
      : initialKind === "content"
        ? "content"
        : "",
  );
  const [search, setSearch] = useState("");
  const reports = filterModerationReports(data.reports, {
    status,
    type,
    search,
  });
  async function moderate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWrite || sending.current) return;
    const d = new FormData(e.currentTarget);
    sending.current = true;
    setBusy(true);
    setMessage("");
    try {
      await communityAction({
        action: "moderate",
        reportId: d.get("reportId") || undefined,
        targetType: d.get("targetType"),
        targetId: d.get("targetId"),
        decision: d.get("decision"),
        reason: d.get("reason"),
      });
      setMessage("Audited moderation action recorded.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action not confirmed.");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <p className="app-state-banner">
        Moderation controls commentary, media and account participation. It
        cannot change card ownership, card scarcity or competition scores.
      </p>
      <section className="moderation-queue" aria-label="Moderation queue">
        <div className="section-row">
          <h2>Report queue</h2>
          <span className="small-note">
            {canWrite ? "Authorised reviewer" : "Read-only access"}
          </span>
        </div>
        <div className="moderation-summary" aria-label="Loaded queue summary">
          {[
            ["Open", data.reports.filter((r) => r.status === "open").length],
            [
              "Escalated",
              data.reports.filter((r) => r.status === "escalated").length,
            ],
            [
              "Reviewed",
              data.reports.filter((r) =>
                ["actioned", "dismissed"].includes(r.status),
              ).length,
            ],
            ["Media waiting", data.media.length],
          ].map(([label, count]) => (
            <div className="app-panel" key={label}>
              <span>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
        <p className="small-note">
          Counts cover up to 100 loaded reports and 50 queued images. Escalated
          and open reports appear first.
        </p>
        <div className="moderation-filters app-form">
          <label>
            Search reports
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Member, content, reason or reference"
            />
          </label>
          <label>
            Report status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="outstanding">Open & escalated</option>
              {["open", "escalated", "actioned", "dismissed"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Content type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              <option value="content">Posts, comments & media</option>
              {["post", "comment", "profile", "media"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {(search || status || type) && (
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                setSearch("");
                setStatus("");
                setType("");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        <p role="status">
          {reports.length} of {data.reports.length} loaded reports
        </p>
        {reports.length ? (
          reports.map((r) => (
            <section className="app-panel" key={r.id}>
              <div className="section-row">
                <h3>{r.reason.replaceAll("_", " ")}</h3>
                <span className="small-note">
                  {r.status} · {r.targetType}
                </span>
              </div>
              <p>{r.details}</p>
              <p className="small-note">
                Reported <LocalTimestamp value={r.createdAt} /> ·{" "}
                {r.reporter
                  ? `${r.reporter.name} (@${r.reporter.handle})`
                  : "Reporter unavailable"}
              </p>
              <details className="moderation-report-details">
                <summary>
                  Review report · {r.reason.replaceAll("_", " ")}
                </summary>
                <h4>Current reported content</h4>
                {r.target?.content ? (
                  <blockquote className="social-body">
                    {r.target.content}
                  </blockquote>
                ) : (
                  <p>
                    Content is unavailable or was removed. Original content is
                    not stored in this report.
                  </p>
                )}
                {r.target?.status && (
                  <p className="small-note">
                    Current content status: {r.target.status}
                  </p>
                )}
                <p className="small-note">
                  Content shown is the current record, not an immutable
                  report-time snapshot.
                </p>
                <h4>Decision history</h4>
                {r.history?.length ? (
                  <ol className="moderation-history">
                    {r.history.map((event) => (
                      <li key={event.id}>
                        <strong>
                          {event.decision} · {event.actor}
                        </strong>
                        <p>{event.reason}</p>
                        <LocalTimestamp value={event.createdAt} />
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>No recorded moderation decisions for this target.</p>
                )}
                {!!r.history?.length && (
                  <p className="small-note">
                    Latest {r.history.length} decisions for this content, up to
                    20.
                  </p>
                )}
                <p className="small-note">
                  Report {r.id} · Target {r.targetId}
                </p>
                {canWrite && (
                  <form className="app-form" method="post" onSubmit={moderate}>
                    <input type="hidden" name="reportId" value={r.id} />
                    <input type="hidden" name="targetId" value={r.targetId} />
                    <input
                      type="hidden"
                      name="targetType"
                      value={r.targetType}
                    />
                    <label>
                      Action
                      <select name="decision" defaultValue="dismiss">
                        {moderationActions(r.targetType).map((v) => (
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
              </details>
            </section>
          ))
        ) : (
          <p>
            {data.reports.length
              ? "No reports match these filters."
              : "No report records are available in this view."}
          </p>
        )}
      </section>
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
              <form className="app-form" method="post" onSubmit={moderate}>
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
                  change card ownership or competition scores.
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
    [message, setMessage] = useState("Loading authorised records…"),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setMessage("Loading authorised records…");
    void boundedFetch(endpoint, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const v = await r.json();
        if (controller.signal.aborted) return;
        if (!r.ok) {
          setMessage(v.error ?? "Records unavailable.");
          return;
        }
        setData(v);
        setMessage("");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            "Service unavailable. No operational figures have been substituted.",
          );
      });
    return () => {
      controller.abort();
    };
  }, [endpoint, attempt]);
  return (
    <section className="app-panel">
      <h2>{title}</h2>
      {message && <p role="status">{message}</p>}
      {message && message !== "Loading authorised records…" && (
        <button
          className="button ghost"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Retry records
        </button>
      )}
      {data !== null && (
        <pre className="audit-json" tabIndex={0} aria-label={title}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </section>
  );
}
