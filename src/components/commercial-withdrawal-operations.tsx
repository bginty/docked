"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import type { OwnerWithdrawalPageData } from "@/server/commercial-withdrawal-service";
import type { CommercialWithdrawalOwnerCommand } from "@/core/commercial-withdrawals";

const aud = (cents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    cents / 100,
  );
type BankReveal = {
  holder: string;
  bsb: string;
  account: string;
  reference: string;
  expiresAt: string;
};
const noAutomaticPayment =
  "These controls record a bank transfer made by an authorised person. They do not send money.";

export function CommercialWithdrawalOperations() {
  const [data, setData] = useState<OwnerWithdrawalPageData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [selected, setSelected] = useState("");
  const [confirmedSent, setConfirmedSent] = useState(false);
  const [revealed, setRevealed] = useState<BankReveal | null>(null);
  const pending = useRef<{
    expectedOwner: string;
    request: string;
    command: CommercialWithdrawalOwnerCommand;
  } | null>(null);
  const stopReference = useRef<{ request: string; reason: string } | null>(
    null,
  );
  const lock = useRef(false);
  const owner = useRef<string | null>(null);
  const lookupReference = useRef("");

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const query = lookupReference.current
      ? `?id=${encodeURIComponent(lookupReference.current)}`
      : "";
    const response = await fetch("/api/admin/withdrawals" + query, {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    const result = await response.json();
    if (!response.ok)
      throw Error(result.error ?? "Withdrawal operations are unavailable.");
    if (!signal?.aborted) {
      const next = result as OwnerWithdrawalPageData;
      if (owner.current && owner.current !== next.owner) {
        pending.current = null;
        setUncertain(false);
        setRevealed(null);
        setSelected("");
      }
      owner.current = next.owner;
      setData(next);
      if (lookupReference.current) setSelected(lookupReference.current);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch((failure) => {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Withdrawal operations are unavailable.",
        );
    });
    return () => controller.abort();
  }, [refresh]);

  useEffect(() => {
    if (!revealed) return;
    const clear = () => setRevealed(null);
    const timer = window.setTimeout(
      clear,
      Math.max(0, Date.parse(revealed.expiresAt) - Date.now()),
    );
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
    };
  }, [revealed]);

  async function post(path: string, body: unknown) {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    return { response, result };
  }

  async function command(value?: CommercialWithdrawalOwnerCommand) {
    if (!data || lock.current) return;
    if (value && pending.current) {
      setError("Recover the pending operation before creating another.");
      return;
    }
    if (value)
      pending.current = {
        expectedOwner: data.owner,
        request: crypto.randomUUID(),
        command: value,
      };
    if (!pending.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    setRevealed(null);
    try {
      const { response, result } = await post(
        "/api/admin/withdrawals",
        pending.current,
      );
      if (!response.ok) {
        if (result.outcome === "rejected") {
          pending.current = null;
          setUncertain(false);
        } else setUncertain(true);
        throw Error(result.error ?? "Operation not confirmed.");
      }
      pending.current = null;
      setUncertain(false);
      setConfirmedSent(false);
      setMessage(
        "Operation recorded. Review the updated state before continuing.",
      );
      await refresh();
    } catch (failure) {
      if (pending.current) setUncertain(true);
      setError(
        failure instanceof Error
          ? failure.message
          : "The outcome is uncertain. Retry the original operation.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function stop() {
    if (!data || reason.trim().length < 12 || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setRevealed(null);
    stopReference.current ??= { request: crypto.randomUUID(), reason };
    try {
      const { response, result } = await post("/api/admin/withdrawals", {
        expectedOwner: data.owner,
        request: stopReference.current.request,
        command: { kind: "stop", reason: stopReference.current.reason },
      });
      if (!response.ok)
        throw Error(result.error ?? "Stop was not confirmed. Retry this stop.");
      stopReference.current = null;
      setMessage(
        "New withdrawal requests and new payment claims are stopped. Existing payment records and recovery remain available.",
      );
      await refresh();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Stop was not confirmed. Retry this stop.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function reveal(kind: "payment" | "destination", id: string) {
    if (!data || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setRevealed(null);
    try {
      const { response, result } = await post("/api/admin/withdrawals/bank", {
        expectedOwner: data.owner,
        kind,
        id,
        reason,
      });
      if (!response.ok)
        throw Error(result.error ?? "Bank details were not available.");
      setRevealed({
        ...result.bank,
        reference: id,
        expiresAt: result.expiresAt,
      });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Bank details were not available.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  const request = data?.requests.find((item) => item.id === selected);
  const referencesReady =
    evidence.trim().length >= 8 && reason.trim().length >= 12;
  const canAct = !busy && !uncertain;
  const existing = request
    ? { id: request.id, expectedRevision: request.revision }
    : null;

  function recordFunding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const cash = String(values.get("cash") ?? "");
    if (!/^\d+\.\d{2}$/.test(cash)) {
      setError("Enter the actual settled AUD amount with two decimal places.");
      return;
    }
    const [whole, fraction] = cash.split(".");
    const cents = BigInt(whole) * 100n + BigInt(fraction);
    if (cents <= 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) {
      setError("Check the settled cash amount.");
      return;
    }
    void command({
      kind: "record-funding",
      receipt: String(values.get("receipt")),
      netCashCents: Number(cents),
      bankReference: String(values.get("bankReference")),
      evidenceReference: String(values.get("evidenceReference")),
      settledAt: new Date(String(values.get("settledAt"))).toISOString(),
      availableAt: new Date(String(values.get("availableAt"))).toISOString(),
    });
  }

  return (
    <div className="withdrawals commercial-withdrawal-operations">
      <Link href="/admin/operations">Commercial operations</Link>
      <h1>Withdrawal operations</h1>
      <p>{noAutomaticPayment}</p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {uncertain && (
        <section className="app-panel">
          <h2>Recover the last operation</h2>
          <p>
            Its result is uncertain. Keep its original reference and recover the
            recorded outcome before making another payment.
          </p>
          <button disabled={busy} onClick={() => void command()}>
            Retry original operation
          </button>
        </section>
      )}
      {!data ? (
        <button
          disabled={busy}
          onClick={() =>
            void refresh().catch((failure) => setError(failure.message))
          }
        >
          Reload withdrawal operations
        </button>
      ) : (
        <>
          <section className="app-panel">
            <h2>Availability</h2>
            <p>
              New requests:{" "}
              <strong>{data.requestsEnabled ? "Open" : "Stopped"}</strong> · New
              payment claims:{" "}
              <strong>{data.paymentsEnabled ? "Open" : "Stopped"}</strong>
            </p>
            {data.reason && <p>{data.reason}</p>}
            <p>
              Published cash terms:{" "}
              {data.setup.published ? "Configured" : "Pending"} · Identity
              provider:{" "}
              {data.setup.identityConfigured ? "Configured" : "Pending"} · Bank
              encryption:{" "}
              {data.setup.bankProtectionConfigured ? "Configured" : "Pending"}
            </p>
            <p>
              Policy schedule:{" "}
              {data.configuredPolicyVersion ?? "Not configured"}
            </p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void refresh().catch((failure) => setError(failure.message))
              }
            >
              Refresh queue
            </button>
          </section>
          <section className="app-panel">
            <h2>Review evidence</h2>
            <p>
              Enter references to the actual supporting records. Keep identity
              documents and full bank details out of these notes.
            </p>
            <label>
              Reason for the action
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={12}
                maxLength={600}
              />
            </label>
            <label>
              Evidence reference
              <input
                value={evidence}
                onChange={(event) => setEvidence(event.target.value)}
                minLength={8}
                maxLength={240}
              />
            </label>
            <button
              className="button secondary"
              disabled={busy || reason.trim().length < 12}
              onClick={() => void stop()}
            >
              Stop new requests and new bank payments
            </button>
          </section>
          {revealed && (
            <section className="app-panel" aria-label="Sensitive bank details">
              <h2>Bank details — temporary display</h2>
              <p>Reference {revealed.reference}</p>
              <dl>
                <dt>Account holder</dt>
                <dd>{revealed.holder}</dd>
                <dt>BSB</dt>
                <dd>{revealed.bsb}</dd>
                <dt>Account number</dt>
                <dd>{revealed.account}</dd>
              </dl>
              <p>
                This display closes after 30 seconds or when you leave this
                window. Access has been audited.
              </p>
              <button onClick={() => setRevealed(null)}>
                Hide bank details
              </button>
            </section>
          )}
          <section className="app-panel">
            <h2>Bank ownership reviews</h2>
            <p>
              A matching account-holder name alone does not establish bank
              ownership. Review evidence from the member and the bank before
              approving.
            </p>
            {data.destinations.length === 0 ? (
              <p>No bank destinations.</p>
            ) : (
              data.destinations.map((item) => (
                <article key={item.id} className="withdrawal-history-item">
                  <h3>
                    Account {item.mask} ·{" "}
                    {item.verified ? "Verified" : "Review needed"}
                  </h3>
                  <p>Member {item.memberId}</p>
                  <p>
                    Identity revision {item.identityRevision} · Current status{" "}
                    {item.currentIdentityStatus ?? "Unavailable"}
                  </p>
                  <div className="actions">
                    <button
                      disabled={!canAct || reason.trim().length < 12}
                      onClick={() => void reveal("destination", item.id)}
                    >
                      Review bank details
                    </button>
                    <button
                      disabled={
                        !canAct ||
                        !referencesReady ||
                        item.identityRevision !==
                          item.currentIdentityRevision ||
                        item.currentIdentityStatus !== "approved"
                      }
                      onClick={() =>
                        void command({
                          kind: "verify-destination",
                          destination: item.id,
                          identityRevision: item.identityRevision,
                          verified: true,
                          evidenceReference: evidence,
                          reason,
                        })
                      }
                    >
                      Record ownership verified
                    </button>
                    <button
                      className="button secondary"
                      disabled={!canAct || !referencesReady}
                      onClick={() =>
                        void command({
                          kind: "verify-destination",
                          destination: item.id,
                          identityRevision: item.identityRevision,
                          verified: false,
                          evidenceReference: evidence,
                          reason,
                        })
                      }
                    >
                      Record ownership not verified
                    </button>
                  </div>
                </article>
              ))
            )}
          </section>
          <section className="app-panel">
            <h2>Withdrawal queue</h2>
            <p>
              {data.openRequests} open requests across {data.totalRequests}{" "}
              recorded requests. The queue shows up to 200, with open requests
              first. You can retrieve any older request by its reference.
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                lookupReference.current = String(
                  new FormData(event.currentTarget).get("reference") ?? "",
                ).trim();
                setRevealed(null);
                void refresh().catch((failure) => setError(failure.message));
              }}
            >
              <label>
                Find a withdrawal by reference
                <input
                  name="reference"
                  pattern="[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}"
                  required
                />
              </label>
              <div className="actions">
                <button disabled={busy}>Find request</button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    lookupReference.current = "";
                    setSelected("");
                    setRevealed(null);
                    void refresh().catch((failure) =>
                      setError(failure.message),
                    );
                  }}
                >
                  Show open queue
                </button>
              </div>
            </form>
            <label>
              Withdrawal
              <select
                value={selected}
                onChange={(event) => {
                  setSelected(event.target.value);
                  setRevealed(null);
                  setBankReference("");
                  setConfirmedSent(false);
                }}
              >
                <option value="">Select a request</option>
                {data.requests.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.status} · {aud(item.audCents)} · {item.id}
                  </option>
                ))}
              </select>
            </label>
            {request && existing && (
              <>
                <h3>
                  {aud(request.audCents)} · {request.status}
                </h3>
                <p>
                  Member {request.memberId} · Account {request.destinationMask}
                </p>
                <p>
                  {request.credits.toLocaleString("en-AU")} credits · Fee{" "}
                  {aud(request.feeCents)} · Revision {request.revision}
                </p>
                <p>Request {request.id}</p>
                <div className="actions">
                  {["REQUESTED", "UNDER_REVIEW", "APPROVED"].includes(
                    request.status,
                  ) && (
                    <>
                      <button
                        disabled={!canAct || reason.trim().length < 12}
                        onClick={() =>
                          void command({
                            kind: "review",
                            ...existing,
                            decision: "approve",
                            reason,
                          })
                        }
                      >
                        Approve after review
                      </button>
                      <button
                        className="button secondary"
                        disabled={!canAct || reason.trim().length < 12}
                        onClick={() =>
                          void command({
                            kind: "review",
                            ...existing,
                            decision: "reject",
                            reason,
                          })
                        }
                      >
                        Decline and restore credits
                      </button>
                    </>
                  )}
                  {request.status === "APPROVED" && (
                    <button
                      disabled={!canAct || !data.paymentsEnabled}
                      onClick={() =>
                        void command({ kind: "claim", ...existing })
                      }
                    >
                      Claim for manual bank payment
                    </button>
                  )}
                  {["PAYMENT_IN_PROGRESS", "EXCEPTION"].includes(
                    request.status,
                  ) &&
                    request.claimedBy === data.owner && (
                      <button
                        disabled={!canAct || reason.trim().length < 12}
                        onClick={() => void reveal("payment", request.id)}
                      >
                        Reveal this payment’s bank details
                      </button>
                    )}
                </div>
                {[
                  "PAYMENT_IN_PROGRESS",
                  "EXCEPTION",
                  "SENT",
                  "RECONCILED",
                ].includes(request.status) && (
                  <div>
                    <label>
                      Unique bank transaction reference
                      <input
                        value={bankReference}
                        onChange={(event) =>
                          setBankReference(event.target.value)
                        }
                        minLength={8}
                        maxLength={240}
                      />
                    </label>
                    {["PAYMENT_IN_PROGRESS", "EXCEPTION"].includes(
                      request.status,
                    ) && (
                      <>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={confirmedSent}
                            onChange={(event) =>
                              setConfirmedSent(event.target.checked)
                            }
                          />
                          I checked the bank and personally confirm this exact
                          payment was sent.
                        </label>
                        <button
                          disabled={
                            !canAct ||
                            request.claimedBy !== data.owner ||
                            !confirmedSent ||
                            bankReference.trim().length < 8 ||
                            evidence.trim().length < 8
                          }
                          onClick={() =>
                            void command({
                              kind: "record-sent",
                              ...existing,
                              bankReference,
                              evidenceReference: evidence,
                              confirmed: true,
                            })
                          }
                        >
                          Record payment already sent
                        </button>
                        <button
                          className="button secondary"
                          disabled={!canAct || reason.trim().length < 12}
                          onClick={() =>
                            void command({
                              kind: "exception",
                              ...existing,
                              reason,
                            })
                          }
                        >
                          Keep reserved for investigation
                        </button>
                        <button
                          className="button secondary"
                          disabled={!canAct || !referencesReady}
                          onClick={() =>
                            void command({
                              kind: "release-unpaid",
                              ...existing,
                              evidenceReference: evidence,
                              reason,
                            })
                          }
                        >
                          Record confirmed unpaid and restore credits
                        </button>
                      </>
                    )}
                    {request.status === "SENT" && (
                      <button
                        disabled={!canAct || evidence.trim().length < 8}
                        onClick={() =>
                          void command({
                            kind: "reconcile",
                            ...existing,
                            evidenceReference: evidence,
                          })
                        }
                      >
                        Record bank reconciliation
                      </button>
                    )}
                    {["SENT", "RECONCILED"].includes(request.status) && (
                      <button
                        className="button secondary"
                        disabled={
                          !canAct ||
                          !referencesReady ||
                          bankReference.trim().length < 8
                        }
                        onClick={() =>
                          void command({
                            kind: "returned",
                            ...existing,
                            bankReference,
                            evidenceReference: evidence,
                            reason,
                          })
                        }
                      >
                        Record actual bank return and restore credits
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
          <section className="app-panel">
            <h2>Refund and funding exceptions</h2>
            {data.exposures.length === 0 ? (
              <p>No recorded source-funding exceptions.</p>
            ) : (
              data.exposures.map((item) => (
                <article
                  className="withdrawal-history-item"
                  key={item.allocation}
                >
                  <p>
                    Member {item.memberId} · Request {item.withdrawal} ·{" "}
                    {item.credits} credits · Source {item.sourceState}
                  </p>
                  <p>Receipt {item.receipt}</p>
                  <button
                    disabled={!canAct || !referencesReady}
                    onClick={() =>
                      void command({
                        kind: "resolve-exposure",
                        allocation: item.allocation,
                        evidenceReference: evidence,
                        reason,
                      })
                    }
                  >
                    Record completed financial remedy
                  </button>
                </article>
              ))
            )}
          </section>
          <details className="app-panel">
            <summary>Record actual cash backing</summary>
            <p>
              Use settled money in Docked’s bank, allocated once to its source
              receipt. Gross Google charges are not settled cash. Include an
              evidence reference to the reconciled statement allocation.
            </p>
            <form onSubmit={recordFunding}>
              <fieldset disabled={!canAct}>
                <label>
                  Source receipt key
                  <input name="receipt" pattern="[a-f0-9]{64}" required />
                </label>
                <label>
                  Actual allocated cash — AUD
                  <input
                    name="cash"
                    inputMode="decimal"
                    pattern="[0-9]+\.[0-9]{2}"
                    placeholder="0.00"
                    required
                  />
                </label>
                <label>
                  Unique bank allocation reference
                  <input
                    name="bankReference"
                    minLength={8}
                    maxLength={240}
                    required
                  />
                </label>
                <label>
                  Statement reconciliation evidence
                  <input
                    name="evidenceReference"
                    minLength={8}
                    maxLength={240}
                    required
                  />
                </label>
                <label>
                  Settled at — local browser time
                  <input type="datetime-local" name="settledAt" required />
                </label>
                <label>
                  Available from — local browser time
                  <input type="datetime-local" name="availableAt" required />
                </label>
                <button>Record reconciled cash backing</button>
              </fieldset>
            </form>
          </details>
        </>
      )}
    </div>
  );
}
