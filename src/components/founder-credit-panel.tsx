"use client";
import { useEffect, useRef, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import { founderCreditIssue } from "@/core/founder-credits";
type Scope = { members: { id: string; label: string }[]; remaining: number };
type Issue = {
  request: string;
  member: string;
  amount: number;
  reason: string;
  confirmed: true;
};
const pendingKey = "docked-founder-credit-pending-v1";
async function load() {
  const r = await boundedFetch("/api/admin/founder-credits", {
    cache: "no-store",
  });
  if (!r.ok)
    throw Error(
      "Free beta credit issuance is unavailable. Confirm your founder MFA session.",
    );
  return (await r.json()) as Scope;
}
export function FounderCreditPanel() {
  const [scope, setScope] = useState<Scope | null>(null),
    [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false),
    [pending, setPending] = useState<Issue | null>(null);
  const [savedError, setSavedError] = useState(false);
  const flight = useRef(false);
  useEffect(() => {
    let active = true;
    try {
      const raw = sessionStorage.getItem(pendingKey);
      if (raw) {
        const saved = founderCreditIssue.parse(JSON.parse(raw));
        setPending(saved);
        setStatus(
          "A saved issuance request needs confirmation. Retry it safely before issuing more credits.",
        );
      }
    } catch {
      setSavedError(true);
      setStatus(
        "The saved request could not be read. Check the credit history before issuing more credits.",
      );
    }
    void load()
      .then((s) => {
        if (active) setScope(s);
      })
      .catch((e) => {
        if (active) setStatus(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  const send = async (value: Issue, retry = true) => {
    if (flight.current) return;
    flight.current = true;
    setBusy(true);
    setStatus("");
    try {
      // Persist before sending: a reload after a lost response keeps the same ID.
      sessionStorage.setItem(pendingKey, JSON.stringify(value));
      const r = await boundedFetch("/api/admin/founder-credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const data = await r.json();
      // A rejected retry cannot prove an earlier lost response did not commit.
      if (!retry && !r.ok && data.rejected === true) {
        sessionStorage.removeItem(pendingKey);
        setPending(null);
        setStatus(data.error);
        return;
      }
      if (!r.ok || !data.issued || data.request !== value.request)
        throw Error("Issuance not confirmed.");
      sessionStorage.removeItem(pendingKey);
      setPending(null);
      setStatus(
        `${value.amount.toLocaleString()} free Docked Credits issued. Request ${value.request}.`,
      );
      try {
        setScope(await load());
      } catch {
        setScope(null);
        setStatus(
          `${value.amount.toLocaleString()} free Docked Credits issued. Request ${value.request}. Reload to refresh the remaining allocation.`,
        );
      }
    } catch {
      setPending(value);
      setStatus(
        "Issuance has not been confirmed. Retry this saved request to check safely; it cannot issue twice.",
      );
    } finally {
      flight.current = false;
      setBusy(false);
    }
  };
  return (
    <section
      className="admin-workspace-panel"
      aria-labelledby="founder-credit-title"
    >
      <h2 id="founder-credit-title">Issue free Docked Credits</h2>
      <p>
        For currently invited beta members. These credits cannot be purchased or
        withdrawn. Issuing credits does not open a pack.
      </p>
      {scope && (
        <p>
          {scope.remaining.toLocaleString()} credits remain in this free-credit
          allocation.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pending || busy || savedError) return;
          const f = new FormData(e.currentTarget);
          const value: Issue = {
            request: crypto.randomUUID(),
            member: String(f.get("member")),
            amount: Number(f.get("amount")),
            reason: String(f.get("reason")),
            confirmed: true,
          };
          setPending(value);
          void send(value, false);
        }}
      >
        <fieldset disabled={!scope || busy || !!pending || savedError}>
          <label>
            Member
            <select name="member" required defaultValue="">
              <option value="" disabled>
                Select an invited member
              </option>
              {scope?.members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Credits
            <input
              name="amount"
              type="number"
              min={1}
              max={Math.min(100000, scope?.remaining ?? 0)}
              step={1}
              required
            />
          </label>
          <label>
            Reason
            <textarea name="reason" minLength={10} maxLength={500} required />
          </label>
          <label>
            <input type="checkbox" required /> I confirm the member and
            free-credit amount.
          </label>
          <button className="button" type="submit">
            Issue free credits
          </button>
        </fieldset>
      </form>
      {pending && (
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={() => void send(pending)}
        >
          {busy ? "Confirming…" : "Retry saved issuance request"}
        </button>
      )}
      {status && <p role="status">{status}</p>}
    </section>
  );
}
