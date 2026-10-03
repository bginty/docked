"use client";
import { useState, type FormEvent } from "react";
import { communityAction } from "./social-interactions";
import { AdminReadPanel } from "./community-admin";
export function CommunityIntegrityControls({
  snapshot = false,
}: {
  snapshot?: boolean;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [snapshotId, setSnapshotId] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setBusy(true);
    try {
      const result = await communityAction(
        snapshot
          ? {
              action: "snapshot",
              period: d.get("period"),
              sport: d.get("sport") || undefined,
              reason: d.get("reason"),
            }
          : {
              action: "integrity",
              edgeId: d.get("edgeId"),
              status: d.get("status"),
              reason: d.get("reason"),
            },
        snapshot ? "/api/top-docked" : "/api/admin/community-edges",
      );
      setMessage(
        snapshot
          ? `Audited snapshot recorded: ${result.id}`
          : "Integrity decision appended. Locked fields and all results remain unchanged.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Audited action not confirmed.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="app-panel">
      <h2>
        {snapshot
          ? "Capture a reviewed ranking snapshot"
          : "Append an integrity decision"}
      </h2>
      <form className="app-form" onSubmit={submit}>
        {snapshot ? (
          <>
            <label>
              Period
              <select name="period">
                <option value="week">This week</option>
                <option value="month">This month</option>
                <option value="90d">90 days</option>
                <option value="ytd">YTD</option>
                <option value="all">All time</option>
              </select>
            </label>
            <label>
              Sport (optional)
              <input name="sport" placeholder="All eligible sports" />
            </label>
          </>
        ) : (
          <>
            <label>
              Permanent Edge ID
              <input name="edgeId" required pattern="[a-fA-F0-9-]{36}" />
            </label>
            <label>
              Integrity state
              <select name="status">
                <option value="INTEGRITY_REVIEW">
                  Under integrity review · not ranked
                </option>
                <option value="INTEGRITY_CLEARED">
                  Review resolved and cleared
                </option>
              </select>
            </label>
          </>
        )}
        <label>
          Audited review reason
          <textarea name="reason" required minLength={12} maxLength={1000} />
        </label>
        <p className="form-help">
          A retained audit record identifies the actor, reason and timestamp.
          This cannot override a provider price, declare a winner or erase a
          losing result.
        </p>
        <button className="button" disabled={busy}>
          {snapshot ? "Capture audited snapshot" : "Append integrity decision"}
        </button>
        <p role="status">{message}</p>
      </form>
      {snapshot && (
        <details>
          <summary>Inspect an existing snapshot</summary>
          <form
            className="app-form"
            onSubmit={(e) => {
              e.preventDefault();
              const d = new FormData(e.currentTarget);
              setSnapshotId(String(d.get("snapshotId")));
            }}
          >
            <label>
              Snapshot ID
              <input name="snapshotId" required pattern="[a-fA-F0-9-]{36}" />
            </label>
            <button className="button ghost">Read snapshot evidence</button>
          </form>
          {snapshotId && (
            <AdminReadPanel
              endpoint={`/api/admin/community-edges?view=leaderboard-snapshot&id=${encodeURIComponent(snapshotId)}`}
              title="Canonical ranking snapshot evidence"
            />
          )}
        </details>
      )}
    </section>
  );
}
