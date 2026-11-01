"use client";
import { useEffect, useRef, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import { LightSweep } from "./startup-loading";
type Case = {
  id: string;
  member_id: string;
  exposure_credits: number;
  reason: string;
  revision: number;
  created_at: string;
};
type Report = {
  report: {
    environment: string;
    purchases: number;
    gross_cents: string;
    refund_cents: string;
    outstandingCredits: number;
    open_cases: number;
  };
  jobs: { attention: number; overdue: number; completed: number };
  cases: Case[];
};
export function CommercialBillingReview() {
  const [data, setData] = useState<Report | null>(null),
    [error, setError] = useState(""),
    [attempt, setAttempt] = useState(0),
    [review, setReview] = useState<Case | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const flight = useRef(false);
  useEffect(() => {
    const c = new AbortController();
    setError("");
    void boundedFetch("/api/admin/commercial-billing", {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        if (!r.ok)
          throw Error(
            "Billing review unavailable. Check the service configuration and your owner session.",
          );
        const v = await r.json();
        if (!c.signal.aborted) setData(v);
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(e.message);
      });
    return () => c.abort();
  }, [attempt]);
  async function resolve() {
    if (!review || flight.current || reason.trim().length < 12) return;
    flight.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await boundedFetch("/api/admin/commercial-billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "waive_completed_refund_hold",
          id: review.id,
          revision: review.revision,
          reason: reason.trim(),
        }),
      });
      if (!r.ok)
        throw Error(
          "Decision not confirmed. Refresh the case; only a completed refund can be waived, by an independent authorised reviewer.",
        );
      setMessage(
        "Recovery hold waived and audited. No payment or balance adjustment was made.",
      );
      setReview(null);
      setReason("");
      setAttempt((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      flight.current = false;
      setBusy(false);
    }
  }
  const money = (n: string) =>
    new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(Number(n) / 100);
  return (
    <section className="scoring-review">
      <h1>Commercial billing review</h1>
      <p>
        Customer charges and refunds are provider observations. Google payouts,
        fees and recognised revenue require separate settlement reconciliation.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <button
        className="btn secondary"
        disabled={busy}
        onClick={() => {
          setReview(null);
          setAttempt((n) => n + 1);
        }}
      >
        Refresh report
      </button>
      {!data && !error && (
        <LightSweep compact label="Loading billing report…" />
      )}
      {data && (
        <>
          <section className="panel">
            <h2>Ledger · {data.report.environment}</h2>
            <dl>
              <dt>Verified charge records</dt>
              <dd>{data.report.purchases}</dd>
              <dt>Gross customer charges</dt>
              <dd>{money(data.report.gross_cents)}</dd>
              <dt>Confirmed provider refunds</dt>
              <dd>{money(data.report.refund_cents)}</dd>
              <dt>Outstanding Docked Credits</dt>
              <dd>{data.report.outstandingCredits.toLocaleString("en-AU")}</dd>
            </dl>
            <p>
              Jobs requiring attention: {data.jobs.attention} · Overdue:{" "}
              {data.jobs.overdue} · Completed: {data.jobs.completed}
            </p>
          </section>
          <h2>Recovery reviews ({data.report.open_cases})</h2>
          <p>
            Showing up to 50 oldest open cases. Waiving a completed refund hold
            accepts the recorded exposure; it does not recover cash, delete
            cards, debit another member or clear unrelated holds.
          </p>
          {data.cases.length === 0 && <p>No open cases.</p>}
          {data.cases.map((c) => (
            <article key={c.id} className="panel">
              <h3>Case {c.id.slice(0, 12)}</h3>
              <p style={{ overflowWrap: "anywhere" }}>Member {c.member_id}</p>
              <p>{c.reason}</p>
              <p>
                {Number(c.exposure_credits).toLocaleString("en-AU")} credits
                exposure · Revision {c.revision}
              </p>
              <time dateTime={c.created_at}>
                {new Date(c.created_at).toLocaleString("en-AU")}
              </time>
              <p>
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => {
                    setReview(c);
                    setReason("");
                    setMessage("");
                  }}
                >
                  Review hold
                </button>
              </p>
            </article>
          ))}
          {review && (
            <section
              className="panel"
              aria-labelledby="commercial-review-heading"
            >
              <h2 id="commercial-review-heading">
                Review case {review.id.slice(0, 12)}
              </h2>
              <label>
                Internal decision reason
                <textarea
                  value={reason}
                  maxLength={600}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                />
              </label>
              <p>
                This action only waives this completed refund hold. A stale
                case, your own case, or an incomplete refund is rejected by the
                server.
              </p>
              <div className="actions">
                <button
                  className="btn primary"
                  disabled={busy || reason.trim().length < 12}
                  onClick={() => void resolve()}
                >
                  Confirm waiver
                </button>
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => setReview(null)}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
