"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { isDockedNative } from "./native-bridge";
import type { MemberWithdrawalPageData } from "@/server/commercial-withdrawal-service";
import type { CommercialWithdrawalMemberCommand } from "@/core/commercial-withdrawals";

const aud = (cents: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    cents / 100,
  );
const count = (value: number) => value.toLocaleString("en-AU");
const statusNames: Record<string, string> = {
  REQUESTED: "Requested",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  PAYMENT_IN_PROGRESS: "Payment in progress",
  EXCEPTION: "Payment needs review",
  SENT: "Sent to bank",
  RECONCILED: "Payment reconciled",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
  RELEASED: "Confirmed unpaid — credits restored",
  RETURNED: "Returned by bank — credits restored",
};

export function CommercialWithdrawals() {
  const [data, setData] = useState<MemberWithdrawalPageData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [platform, setPlatform] = useState<"loading" | "web" | "native">(
    "loading",
  );
  const [credits, setCredits] = useState("");
  const [destination, setDestination] = useState("");
  const [consent, setConsent] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const pending = useRef<{
    expectedMember: string;
    request: string;
    command: CommercialWithdrawalMemberCommand;
  } | null>(null);
  const lock = useRef(false);
  const bankForm = useRef<HTMLFormElement>(null);
  const alive = useRef(true);
  const member = useRef<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/commercial-withdrawals", {
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    const result = await response.json();
    if (!response.ok)
      throw Error(result.error ?? "Withdrawals could not be loaded.");
    if (alive.current && !signal?.aborted) {
      const next = result as MemberWithdrawalPageData;
      if (member.current && member.current !== next.member) {
        pending.current = null;
        setUnknown(false);
        setCredits("");
        setDestination("");
        bankForm.current?.reset();
      }
      member.current = next.member;
      setData(next);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    setPlatform(isDockedNative() ? "native" : "web");
    const controller = new AbortController();
    void refresh(controller.signal).catch((failure) => {
      if (!controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : "Withdrawals could not be loaded.",
        );
    });
    return () => {
      alive.current = false;
      controller.abort();
      pending.current = null;
    };
  }, [refresh]);

  async function action(path: string, body: unknown) {
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

  async function command(command?: CommercialWithdrawalMemberCommand) {
    if (!data || lock.current) return;
    if (command && pending.current) {
      setError("Resolve the pending request before starting another.");
      return;
    }
    if (command)
      pending.current = {
        expectedMember: data.member,
        request: crypto.randomUUID(),
        command,
      };
    if (!pending.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { response, result } = await action(
        "/api/commercial-withdrawals",
        pending.current,
      );
      if (!response.ok) {
        if (result.outcome === "rejected") {
          pending.current = null;
          setUnknown(false);
        } else setUnknown(true);
        throw Error(result.error ?? "The request could not be confirmed.");
      }
      pending.current = null;
      setUnknown(false);
      setCredits("");
      setMessage(
        "Your request has been recorded. The latest status appears below.",
      );
      await refresh();
    } catch (failure) {
      if (pending.current) setUnknown(true);
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not confirm the outcome. Retry the same request.",
      );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function identity(actionName: "start" | "refresh") {
    if (!data || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { response, result } = await action(
        "/api/commercial-withdrawals/identity",
        { expectedMember: data.member, action: actionName, confirmed: true },
      );
      if (!response.ok)
        throw Error(
          result.error ?? "Identity verification could not be confirmed.",
        );
      if (actionName === "start") {
        const url = new URL(result.url);
        if (
          url.protocol !== "https:" ||
          url.hostname !== "in.sumsub.com" ||
          !url.pathname.startsWith("/websdk/p/")
        )
          throw Error("Verification link unavailable.");
        window.location.assign(url.href);
      } else {
        await refresh();
        setMessage("Identity status refreshed.");
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Identity verification could not be confirmed.",
      );
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  async function saveBank(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data?.identity || lock.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const body = {
      expectedMember: data.member,
      destination: crypto.randomUUID(),
      identityRevision: data.identity.revision,
      bank: {
        holder: String(values.get("holder") ?? ""),
        bsb: String(values.get("bsb") ?? ""),
        account: String(values.get("account") ?? ""),
      },
    };
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { response, result } = await action(
        "/api/commercial-withdrawals/destination",
        body,
      );
      if (!response.ok)
        throw Error(
          result.error ??
            "The bank account could not be saved. Refresh the list before trying again.",
        );
      form.reset();
      await refresh();
      setMessage(
        "Bank details saved for ownership review. You can request a withdrawal after approval.",
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Bank setup was not confirmed. Refresh the list before trying again.",
      );
    } finally {
      form.reset();
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }

  const policy = data?.policy;
  const amount = Number(credits);
  const numerator =
    policy && Number.isSafeInteger(amount) && amount > 0
      ? BigInt(amount) * BigInt(policy.rate.audCents)
      : null;
  const denominator = policy ? BigInt(policy.rate.credits) : 1n;
  const gross =
    numerator !== null &&
    numerator % denominator === 0n &&
    numerator / denominator <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(numerator / denominator)
      : null;
  const payable =
    gross !== null && Number.isSafeInteger(gross) && policy
      ? gross - policy.feeCents
      : null;
  const bank = data?.destinations.find(
    (item) =>
      item.id === destination &&
      item.verified &&
      item.identityRevision === data.identity?.revision,
  );
  const canRequest =
    platform === "web" &&
    data?.enabled &&
    policy &&
    bank &&
    data.identity?.status === "approved" &&
    Number.isSafeInteger(amount) &&
    amount >= policy.minimumCredits &&
    amount <= Math.min(policy.maximumCredits, data.money.eligible) &&
    payable !== null &&
    payable > 0;

  return (
    <main className="withdrawals commercial-withdrawals">
      <Link href="/fantasy/profile">Back to your profile</Link>
      <h1>Cash withdrawals</h1>
      <p>
        Withdraw eligible, settled card-sale proceeds to your verified
        Australian bank account. Purchased credits and test credits are not
        eligible for voluntary cash withdrawal.
      </p>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {unknown && (
        <section className="app-panel">
          <h2>Check your pending request</h2>
          <p>
            The result is uncertain. Retry the same request to recover its
            recorded outcome, or refresh your history.
          </p>
          <button disabled={busy} onClick={() => void command()}>
            Retry the same request
          </button>
        </section>
      )}
      {!data ? (
        <p aria-live="polite">Loading your withdrawal details…</p>
      ) : (
        <>
          <section className="app-panel">
            <h2>Your credits</h2>
            <dl className="commercial-facts">
              <div>
                <dt>Available to spend</dt>
                <dd>{count(data.money.available)} credits</dd>
              </div>
              <div>
                <dt>Eligible to withdraw now</dt>
                <dd>{count(data.money.eligible)} credits</dd>
              </div>
              <div>
                <dt>Reserved for withdrawals</dt>
                <dd>{count(data.money.pending)} credits</dd>
              </div>
            </dl>
            {!data.enabled && (
              <p role="status">
                {data.reason ??
                  "New withdrawal requests are currently unavailable."}
              </p>
            )}
            <p>
              Credits reserved for a withdrawal cannot also be spent or traded.
              Existing requests remain in your history while new requests are
              paused.
            </p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void refresh().catch((failure) => setError(failure.message))
              }
            >
              Refresh details
            </button>
          </section>
          {platform === "native" && (
            <section className="app-panel">
              <h2>Manage withdrawals on the website</h2>
              <p>
                Sign in at docked.com.au to complete verification, manage bank
                details and request cash withdrawals.
              </p>
              <button
                onClick={() =>
                  void import("@capacitor/browser")
                    .then(({ Browser }) =>
                      Browser.open({
                        url: "https://docked.com.au/profile/withdrawals",
                      }),
                    )
                    .catch(() =>
                      setError(
                        "Open docked.com.au/profile/withdrawals in your browser.",
                      ),
                    )
                }
              >
                Open Docked website
              </button>
            </section>
          )}
          {policy && (
            <section className="app-panel">
              <h2>Current withdrawal terms</h2>
              <dl>
                <dt>Conversion</dt>
                <dd>
                  {count(policy.rate.credits)} credits ={" "}
                  {aud(policy.rate.audCents)}
                </dd>
                <dt>Minimum</dt>
                <dd>{count(policy.minimumCredits)} credits</dd>
                <dt>Maximum per request</dt>
                <dd>{count(policy.maximumCredits)} credits</dd>
                <dt>Daily maximum</dt>
                <dd>{count(policy.dailyMaximumCredits)} credits</dd>
                <dt>Withdrawal fee</dt>
                <dd>{aud(policy.feeCents)}</dd>
              </dl>
              <p>
                Your request fixes the quoted amount and fee. A confirmed unpaid
                or returned payment restores its reserved credits, including the
                withdrawal fee allocation. Processing time depends on review and
                bank settlement; the current status appears below.
              </p>
              <p>
                <Link href="/commercial-policy">
                  Credit and withdrawal policy
                </Link>{" "}
                · <Link href="/privacy">Privacy policy</Link>
              </p>
            </section>
          )}
          {platform === "web" && data.setup.published && (
            <>
              <section className="app-panel">
                <h2>1. Verify your identity</h2>
                <p>
                  Status:{" "}
                  <strong>{data.identity?.status ?? "Not started"}</strong>
                </p>
                <p>
                  Verification checks your identity, age and Australian
                  residence. Documents are provided directly to our verification
                  provider. Docked stores verification evidence and status for
                  withdrawal review.
                </p>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  I have read the <Link href="/privacy">Privacy policy</Link>{" "}
                  and want to continue to identity verification.
                </label>
                <div className="actions">
                  <button
                    disabled={
                      busy || !consent || !data.setup.identityConfigured
                    }
                    onClick={() => void identity("start")}
                  >
                    Start or continue verification
                  </button>
                  <button
                    className="button secondary"
                    disabled={busy || !data.setup.identityConfigured}
                    onClick={() => void identity("refresh")}
                  >
                    Check verification status
                  </button>
                </div>
              </section>
              <section className="app-panel">
                <h2>2. Verify your bank account</h2>
                {data.destinations.map((item) => (
                  <p key={item.id}>
                    Account {item.mask}:{" "}
                    {item.identityRevision !== data.identity?.revision
                      ? "Identity changed — add current details"
                      : item.verified
                        ? "Ownership verified"
                        : "Awaiting ownership review"}
                  </p>
                ))}
                <p>
                  Use an Australian account in your verified legal name.
                  Matching names is followed by a separate bank-ownership
                  review.
                </p>
                <form
                  ref={bankForm}
                  onSubmit={(event) => void saveBank(event)}
                  autoComplete="off"
                >
                  <fieldset
                    disabled={
                      busy ||
                      unknown ||
                      data.identity?.status !== "approved" ||
                      !data.setup.bankProtectionConfigured
                    }
                  >
                    <label>
                      Account holder
                      <input
                        name="holder"
                        required
                        minLength={2}
                        maxLength={120}
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      BSB — 6 digits
                      <input
                        name="bsb"
                        required
                        pattern="[0-9]{6}"
                        inputMode="numeric"
                        maxLength={6}
                        autoComplete="off"
                      />
                    </label>
                    <label>
                      Account number
                      <input
                        name="account"
                        required
                        pattern="[0-9]{5,10}"
                        inputMode="numeric"
                        minLength={5}
                        maxLength={10}
                        autoComplete="off"
                      />
                    </label>
                    <button type="submit">Save for ownership review</button>
                  </fieldset>
                </form>
              </section>
              <section className="app-panel">
                <h2>3. Request a withdrawal</h2>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (canRequest && policy && data.identity)
                      void command({
                        kind: "request",
                        credits: amount,
                        destination,
                        identityRevision: data.identity.revision,
                        policyVersion: policy.version,
                      });
                  }}
                >
                  <fieldset disabled={busy || unknown || !data.enabled}>
                    <label>
                      Verified bank account
                      <select
                        value={destination}
                        onChange={(event) => setDestination(event.target.value)}
                        required
                      >
                        <option value="">Choose an account</option>
                        {data.destinations
                          .filter(
                            (item) =>
                              item.verified &&
                              item.identityRevision === data.identity?.revision,
                          )
                          .map((item) => (
                            <option key={item.id} value={item.id}>
                              Account {item.mask}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      Credits to withdraw
                      <input
                        type="number"
                        value={credits}
                        onChange={(event) => setCredits(event.target.value)}
                        min={policy?.minimumCredits ?? 1}
                        max={
                          policy
                            ? Math.min(
                                policy.maximumCredits,
                                data.money.eligible,
                              )
                            : undefined
                        }
                        step="1"
                        inputMode="numeric"
                        required
                      />
                    </label>
                    {payable !== null && payable > 0 && (
                      <p>
                        Bank payment: <strong>{aud(payable)}</strong> after a{" "}
                        {aud(policy?.feeCents ?? 0)} withdrawal fee.
                      </p>
                    )}
                    <button type="submit" disabled={!canRequest}>
                      Confirm withdrawal request
                    </button>
                  </fieldset>
                </form>
              </section>
            </>
          )}
          <section className="app-panel">
            <h2>Withdrawal history</h2>
            <p>
              Up to 100 recent requests are shown. Your account export includes
              your full recorded withdrawal history.
            </p>
            {data.requests.length === 0 ? (
              <p>No withdrawal requests.</p>
            ) : (
              data.requests.map((request) => (
                <article className="withdrawal-history-item" key={request.id}>
                  <h3>
                    {aud(request.audCents)} ·{" "}
                    {statusNames[request.status] ?? request.status}
                  </h3>
                  <p>
                    {count(request.credits)} credits · Account{" "}
                    {request.destinationMask} · Fee {aud(request.feeCents)}
                  </p>
                  <p>
                    {request.createdAt &&
                      new Date(request.createdAt).toLocaleString("en-AU", {
                        timeZone: "Australia/Sydney",
                      })}{" "}
                    Sydney
                  </p>
                  <p className="small-note">Reference {request.id}</p>
                  {["REQUESTED", "UNDER_REVIEW", "APPROVED"].includes(
                    request.status,
                  ) && (
                    <button
                      className="button secondary"
                      disabled={busy || unknown}
                      onClick={() =>
                        void command({
                          kind: "cancel",
                          id: request.id,
                          expectedRevision: request.revision,
                        })
                      }
                    >
                      Cancel request and restore credits
                    </button>
                  )}
                </article>
              ))
            )}
          </section>
        </>
      )}
    </main>
  );
}
