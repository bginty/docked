"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type {
  AnnouncementDraft,
  AnnouncementEvent,
  AnnouncementListing,
  AnnouncementMutation,
} from "@/core/admin-announcements";

export function AdminAnnouncementDraft() {
  const [listing, setListing] = useState<AnnouncementListing | null>(null);
  const [selected, setSelected] = useState<AnnouncementDraft | null>(null);
  const [events, setEvents] = useState<AnnouncementEvent[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [cta, setCta] = useState<AnnouncementMutation["cta"]>(null);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState(false);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState<AnnouncementMutation | null>(null);
  const submitting = useRef(false);
  const mounted = useRef(false);
  const dirty =
    title !== (selected?.title ?? "") ||
    body !== (selected?.body ?? "") ||
    cta !== (selected?.cta ?? null);
  const canEdit = Boolean(
    listing?.canWrite &&
    (!selected || listing.canReview || listing.actor === selected.created_by) &&
    (!selected ||
      ["draft", "changes_requested"].includes(selected.status) ||
      (listing.canReview && selected.status === "published")),
  );
  const canManage = Boolean(
    listing?.canWrite &&
    selected &&
    (listing.canReview || listing.actor === selected.created_by),
  );
  const canReview = Boolean(
    listing?.canReview &&
    selected &&
    selected.status === "in_review" &&
    (listing.canApproveOwn ||
      (listing.actor !== selected.created_by &&
        listing.actor !== selected.last_edited_by)),
  );
  const valid =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    reason.trim().length >= 3;
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch(`/api/admin/announcements?page=${page}`, {
        cache: "no-store",
        signal,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error ?? "Drafts unavailable");
      if (mounted.current && !signal?.aborted) setListing(data);
    },
    [page],
  );
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    void load(controller.signal).catch(() => {
      if (!controller.signal.aborted)
        setMessage("Saved drafts are unavailable. Reload to try again.");
    });
    return () => {
      mounted.current = false;
      controller.abort();
    };
  }, [load]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    void fetch(
      `/api/admin/announcements?id=${encodeURIComponent(selected.id)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw Error();
        const data = await response.json();
        if (!controller.signal.aborted) setEvents(data);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            "Draft loaded; review history is temporarily unavailable.",
          );
      });
    return () => controller.abort();
  }, [selected]);
  function choose(draft: AnnouncementDraft | null) {
    setSelected(draft);
    setTitle(draft?.title ?? "");
    setBody(draft?.body ?? "");
    setCta(draft?.cta ?? null);
    setReason("");
    setPreview(false);
    setEvents([]);
    setMessage("");
  }
  async function mutate(
    action: AnnouncementMutation["action"],
    retry?: AnnouncementMutation,
  ) {
    if (submitting.current) return;
    const payload: AnnouncementMutation = retry ?? {
      requestId: crypto.randomUUID(),
      id: selected?.id ?? crypto.randomUUID(),
      version: selected?.version ?? 0,
      action,
      title: title.trim(),
      body: body.trim(),
      audience: "admitted",
      reason: reason.trim(),
      cta,
    };
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!mounted.current) return;
      if (!response.ok) {
        setUncertain(response.status >= 500 ? payload : null);
        setMessage(data.error ?? "Draft was not saved.");
        return;
      }
      setUncertain(null);
      choose(data);
      setMessage(
        action === "publish"
          ? "Published on Docked. No push notifications sent."
          : "Announcement saved securely.",
      );
      await load().catch(() => {
        if (mounted.current)
          setMessage(
            "Saved securely. List refresh is unavailable; reload to check the current publication status.",
          );
      });
    } catch {
      if (mounted.current) {
        setUncertain(payload);
        setMessage(
          "The save outcome is uncertain. Retry the same request before making further changes.",
        );
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const locked = busy || Boolean(uncertain);
  return (
    <section
      className="admin-workspace-panel"
      style={
        {
          "--ink": "#f5f7ff",
          "--surface-card": "#041424",
          "--surface-info": "#102c47",
          "--surface-info-hover": "#163b64",
          "--border-control": "#29405a",
          overflowWrap: "anywhere",
        } as CSSProperties
      }
    >
      <h2>Official announcements</h2>
      <p>
        Review and publish on Docked. Publishing does not send push
        notifications.
      </p>
      <p role="status">
        {message ||
          (listing
            ? "Only authorised staff can view these drafts."
            : "Loading saved drafts…")}
      </p>
      {uncertain && (
        <button
          className="button"
          type="button"
          disabled={busy}
          onClick={() => void mutate(uncertain.action, uncertain)}
        >
          Retry same save request
        </button>
      )}
      {listing && (
        <>
          <ul className="admin-records" aria-label="Saved announcement drafts">
            {listing.drafts.map((draft) => (
              <li key={draft.id}>
                <button
                  className="button ghost"
                  type="button"
                  disabled={locked || dirty}
                  onClick={() => choose(draft)}
                >
                  {draft.title}
                </button>
                <span>
                  {draft.status.replaceAll("_", " ")} · Version {draft.version}
                </span>
              </li>
            ))}
          </ul>
          {!listing.drafts.length && <p>No saved drafts on this page.</p>}
          <div className="actions">
            <button
              className="button ghost"
              type="button"
              disabled={locked || dirty || page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous drafts
            </button>
            <button
              className="button ghost"
              type="button"
              disabled={locked || dirty || !listing.hasMore}
              onClick={() => setPage(page + 1)}
            >
              Next drafts
            </button>
            {listing.canWrite && (
              <button
                className="button ghost"
                type="button"
                disabled={locked || dirty}
                onClick={() => choose(null)}
              >
                New draft
              </button>
            )}
          </div>
        </>
      )}
      {selected && (
        <p>
          Version {selected.version} · {selected.status.replaceAll("_", " ")} ·{" "}
          {new Date(selected.updated_at).toLocaleString()}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setPreview(true);
        }}
      >
        <fieldset
          className="form-stack"
          disabled={locked}
          style={
            {
              minWidth: 0,
              border: 0,
              padding: 0,
              margin: 0,
              "--surface-card": "#041424",
              "--ink": "#f5f7ff",
              "--border-control": "#29405a",
            } as CSSProperties
          }
        >
          <legend>
            {selected ? "Saved announcement" : "New announcement"}
          </legend>
          <label>
            Audience
            <select
              aria-label="Announcement audience"
              value="admitted"
              disabled
            >
              <option value="admitted">Admitted Docked members</option>
            </select>
          </label>
          <label>
            Title
            <input
              required
              maxLength={120}
              value={title}
              readOnly={!canEdit}
              onChange={(event) => {
                setTitle(event.target.value);
                setPreview(false);
              }}
            />
          </label>
          <label>
            Message
            <textarea
              required
              maxLength={3000}
              rows={5}
              value={body}
              readOnly={!canEdit}
              onChange={(event) => {
                setBody(event.target.value);
                setPreview(false);
              }}
            />
          </label>
          {listing?.canWrite && (
            <label>
              Reason for this change
              <input
                maxLength={500}
                minLength={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
          <label>
            Optional button destination
            <select
              value={cta ?? ""}
              disabled={!canEdit}
              onChange={(e) =>
                setCta((e.target.value || null) as AnnouncementMutation["cta"])
              }
            >
              <option value="">No button</option>
              <option value="/fantasy/prizes">Prizes</option>
              <option value="/fantasy/play">Play</option>
              <option value="/fantasy/cards">Collection</option>
              <option value="/fantasy/market">Market</option>
              <option value="/fantasy/results">Rankings</option>
              <option value="/fantasy/test-wallet?view=packs">Packs</option>
            </select>
          </label>
          <div className="actions">
            <button
              className="button ghost"
              type="submit"
              disabled={!title.trim() || !body.trim()}
            >
              Preview announcement
            </button>
            {canEdit && (
              <button
                className="button"
                type="button"
                disabled={!valid || Boolean(selected && !dirty)}
                onClick={() => void mutate(selected ? "save" : "create")}
              >
                Save draft
              </button>
            )}
            {dirty && (
              <button
                className="button ghost"
                type="button"
                onClick={() => choose(selected)}
              >
                Discard unsaved changes
              </button>
            )}
            {selected && canManage && !dirty && (
              <>
                {listing?.canReview && selected.status === "approved" && (
                  <button
                    className="button"
                    type="button"
                    disabled={!valid}
                    onClick={() => void mutate("publish")}
                  >
                    Publish on Docked
                  </button>
                )}
                {listing?.canReview &&
                  selected.published &&
                  selected.status !== "archived" && (
                    <button
                      className="button ghost"
                      type="button"
                      disabled={!valid}
                      onClick={() =>
                        void mutate(selected.pinned ? "unpin" : "pin")
                      }
                    >
                      {selected.pinned
                        ? "Unpin announcement"
                        : "Pin announcement"}
                    </button>
                  )}
                {["draft", "changes_requested"].includes(selected.status) && (
                  <button
                    className="button ghost"
                    type="button"
                    disabled={!valid}
                    onClick={() => void mutate("submit")}
                  >
                    Submit for review
                  </button>
                )}
                {canReview && (
                  <>
                    <button
                      className="button ghost"
                      type="button"
                      disabled={!valid}
                      onClick={() => void mutate("approve")}
                    >
                      Approve draft only
                    </button>
                    <button
                      className="button ghost"
                      type="button"
                      disabled={!valid}
                      onClick={() => void mutate("request_changes")}
                    >
                      Request changes
                    </button>
                  </>
                )}
                <button
                  className="button ghost"
                  type="button"
                  disabled={!valid}
                  onClick={() =>
                    void mutate(
                      selected.status === "archived" ? "restore" : "archive",
                    )
                  }
                >
                  {selected.status === "archived"
                    ? "Restore as draft"
                    : "Archive announcement"}
                </button>
              </>
            )}
          </div>
        </fieldset>
      </form>
      {dirty && (
        <p>Save or discard your changes before selecting another draft.</p>
      )}
      {selected?.status === "in_review" && !canReview && (
        <p>
          An owner or independent authorised administrator can review this
          draft.
        </p>
      )}
      {preview && (
        <article
          aria-label="Announcement preview"
          className="admin-announcement-preview"
        >
          <p>Preview · unpublished changes</p>
          <h3>{title}</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{body}</p>
          {cta && (
            <span className="button ghost">
              Button: {cta.split("/").at(-1)?.split("?")[0]}
            </span>
          )}
        </article>
      )}
      {selected && (
        <details>
          <summary>Review history · latest 50 events</summary>
          <ul>
            {events.map((event) => (
              <li key={event.version}>
                Version {event.version} · {event.action.replaceAll("_", " ")} ·{" "}
                {new Date(event.created_at).toLocaleString()}
                <p>{event.reason}</p>
                <small>Staff record: {event.actor}</small>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
