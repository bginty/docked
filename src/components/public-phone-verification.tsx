"use client";
import { useState } from "react";
export function PublicPhoneVerification() {
  const [phone, setPhone] = useState("+61");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(action: "send" | "verify") {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          phone,
          ...(action === "verify" ? { token } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error);
      if (result.verified) {
        setToken("");
        location.assign("/app/onboarding");
      } else setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
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
        Use one verified phone number for your Docked account. Your number is
        private and is not displayed on your profile.
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
          <p role="status">Code requested. Enter it when it arrives.</p>
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
      <button className="button" disabled={busy}>
        {busy ? "Please wait…" : sent ? "Verify phone" : "Send code"}
      </button>
      {sent && (
        <button
          type="button"
          className="button ghost"
          disabled={busy}
          onClick={() => {
            setSent(false);
            setToken("");
          }}
        >
          Change number or request another code
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
