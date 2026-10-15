"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { RedemptionView } from "@/core/redemption-view";
import {
  audToCredits,
  formatAud,
  redemptionLabels as labels,
} from "@/core/redemption-money";
import { FantasySheet } from "./fantasy-player-sheet";
type Operation = Record<string, unknown>;
type Pending = { request: string; operation: Operation };
const stamp = (n?: number | null) =>
  n
    ? new Date(n).toLocaleString("en-AU", {
        timeZone: "Australia/Sydney",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not yet";
const count = (n: number) => n.toLocaleString("en-AU");
export function Withdrawals({ admin = false }: { admin?: boolean }) {
  const [data, setData] = useState<RedemptionView | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [aud, setAud] = useState(""),
    [destination, setDestination] = useState(""),
    [bank, setBank] = useState({ holder: "", bsb: "", account: "" });
  const [bankForm, setBankForm] = useState(false),
    [review, setReview] = useState<Operation | null>(null),
    [selected, setSelected] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [reason, setReason] = useState(""),
    [reference, setReference] = useState(""),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const [revealed, setRevealed] = useState<Record<string, string> | null>(null),
    [notice, setNotice] = useState("");
  const pending = useRef<Pending | null>(null),
    member = useRef<string | null>(null),
    alive = useRef(true),
    generation = useRef(0);
  const endpoint = `/api/redemptions${admin ? "?admin=true" : ""}`;
  const key = (id: string) =>
    `docked:redemption:${id}:${admin ? "staff" : "member"}`;
  async function load() {
    const g = ++generation.current;
    setError("");
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 10000);
    try {
      const r = await fetch(endpoint, {
        cache: "no-store",
        signal: controller.signal,
      });
      const d = await r.json();
      if (!r.ok) {
        if (r.status === 401 || r.status === 403) {
          setData(null);
          setRevealed(null);
          setReview(null);
          member.current = null;
        }
        throw Error(d.error);
      }
      if (!alive.current || g !== generation.current) return;
      if (member.current !== d.member) {
        pending.current = null;
        setRevealed(null);
        setReview(null);
        setBank({ holder: "", bsb: "", account: "" });
        setAud("");
        setSelected("");
        setReason("");
        setInternalNote("");
        setReference("");
      }
      member.current = d.member;
      setData(d);
      setDestination(
        d.destinations.filter((x: { eligible: boolean }) => x.eligible).at(-1)
          ?.id ?? "",
      );
      try {
        const old = sessionStorage.getItem(key(d.member));
        if (old) {
          const saved = JSON.parse(old) as Pending;
          if (
            d.completedOperations.includes(saved.request) ||
            d.requests.some((x: { id: string }) => x.id === saved.request) ||
            d.destinations.some((x: { id: string }) => x.id === saved.request)
          ) {
            sessionStorage.removeItem(key(d.member));
            pending.current = null;
            setNotice("Your saved request has been recovered.");
          } else {
            pending.current = saved;
            setNotice(
              "A previous action was interrupted. Retry it with its original details to recover the outcome.",
            );
          }
        }
      } catch {
        /* Storage is optional; server idempotency remains authoritative. */
      }
    } catch (e) {
      if (alive.current && g === generation.current)
        setError(
          e instanceof Error ? e.message : "Unable to load withdrawals.",
        );
    } finally {
      clearTimeout(timer);
    }
  }
  useEffect(() => {
    alive.current = true;
    void load();
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, [admin]);
  useEffect(() => {
    if (!revealed) return;
    const id = setTimeout(() => setRevealed(null), 30000);
    return () => clearTimeout(id);
  }, [revealed]);
  async function act(operation: Operation) {
    if (busy || !data) return;
    generation.current++;
    setBusy(true);
    setError("");
    setNotice("");
    setRevealed(null);
    const prior = pending.current;
    if (
      prior &&
      JSON.stringify(prior.operation) !== JSON.stringify(operation) &&
      !(
        prior.operation.action === "bank-save" &&
        operation.action === "bank-save"
      )
    ) {
      setError(
        "Recover the previous request before starting a different action.",
      );
      setBusy(false);
      return;
    }
    const request = prior?.request ?? crypto.randomUUID();
    pending.current = { request, operation };
    try {
      sessionStorage.setItem(
        key(data.member),
        JSON.stringify({
          request,
          operation:
            operation.action === "bank-save"
              ? { action: "bank-save" }
              : operation,
        }),
      );
    } catch {}
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 15000),
      expectedMember = data.member;
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, operation }),
        signal: controller.signal,
      });
      const result = await r.json();
      if (!r.ok) {
        if (result.outcome === "rejected") {
          pending.current = null;
          try {
            sessionStorage.removeItem(key(expectedMember));
          } catch {}
        }
        throw Error(result.error);
      }
      if (!alive.current || member.current !== expectedMember) return;
      if (result.member !== expectedMember) {
        setData(null);
        setRevealed(null);
        pending.current = null;
        void load();
        return;
      }
      pending.current = null;
      generation.current++;
      try {
        sessionStorage.removeItem(key(expectedMember));
      } catch {}
      setData(result);
      setReview(null);
      setBankForm(false);
      setBank({ holder: "", bsb: "", account: "" });
      setDestination(
        result.destinations
          .filter((x: { eligible: boolean }) => x.eligible)
          .at(-1)?.id ?? "",
      );
      if (result.revealed) setRevealed(result.revealed);
      setSelected(result.result?.reference ?? selected);
      setNotice(
        operation.action === "submit"
          ? "Redemption requested. Credits reserved; EFT has not been sent."
          : "Action confirmed. History updated.",
      );
    } catch (e) {
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : "Outcome unknown. Retry the same action to recover it.",
        );
    } finally {
      clearTimeout(timer);
      if (alive.current) setBusy(false);
    }
  }
  let credits = 0;
  try {
    credits = audToCredits(aud);
  } catch {}
  const current = data?.requests.find((r) => r.id === selected);
  const requests =
    data?.requests.filter(
      (r) =>
        (!status || r.status === status) &&
        `${r.id} ${r.member ?? ""} ${r.memberLabel ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!from ||
          new Date(r.requestedAt).toLocaleDateString("en-CA", {
            timeZone: "Australia/Sydney",
          }) >= from) &&
        (!to ||
          new Date(r.requestedAt).toLocaleDateString("en-CA", {
            timeZone: "Australia/Sydney",
          }) <= to),
    ) ?? [];
  const transition = (action: string, id: string) =>
    setReview({
      action,
      withdrawal: id,
      reason: reason.trim() || "Customer requested cancellation",
      ...(admin && internalNote ? { internalNote } : {}),
      ...(reference ? { reference } : {}),
      confirmed: true,
    });
  return (
    <main className="withdrawals">
      <header className="withdrawal-header">
        <div>
          <Link href="/fantasy/profile">← Profile</Link>
          <h1>{admin ? "Credit redemption requests" : "Withdrawals"}</h1>
          <p>100 redeemable credits = $1 AUD</p>
        </div>
        <span className="redemption-chip">
          {data?.enabled
            ? "LOCAL TEST · NO PAYMENTS"
            : "Redemption unavailable in beta"}
        </span>
      </header>
      <p className="redemption-notice">
        Only explicitly eligible credits can be redeemed. Existing test credits
        have no cash value.
      </p>
      {error && (
        <div role="alert" className="redemption-error">
          {error} <button onClick={() => void load()}>Refresh status</button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {pending.current && pending.current.operation.action !== "bank-save" && (
        <button
          disabled={busy}
          onClick={() => pending.current && void act(pending.current.operation)}
        >
          Recover interrupted action
        </button>
      )}
      {!data ? (
        <section className="redemption-panel">
          <p>
            {error
              ? "Your balance has not been loaded."
              : "Loading withdrawals…"}
          </p>
          <button onClick={() => void load()}>Retry</button>
        </section>
      ) : (
        <>
          {!admin ? (
            <div className="redemption-layout">
              <div>
                <section className="redemption-panel">
                  <span>Available to redeem</span>
                  <h2 className="credit-amount">
                    {count(data.balance.available)} <small>credits</small>
                  </h2>
                  <p className="cash-equivalent">
                    {formatAud(data.balance.available)} equivalent
                    {data.enabled ? " · simulated" : ""}
                  </p>
                  <div className="redemption-stats">
                    <div>
                      <span>Pending redemption</span>
                      <strong>{count(data.balance.pending)}</strong>
                    </div>
                    <div>
                      <span>Test / other non-redeemable</span>
                      <strong>{count(data.balance.other)}</strong>
                    </div>
                  </div>
                  <details>
                    <summary>
                      Total credits: {count(data.balance.total)}
                    </summary>
                    <p>
                      Total includes pending redemption, which cannot be spent.
                      Available to redeem is a subset of spendable credits; it
                      is not an additional balance.
                    </p>
                  </details>
                </section>
                <section className="redemption-panel">
                  <h2>Identity & bank account</h2>
                  <ol className="redemption-steps">
                    <li>1 · Identity</li>
                    <li>2 · Bank account</li>
                    <li>3 · Redeem</li>
                  </ol>
                  <p>
                    Identity: <strong>{labels[data.identity]}</strong>
                  </p>
                  {data.identityExpires && (
                    <p className="small-note">
                      Approval expiry: {stamp(data.identityExpires)}
                    </p>
                  )}
                  {!!data.identityTimeline.length && (
                    <details>
                      <summary>Identity review history</summary>
                      {data.identityTimeline.map((e, i) => (
                        <p key={i}>
                          {stamp(e.at)} · {labels[e.status]} · {e.reason}
                        </p>
                      ))}
                    </details>
                  )}
                  {data.identity !== "VERIFIED" && (
                    <>
                      <p>
                        A reviewed identity check is required before your first
                        redemption. Approval can expire or be revoked.
                      </p>
                      <button
                        disabled={
                          !data.enabled ||
                          busy ||
                          ![
                            "NOT_STARTED",
                            "MORE_INFORMATION",
                            "REJECTED",
                            "REVOKED",
                          ].includes(data.identity)
                        }
                        onClick={() =>
                          void act({
                            action: "identity-submit",
                            evidence: `fixture-evidence-${data.member}`,
                          })
                        }
                      >
                        Submit synthetic evidence for review
                      </button>
                      <p className="small-note">
                        Real document uploads are disabled. This local preview
                        uses a labelled fixture, never a licence or selfie.
                      </p>
                    </>
                  )}
                  <p>
                    Destination:{" "}
                    {data.destinations.find((d) => d.id === destination)
                      ? `Australian account ending ${data.destinations.find((d) => d.id === destination)!.last4}`
                      : "Not set"}
                  </p>
                  {data.destinations.some((d) => !d.nameMatched) && (
                    <p role="status">
                      A destination needs name review and cannot be used. Add an
                      account in your verified name; joint-account policy is not
                      configured.
                    </p>
                  )}
                  <button
                    disabled={
                      !data.enabled || data.identity !== "VERIFIED" || busy
                    }
                    onClick={() => setBankForm(true)}
                  >
                    {destination ? "Change bank account" : "Add bank account"}
                  </button>
                  <p className="small-note">
                    Changes require recent sign-in and do not alter pending
                    requests.
                  </p>
                </section>
              </div>
              <section className="redemption-panel">
                <h2>Redeem credits</h2>
                <label>
                  Amount to receive (AUD)
                  <input
                    aria-label="Amount to receive (AUD)"
                    inputMode="decimal"
                    value={aud}
                    onChange={(e) => setAud(e.target.value)}
                    placeholder="100.00"
                    disabled={!data.enabled}
                  />
                </label>
                <dl className="redemption-quote">
                  <div>
                    <dt>You receive</dt>
                    <dd>{credits ? formatAud(credits) : "—"}</dd>
                  </div>
                  <div>
                    <dt>Credits required</dt>
                    <dd>{credits ? count(credits) : "—"}</dd>
                  </div>
                  <div>
                    <dt>Available after request</dt>
                    <dd>
                      {credits && credits <= data.balance.available
                        ? count(data.balance.available - credits)
                        : "—"}
                    </dd>
                  </div>
                </dl>
                {data.limits.minimum !== null && (
                  <p>Configured minimum: {formatAud(data.limits.minimum)}</p>
                )}
                {data.limits.maximum !== null && (
                  <p>Configured maximum: {formatAud(data.limits.maximum)}</p>
                )}
                <button
                  className="redemption-primary"
                  disabled={
                    busy ||
                    !data.enabled ||
                    data.identity !== "VERIFIED" ||
                    !destination
                  }
                  onClick={() => {
                    try {
                      audToCredits(aud);
                      setReview({
                        action: "submit",
                        aud,
                        destination,
                        confirmed: true,
                      });
                      setError("");
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  Review redemption
                </button>
                <p className="small-note">
                  We aim to send approved withdrawals within 1 business day.
                  Bank processing times may vary.
                </p>
                <p className="small-note">
                  Identity review, request review and recipient-bank processing
                  are separate.{" "}
                  {data.calendarConfigured
                    ? "Dispatch target follows the configured Sydney business calendar."
                    : "Dispatch calendar and cutoff are not yet configured."}
                </p>
              </section>
            </div>
          ) : (
            <>
              <div className="redemption-stats">
                {[
                  "REQUESTED",
                  "APPROVED",
                  "PAYMENT_IN_PROGRESS",
                  "EXCEPTION",
                ].map((s) => (
                  <section className="redemption-panel" key={s}>
                    <span>{labels[s]}</span>
                    <strong>
                      {data.requests.filter((r) => r.status === s).length}
                    </strong>
                  </section>
                ))}
              </div>
              {!!data.destinationExceptions.length && (
                <section className="redemption-panel">
                  <h2>Bank name exceptions · redemption blocked</h2>
                  {data.destinationExceptions.map((d) => (
                    <p key={d.id}>
                      {d.memberLabel} · ending {d.last4} · {stamp(d.at)}.
                      Require a correctly matched new destination; no override
                      or joint-account policy is enabled.
                    </p>
                  ))}
                </section>
              )}
              {data.permissions.includes("identity") && (
                <details className="redemption-panel">
                  <summary>Identity reviews</summary>
                  {data.identities.map((i) => (
                    <section key={i.member} className="redemption-identity">
                      <strong>{i.memberLabel}</strong>
                      <details>
                        <summary>Member reference</summary>
                        {i.member}
                      </details>
                      <p>
                        {labels[i.status]} · evidence revision {i.revision}
                      </p>
                      <button
                        disabled={!i.evidence || busy}
                        onClick={() =>
                          void act({
                            action: "evidence-access",
                            reference: i.member,
                          })
                        }
                      >
                        Review evidence securely
                      </button>
                      <label>
                        Internal note (staff only)
                        <input
                          value={internalNote}
                          onChange={(e) => setInternalNote(e.target.value)}
                        />
                      </label>
                      <label>
                        Customer-facing decision reason
                        <input
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                        />
                      </label>
                      <div className="redemption-actions">
                        {[
                          "UNDER_REVIEW",
                          "VERIFIED",
                          "MORE_INFORMATION",
                          "REJECTED",
                          "REVOKED",
                        ].map((s) => (
                          <button
                            key={s}
                            disabled={
                              busy || reason.trim().length < 3 || !i.evidence
                            }
                            onClick={() =>
                              setReview({
                                action: "identity-review",
                                member: i.member,
                                status: s,
                                reason,
                                ...(internalNote ? { internalNote } : {}),
                                ...(s === "VERIFIED"
                                  ? { expires: Date.now() + 30 * 86400000 }
                                  : {}),
                              })
                            }
                          >
                            {labels[s]}
                          </button>
                        ))}
                      </div>
                      <details>
                        <summary>Decision history</summary>
                        {i.timeline.map((e, n) => (
                          <p key={n}>
                            {stamp(e.at)} · {labels[e.status]} · {e.reason}
                          </p>
                        ))}
                      </details>
                    </section>
                  ))}
                </details>
              )}
            </>
          )}
          <div
            className={
              admin && current ? "redemption-admin-workspace" : undefined
            }
          >
            <section className="redemption-panel">
              <h2>{admin ? "Redemption queue" : "Withdrawal history"}</h2>
              <div className="redemption-filters">
                <label>
                  Search requests{admin ? " or members" : ""}
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <label>
                  Status
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="">All statuses</option>
                    {[
                      "REQUESTED",
                      "UNDER_REVIEW",
                      "APPROVED",
                      "PAYMENT_IN_PROGRESS",
                      "SENT",
                      "REJECTED",
                      "CANCELLED",
                      "EXCEPTION",
                      "RETURNED",
                    ].map((s) => (
                      <option key={s} value={s}>
                        {labels[s]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  From (Sydney)
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label>
                  To (Sydney)
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
              </div>
              {!requests.length ? (
                <p>No matching requests.</p>
              ) : (
                <div className="redemption-history">
                  {requests.map((r) => (
                    <button
                      key={r.id}
                      className="redemption-row"
                      onClick={() => {
                        setSelected(r.id);
                        setRevealed(null);
                      }}
                    >
                      <span>
                        <strong>{formatAud(r.audCents)}</strong>
                        <small>
                          {count(r.credits)} credits · •••• {r.last4}
                        </small>
                        {admin && <small>{r.memberLabel ?? r.member}</small>}
                      </span>
                      <span>
                        {labels[r.status]}
                        <small>{stamp(r.requestedAt)}</small>
                        {admin && (
                          <small>
                            Waiting {Math.floor(r.requestedAgeMs / 3600000)}{" "}
                            hours
                            {r.targetAt &&
                            r.targetAt < Date.now() &&
                            ![
                              "SENT",
                              "RETURNED",
                              "CANCELLED",
                              "REJECTED",
                            ].includes(r.status)
                              ? " · Over dispatch target"
                              : ""}
                          </small>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
            {current && (
              <section
                className="redemption-panel"
                aria-label="Request details"
              >
                <h2>
                  {count(current.credits)} credits →{" "}
                  {formatAud(current.audCents)}
                </h2>
                <p>
                  <strong>{labels[current.status]}</strong> · Account ending{" "}
                  {current.last4}
                </p>
                <p>
                  {current.status === "SENT"
                    ? "Staff recorded the EFT as sent. Receipt by your bank is not confirmed."
                    : "Approval is not confirmation of payment."}
                </p>
                <p>
                  Requested {stamp(current.requestedAt)} · Approved{" "}
                  {stamp(current.approvedAt)}
                </p>
                <p>
                  Dispatch target:{" "}
                  {current.targetAt
                    ? stamp(current.targetAt)
                    : "Not configured / not approved"}
                </p>
                <ol className="redemption-timeline">
                  {current.timeline.map((e, n) => (
                    <li key={n}>
                      <strong>{labels[e.status]}</strong>
                      <span>{stamp(e.at)}</span>
                      <p>{e.reason}</p>
                    </li>
                  ))}
                </ol>
                {current.reference && (
                  <p>Payment reference: {current.reference}</p>
                )}
                {current.returnReference && (
                  <p>Return reference: {current.returnReference}</p>
                )}
                <details>
                  <summary>Receipt & ledger references</summary>
                  <p className="redemption-reference">Request {current.id}</p>
                  <p>
                    Rate: {current.rate.credits} credit ={" "}
                    {current.rate.audCents} AUD cent · {current.rate.version}
                  </p>
                  {current.journals.map((j) => (
                    <p className="redemption-reference" key={j}>
                      {j}
                    </p>
                  ))}
                </details>
                {!admin && current.cancellable && (
                  <button
                    disabled={busy}
                    onClick={() => transition("cancel", current.id)}
                  >
                    Cancel request
                  </button>
                )}
                {admin && (
                  <>
                    <p>
                      Current identity: {labels[current.identityStatus]} ·
                      Approval age:{" "}
                      {current.approvalAgeMs === null
                        ? "Not approved"
                        : `${Math.floor(current.approvalAgeMs / 3600000)} hours`}
                    </p>
                    <details>
                      <summary>Internal notes</summary>
                      {current.internalNotes.map((n, i) => (
                        <p key={i}>
                          {stamp(n.at)} · {n.text}
                        </p>
                      ))}
                    </details>
                    <label>
                      Internal note (staff only)
                      <input
                        value={internalNote}
                        onChange={(e) => setInternalNote(e.target.value)}
                      />
                    </label>
                    <label>
                      Customer-facing reason
                      <input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Do not include private notes or bank details"
                      />
                    </label>
                    <label>
                      Bank / reconciliation reference
                      <input
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </label>
                    <div className="redemption-actions">
                      {data.permissions.includes("review") &&
                        ["REQUESTED", "UNDER_REVIEW"].includes(
                          current.status,
                        ) &&
                        ["review", "approve", "reject"].map((a) => (
                          <button
                            key={a}
                            disabled={busy || reason.trim().length < 3}
                            onClick={() => transition(a, current.id)}
                          >
                            {a === "approve"
                              ? "Approve redemption"
                              : a === "reject"
                                ? "Reject & release credits"
                                : "Start request review"}
                          </button>
                        ))}
                      {data.permissions.includes("payment") && (
                        <>
                          {current.status === "APPROVED" && (
                            <button
                              disabled={busy || reason.trim().length < 3}
                              onClick={() => transition("claim", current.id)}
                            >
                              Claim for manual EFT
                            </button>
                          )}
                          {current.status === "PAYMENT_IN_PROGRESS" &&
                            current.claimedBy === data.member && (
                              <button
                                disabled={busy}
                                onClick={() =>
                                  void act({
                                    action: "bank-access",
                                    reference: current.id,
                                  })
                                }
                              >
                                Reveal bank details · access logged
                              </button>
                            )}
                          {["PAYMENT_IN_PROGRESS", "EXCEPTION"].includes(
                            current.status,
                          ) && (
                            <>
                              <button
                                disabled={
                                  busy || !reference || reason.trim().length < 3
                                }
                                onClick={() => transition("sent", current.id)}
                              >
                                Mark EFT sent
                              </button>
                              <button
                                disabled={busy || reason.trim().length < 3}
                                onClick={() =>
                                  transition("exception", current.id)
                                }
                              >
                                Record payment exception
                              </button>
                            </>
                          )}
                          {current.status === "EXCEPTION" && (
                            <button
                              disabled={
                                busy || !reference || reason.trim().length < 3
                              }
                              onClick={() =>
                                transition(
                                  "release-confirmed-unpaid",
                                  current.id,
                                )
                              }
                            >
                              Confirmed unpaid · release credits
                            </button>
                          )}
                          {current.status === "SENT" && (
                            <button
                              disabled={
                                busy || !reference || reason.trim().length < 3
                              }
                              onClick={() => transition("return", current.id)}
                            >
                              Record confirmed EFT return
                            </button>
                          )}
                        </>
                      )}
                    </div>
                    <p className="small-note">
                      No bank transfer is initiated here. Never send a second
                      payment to resolve an unknown outcome; reconcile the first
                      claim.
                    </p>
                  </>
                )}
              </section>
            )}
          </div>
        </>
      )}
      {revealed && (
        <FantasySheet
          title={
            revealed.fixture
              ? "Synthetic identity evidence"
              : "Bank details · audited access"
          }
          onClose={() => setRevealed(null)}
        >
          {revealed.fixture ? (
            <p>{revealed.message}</p>
          ) : (
            <>
              <p>{revealed.holder}</p>
              <p>BSB: {revealed.bsb}</p>
              <p>Account: {revealed.account}</p>
              <p>
                For the claimed payment only. Hidden automatically after 30
                seconds.
              </p>
            </>
          )}
        </FantasySheet>
      )}
      {bankForm && (
        <FantasySheet
          title="Australian bank account"
          onClose={() => {
            setBankForm(false);
            setBank({ holder: "", bsb: "", account: "" });
          }}
        >
          <p>
            Use a synthetic account in this local preview. The account holder
            must match the verified name. Format checks do not verify ownership
            or account existence.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void act({ action: "bank-save", bank });
            }}
          >
            {(
              [
                ["holder", "Account holder name"],
                ["bsb", "BSB · six digits"],
                ["account", "Account number"],
              ] as const
            ).map(([field, label]) => (
              <label key={field}>
                {label}
                <input
                  autoComplete="off"
                  required
                  inputMode={field === "holder" ? "text" : "numeric"}
                  value={bank[field]}
                  onChange={(e) =>
                    setBank({ ...bank, [field]: e.target.value })
                  }
                />
              </label>
            ))}
            <button disabled={busy}>Save destination</button>
          </form>
        </FantasySheet>
      )}
      {review && (
        <FantasySheet title="Confirm action" onClose={() => setReview(null)}>
          {review.action === "submit" ? (
            <>
              <h2>
                Redeem {count(credits)} credits for {formatAud(credits)}
              </h2>
              <p>
                You are redeeming {count(credits)} Docked Credits for{" "}
                {formatAud(credits)}. These credits will be reserved immediately
                and cannot be spent while your request is pending.
              </p>
              <p>
                Australian account ending{" "}
                {data?.destinations.find((d) => d.id === destination)?.last4}
              </p>
            </>
          ) : (
            <>
              <h2>
                {review.action === "sent"
                  ? "Confirm the manual EFT was sent"
                  : review.action === "cancel"
                    ? "Cancel and release reserved credits?"
                    : "Confirm reviewed status change"}
              </h2>
              <p>
                {review.action === "sent"
                  ? "Only confirm after sending the exact amount to the snapshotted destination through your bank. This records sent, not received."
                  : "This action is audited. Release and return actions preserve the original credit classification."}
              </p>
              <p>{String(review.reason ?? "")}</p>
            </>
          )}
          <button
            className="redemption-primary"
            disabled={busy}
            onClick={() => void act(review)}
          >
            {busy
              ? "Confirming…"
              : review.action === "submit"
                ? "Redeem credits"
                : "Confirm"}
          </button>
          <button disabled={busy} onClick={() => setReview(null)}>
            Back
          </button>
        </FantasySheet>
      )}
    </main>
  );
}
