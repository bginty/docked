"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  betaCreditRequestStatus,
  type BetaCreditRequestListing,
  type BetaCreditRequestMutation,
} from "@/core/beta-credit-requests";
import styles from "./admin-record-detail.module.css";

export function BetaCreditRequestPanel() {
  const [data, setData] = useState<BetaCreditRequestListing | null>(null);
  const [query, setQuery] = useState("");
  const [recipient, setRecipient] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<BetaCreditRequestMutation | null>(
    null,
  );
  const [uncertain, setUncertain] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const submitting = useRef(false);
  const mounted = useRef(false);
  const load = useCallback(
    async (signal?: AbortSignal, search = "") => {
      const response = await fetch(
        `/api/admin/credit-requests?page=${page}&q=${encodeURIComponent(search)}`,
        { cache: "no-store", signal },
      );
      const body = await response.json();
      if (!response.ok) throw Error(body.error ?? "Requests unavailable.");
      if (mounted.current && !signal?.aborted) setData(body);
    },
    [page],
  );
  useEffect(() => {
    mounted.current = true;
    const abort = new AbortController();
    void load(abort.signal).catch((error) => {
      if (!abort.signal.aborted)
        setMessage(
          error instanceof Error ? error.message : "Requests unavailable.",
        );
    });
    return () => {
      mounted.current = false;
      abort.abort();
    };
  }, [load]);
  function preview(mutation: BetaCreditRequestMutation) {
    setPending(mutation);
    setConfirmed(false);
    setUncertain(false);
    setMessage("");
  }
  async function submit() {
    if (!pending || !confirmed || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/credit-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending),
      });
      const result = await response.json();
      if (!response.ok) {
        if (mounted.current) {
          setUncertain(response.status >= 500);
          setMessage(result.error ?? "Request could not be saved.");
        }
        return;
      }
      if (mounted.current) {
        setPending(null);
        setUncertain(false);
        setConfirmed(false);
        setReviewReason("");
        setMessage(
          "Review record saved. No credits were issued and no balance changed.",
        );
        if (pending.action === "request") {
          setRecipient(null);
          setQuery("");
          setAmount("");
          setReason("");
        }
        await load().catch(() =>
          setMessage(
            "Review record saved; the list could not refresh. Reload to view it. No credits were issued.",
          ),
        );
      }
    } catch {
      if (mounted.current) {
        setUncertain(true);
        setMessage(
          "The response was interrupted. Retry this same request to check its outcome before creating another.",
        );
      }
    } finally {
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const canPreview =
    recipient &&
    Number.isSafeInteger(Number(amount)) &&
    Number(amount) > 0 &&
    Number(amount) <= 1_000_000_000 &&
    reason.trim().length >= 12;
  return (
    <section className={styles.panel} aria-labelledby="credit-request-title">
      <h2 id="credit-request-title">Beta-credit requests</h2>
      <p>
        Prepare and review a request for non-redeemable test credits. Hosted
        issuance is disabled. Approval here records the request decision only.
      </p>
      {message && <p role="status">{message}</p>}
      {pending ? (
        <section
          className={styles.panel}
          aria-label="Confirm credit request review"
        >
          <h3>
            {pending.action === "request"
              ? "Review new request"
              : `Review decision: ${pending.action}`}
          </h3>
          <p>
            {pending.action === "request"
              ? `${recipient?.name ?? pending.recipient} · ${pending.amount.toLocaleString()} test credits`
              : `Request ${pending.id}`}
          </p>
          <p>{pending.reason}</p>
          <label>
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            I confirm this review record. It does not issue credits.
          </label>
          <div className="actions">
            <button
              type="button"
              className="button"
              disabled={busy || !confirmed}
              onClick={() => void submit()}
            >
              {busy
                ? "Saving…"
                : uncertain
                  ? "Retry same request"
                  : "Confirm review record"}
            </button>
            <button
              type="button"
              className="button ghost"
              disabled={busy || uncertain}
              onClick={() => setPending(null)}
            >
              Cancel review
            </button>
          </div>
        </section>
      ) : (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void load(undefined, query).catch((error) =>
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Recipient lookup unavailable.",
                ),
              );
            }}
          >
            <label>
              Find admitted recipient
              <input
                value={query}
                minLength={2}
                maxLength={120}
                required
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Display name, handle or member ID"
              />
            </label>
            <button type="submit" className="button ghost">
              Find recipient
            </button>
          </form>
          {data && query.trim().length >= 2 && !data.recipients.length && (
            <p>No matching recipients in the last lookup.</p>
          )}
          <ul className={styles.history} aria-label="Eligible recipients">
            {data?.recipients.map((member) => (
              <li key={member.id}>
                <strong>{member.name}</strong>
                <span>{member.handle ? `@${member.handle}` : member.id}</span>
                <button
                  type="button"
                  className="button ghost"
                  onClick={() => setRecipient(member)}
                >
                  Select {member.name}
                </button>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (canPreview && recipient)
                preview({
                  action: "request",
                  requestId: crypto.randomUUID(),
                  recipient: recipient.id,
                  amount: Number(amount),
                  reason: reason.trim(),
                  confirmed: true,
                });
            }}
          >
            <p>Selected recipient: {recipient?.name ?? "None"}</p>
            <label>
              Requested test credits
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={1_000_000_000}
                step={1}
                required
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label>
              Reason
              <textarea
                minLength={12}
                maxLength={600}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <button type="submit" className="button" disabled={!canPreview}>
              Review request
            </button>
          </form>
          <h3>Saved requests</h3>
          {!data ? (
            <p>Loading requests…</p>
          ) : !data.requests.length ? (
            <p>No saved requests.</p>
          ) : (
            <>
              <label>
                Decision reason
                <textarea
                  minLength={12}
                  maxLength={600}
                  value={reviewReason}
                  onChange={(event) => setReviewReason(event.target.value)}
                />
              </label>
              <ul className={styles.history}>
                {data.requests.map((request) => (
                  <li key={request.id}>
                    <strong>
                      {request.recipientName} ·{" "}
                      {request.amount.toLocaleString()} test credits
                    </strong>
                    <span>{betaCreditRequestStatus[request.status]}</span>
                    <p>{request.reason}</p>
                    <small>
                      Request {request.id} · Revision {request.revision}
                    </small>
                    <details>
                      <summary>Immutable review history</summary>
                      <ol>
                        {request.history.map((event) => (
                          <li key={event.id}>
                            <strong>{event.action}</strong>
                            <span>{event.reason}</span>
                            <small>
                              {event.created_at} · Staff {event.actor}
                            </small>
                          </li>
                        ))}
                      </ol>
                    </details>
                    <div className="actions">
                      {(request.status === "requested"
                        ? (["approve", "decline", "cancel"] as const)
                        : request.status === "approved"
                          ? (["cancel"] as const)
                          : []
                      ).map((action) => (
                        <button
                          key={action}
                          type="button"
                          className="button ghost"
                          disabled={reviewReason.trim().length < 12}
                          onClick={() =>
                            preview({
                              action,
                              requestId: crypto.randomUUID(),
                              id: request.id,
                              revision: request.revision,
                              reason: reviewReason.trim(),
                              confirmed: true,
                            })
                          }
                        >
                          {action === "approve"
                            ? "Approve request"
                            : action === "decline"
                              ? "Decline request"
                              : "Cancel request"}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
          <nav className="actions" aria-label="Credit request pages">
            <button
              type="button"
              className="button ghost"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Previous
            </button>
            <button
              type="button"
              className="button ghost"
              disabled={!data?.hasMore}
              onClick={() => setPage((value) => value + 1)}
            >
              Next
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
