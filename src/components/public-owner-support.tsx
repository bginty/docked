"use client";
import { useState } from "react";
export function PublicOwnerSupport({
  target = null,
  disabledAt = null,
}: {
  target?: string | null;
  disabledAt?: string | null;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Keep one request for uncertain outcomes; a page reload requires reviewing the
  // immutable history before a new command. Never automatically resubmit.
  const [request] = useState(() => crypto.randomUUID());
  return (
    <form
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || submitted) return;
        setBusy(true);
        setSubmitted(true);
        setMessage("");
        const data = new FormData(event.currentTarget);
        try {
          const response = await fetch("/api/admin/customer-support", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              request,
              target,
              expectedDisabledAt: disabledAt,
              action: data.get("action"),
              reason: data.get("reason"),
            }),
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok)
            throw Error(
              "Action not confirmed. Reload and review the audit history before retrying.",
            );
          setMessage("Recorded. Reload this page to review the updated state.");
        } catch {
          setMessage(
            "Action not confirmed. Reload and review the audit history before retrying.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Action
        <select name="action">
          {target ? (
            <>
              <option value="note">Record support note</option>
              <option
                value={disabledAt ? "restore_customer" : "restrict_customer"}
              >
                {disabledAt
                  ? "Restore customer access"
                  : "Restrict customer access"}
              </option>
            </>
          ) : (
            <option value="emergency_pause">
              Emergency pause: purchases, issuance, trading and SMS
            </option>
          )}
        </select>
      </label>
      <label>
        Review evidence
        <textarea name="reason" required minLength={12} maxLength={600} />
      </label>
      <p>
        {target
          ? "Account recovery uses the customer's own verified recovery process. This does not reset passwords, MFA or phone verification, or change assets and holds."
          : "This can only close database gates and SMS budget windows. Registration/provider switches must also be closed using the release runbook. Accepted provider requests may still finish."}
      </p>
      <button disabled={busy || submitted} type="submit">
        {busy ? "Recording…" : "Record reviewed action"}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
