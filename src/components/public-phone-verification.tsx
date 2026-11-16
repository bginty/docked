"use client";
import { useEffect, useRef, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
export function PublicPhoneVerification() {
  const [phone, setPhone] = useState("+61");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [sendAfter, setSendAfter] = useState(0);
  const [verifyAfter, setVerifyAfter] = useState(0);
  const [clock, setClock] = useState(Date.now);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (!sendAfter && !verifyAfter) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sendAfter, verifyAfter]);
  const sendWait = Math.max(0, Math.ceil((sendAfter - clock) / 1000));
  const verifyWait = Math.max(0, Math.ceil((verifyAfter - clock) / 1000));
  async function submit(action: "send" | "verify") {
    if (
      active.current ||
      Date.now() < (action === "send" ? sendAfter : verifyAfter)
    )
      return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    setUncertain(false);
    const started = Date.now();
    setClock(started);
    // Conservatively wait after an uncertain send; only a deliberate click can
    // request another code. The server remains authoritative across devices.
    if (action === "send") setSendAfter(started + 60000);
    let conclusive = false;
    try {
      const response = await boundedFetch(
        "/api/auth/phone",
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            phone,
            ...(action === "verify" ? { token } : {}),
          }),
        },
        // Reserve half a second of the 20-second UI budget for rendering the
        // recovery controls after the complete-response deadline expires.
        19500,
      );
      const result = await response.json();
      conclusive = response.status < 500;
      if (
        Number.isFinite(result.retryAfterSeconds) &&
        result.retryAfterSeconds >= 0
      ) {
        const until =
          Date.now() + Math.min(3600, result.retryAfterSeconds) * 1000;
        if (action === "send") setSendAfter(until);
        else setVerifyAfter(until);
      }
      if (!response.ok) throw Error(result.error);
      if (result.verified) {
        setToken("");
        location.assign("/app/onboarding");
      } else setSent(true);
    } catch (e) {
      if (!conclusive) {
        setUncertain(true);
        if (action === "send") setSent(true);
        setError(
          action === "send"
            ? "We couldn't confirm whether the code was sent. Enter it if it arrives, or wait before requesting another code."
            : "We couldn't confirm verification. Your code is still here; retry verification to check the result.",
        );
      } else setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      active.current = null;
      setBusy(false);
      setClock(Date.now());
    }
  }
  return (
    <form
      className="app-auth-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(sent ? "verify" : "send");
      }}
    >
      <h1>Verify your phone</h1>
      <p>
        Verify an Australian mobile number to use Docked's public account
        features. One verified number can be linked to one account. Supabase
        stores your number and Twilio sends the verification text, including
        through overseas processing. Your number is private on Docked and is not
        used by Docked for marketing. Message records may remain after the code
        expires. Read our Privacy policy for provider retention and deletion
        details. If you cannot use your number, contact support.
        Account-deletion controls remain available without phone verification.
      </p>
      <label className="app-auth-field">
        Australian mobile number (04 or +614)
        <input
          type="tel"
          autoComplete="tel"
          value={phone}
          maxLength={40}
          required
          disabled={busy || sent}
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>
      {sent && (
        <>
          {!uncertain && (
            <p role="status">Enter the code from your text message.</p>
          )}
          <label className="app-auth-field">
            Verification code
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={token}
              minLength={6}
              maxLength={10}
              pattern="[0-9]{6,10}"
              required
              disabled={busy}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        className="button"
        disabled={busy || (sent ? verifyWait > 0 : sendWait > 0)}
      >
        {busy
          ? "Please wait…"
          : sent
            ? uncertain
              ? "Retry verification"
              : "Verify phone"
            : "Send code"}
      </button>
      {sendWait > 0 && (
        <p role="status">You can request another code in {sendWait} seconds.</p>
      )}
      {verifyWait > 0 && (
        <p role="status">You can retry verification in {verifyWait} seconds.</p>
      )}
      {sent && (
        <button
          type="button"
          className="button ghost"
          disabled={busy || sendWait > 0}
          onClick={() => void submit("send")}
        >
          Request another code
        </button>
      )}
      {(sent || error) && (
        <button
          type="button"
          className="button ghost"
          disabled={busy}
          onClick={() => {
            setSent(false);
            setToken("");
            setError("");
            setUncertain(false);
          }}
        >
          Change number
        </button>
      )}
      <p>
        <a href="/privacy">Privacy policy</a> ·{" "}
        <a href="/dashboard#account-controls">Account controls</a> ·{" "}
        <a href="mailto:support@docked.com.au">Contact support</a>
      </p>
    </form>
  );
}
