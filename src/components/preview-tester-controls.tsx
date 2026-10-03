"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
const capabilities = [
  "community_social",
  "public_profiles",
  "preview_market_fixtures",
  "preview_top_docked",
];
export function PreviewTesterControls({
  action,
  id,
}: {
  action: "invite" | "grant" | "revoke_grant" | "revoke_invitation";
  id?: string;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [code, setCode] = useState("");
  useEffect(() => setReady(true), []);
  const revoke = action.startsWith("revoke");
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || busy) return;
    const form = event.currentTarget,
      data = new FormData(form);
    setBusy(true);
    setMessage("");
    setCode("");
    try {
      const response = await fetch("/api/admin/preview-testers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          id,
          ...Object.fromEntries(data),
          ...(!revoke
            ? { hours: Number(data.get("hours")), capabilities }
            : {}),
        }),
      });
      const result = await response.json();
      setMessage(result.error ?? result.message ?? "Request completed.");
      if (response.ok && result.ok) {
        if (result.invitationCode) setCode(result.invitationCode);
        form.reset();
        router.refresh();
      }
    } catch {
      setMessage(
        "Service unavailable. The outcome is unconfirmed; check the status before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      onSubmit={send}
      method="post"
      action="/api/admin/preview-testers"
      className="form-stack"
    >
      {action === "invite" && (
        <label>
          Approved recipient email
          <input name="email" type="email" autoComplete="off" required />
        </label>
      )}
      {action === "grant" && (
        <label>
          Existing member UUID
          <input
            name="userId"
            required
            pattern="[0-9a-fA-F-]{36}"
            autoComplete="off"
          />
        </label>
      )}
      {!revoke && (
        <label>
          Hours of access (maximum 168; policy expiry takes precedence)
          <input
            type="number"
            name="hours"
            min={1}
            max={168}
            defaultValue={24}
            required
          />
        </label>
      )}
      <label>
        Audit reason
        <input name="reason" minLength={12} maxLength={1000} required />
      </label>
      <button className="button" disabled={!ready || busy}>
        {busy
          ? "Working…"
          : revoke
            ? "Revoke access"
            : action === "invite"
              ? "Create private invitation"
              : "Approve preview tester"}
      </button>
      <p role="status">{message}</p>
      {code && (
        <div className="notice">
          <p>
            Copy this one-time code and share privately with the approved
            recipient. It will not be shown again after leaving this page. No
            email has been sent.
          </p>
          <label>
            Private invitation code
            <input
              readOnly
              value={code}
              autoComplete="off"
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <button
            type="button"
            className="button ghost"
            onClick={() => setCode("")}
          >
            Hide code
          </button>
        </div>
      )}
    </form>
  );
}
