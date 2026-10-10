"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function MfaForm({ next = "/app" }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState("loading"),
    [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(""),
    [code, setCode] = useState("");
  const [setup, setSetup] = useState<{
    qrCode: string;
    setupKey: string;
  } | null>(null);
  const send = useCallback(
    async (action: string, value?: string) => {
      setBusy(true);
      setMessage("");
      try {
        const response = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ action, code: value, next, app: true }),
        });
        const result = await response.json();
        if (result.error) {
          setMessage(result.error);
          return;
        }
        if (result.redirect) {
          setSetup(null);
          setCode("");
          router.replace(result.redirect);
          router.refresh();
          return;
        }
        if (result.qrCode && result.setupKey)
          setSetup({ qrCode: result.qrCode, setupKey: result.setupKey });
        setMode(result.mode);
      } catch {
        setMessage(
          "Unable to reach the account service. Your verification is not confirmed.",
        );
      } finally {
        setBusy(false);
      }
    },
    [next, router],
  );
  useEffect(() => {
    void send("mfa_status");
  }, [send]);
  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!busy) await send("mfa_verify", code);
  }
  return (
    <div className="app-auth-form">
      {mode === "loading" && <p>Checking your secure session…</p>}
      {mode === "loading" && message && (
        <button
          className="button"
          disabled={busy}
          onClick={() => void send("mfa_status")}
        >
          Check session again
        </button>
      )}
      {mode === "enroll" && (
        <>
          <p>
            Add Docked to your authenticator app. This setup is only needed
            once.
          </p>
          <button
            className="button"
            disabled={busy}
            onClick={() => void send("mfa_enroll")}
          >
            Set up authenticator
          </button>
        </>
      )}
      {setup && (
        <section aria-label="Authenticator setup" className="app-auth-form">
          <p>Scan this QR code with your authenticator app. Keep it private.</p>
          {/* Provider QR is rendered as an image, never injected as HTML. */}
          <img
            src={setup.qrCode}
            alt="Scan to add Docked to your authenticator"
            width="220"
            height="220"
            className="mfa-qr"
          />
          <details>
            <summary>Can’t scan? Use the manual setup key</summary>
            <p>
              Enter this key once when adding Docked to your authenticator. It
              is not your sign-in code.
            </p>
            <code className="mfa-setup-key">{setup.setupKey}</code>
          </details>
        </section>
      )}
      {(mode === "challenge" || mode === "enroll-code") && (
        <form onSubmit={verify} className="app-auth-form">
          <p>
            {mode === "challenge"
              ? "Open your existing authenticator and enter Docked’s current six-digit code."
              : "Enter the six-digit code to finish setup."}
          </p>
          <label className="app-auth-field">
            Authenticator code
            <input
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              minLength={6}
              required
              value={code}
              onPaste={(event) => {
                event.preventDefault();
                setCode(
                  event.clipboardData
                    .getData("text")
                    .replace(/\D/g, "")
                    .slice(0, 6),
                );
              }}
              onChange={(event) =>
                setCode(
                  event.target.value
                    .replace(/\s/g, "")
                    .replace(/\D/g, "")
                    .slice(0, 6),
                )
              }
            />
          </label>
          <button className="button" disabled={busy || code.length !== 6}>
            {busy ? "Verifying…" : "Verify and continue"}
          </button>
        </form>
      )}
      <p className="app-auth-message" role="status">
        {message}
      </p>
    </div>
  );
}
