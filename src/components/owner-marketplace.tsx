"use client";
import { useRef, useState } from "react";
import type { ownerMarketplace } from "@/server/owner-marketplace";
import { boundedFetch } from "@/core/bounded-request";
type Report = Awaited<ReturnType<typeof ownerMarketplace>>;
export function OwnerMarketplace({ initial }: { initial: Report }) {
  const [report, setReport] = useState(initial),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const active = useRef(false);
  async function update(command: Record<string, unknown>) {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setMessage("");
    try {
      const r = await boundedFetch("/api/admin/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...command,
          reason,
          request: crypto.randomUUID(),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      if (data.applied && data.error) {
        if (command.action === "pause" && command.paused === true)
          setReport((prior) => ({
            ...prior,
            control: { ...prior.control, paused: true },
          }));
        setMessage(data.error);
        return;
      }
      setReport(data);
      setReason("");
      setMessage("Marketplace controls updated.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update not confirmed.");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }
  const enabled = report.deploymentEnabled && !report.control.paused;
  return (
    <section className="scoring-review owner-marketplace">
      <h1>Private beta marketplace</h1>
      <p role="status">
        Trading {enabled ? "enabled" : "paused"} · Funding and cash redemption
        remain disabled.
      </p>
      <p>
        {report.wallet.listings} active listings · {report.wallet.pendingOffers}{" "}
        pending offers · {report.wallet.fees.toLocaleString()} credits in fees
      </p>
      <p>
        {report.wallet.spendable.toLocaleString()} spendable credits ·{" "}
        {report.wallet.reserved.toLocaleString()} reserved ·{" "}
        {report.wallet.unbalancedTransactions} unbalanced ledger entries
      </p>
      <label>
        Reason or case reference{" "}
        <input
          value={reason}
          maxLength={500}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Do not include payment details or passwords"
        />
      </label>
      <div className="actions">
        <button
          disabled={busy || !reason.trim()}
          onClick={() =>
            update({
              action: "pause",
              paused: true,
              revision: Number(report.control.revision),
            })
          }
        >
          Emergency pause
        </button>
        <button
          disabled={
            busy ||
            !reason.trim() ||
            !report.control.approved_at ||
            !report.deploymentEnabled
          }
          onClick={() =>
            update({
              action: "pause",
              paused: false,
              revision: Number(report.control.revision),
            })
          }
        >
          Resume approved trading
        </button>
      </div>
      {!report.control.approved_at && (
        <p>
          Policy approval and the authorised account list must be recorded
          before trading can start.
        </p>
      )}
      <p role="status">{message}</p>
      <details>
        <summary>Approved accounts and trade types</summary>
        <p>
          Sales: {String(report.control.sale)} · Swaps:{" "}
          {String(report.control.swap)} · Card plus credits:{" "}
          {String(report.control.combined)}
        </p>
        <ul>
          {report.members.map((m) => (
            <li key={m.id}>
              {m.label} · {m.enabled ? "approved" : "suspended from trading"}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Active listings ({report.listings.length})</summary>
        <ul>
          {report.listings.map((l) => (
            <li key={l.id}>
              {l.card} · {l.price} credits · {l.preference} · {l.id}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Pending offers ({report.pendingOffers.length})</summary>
        <ul>
          {report.pendingOffers.map((o) => (
            <li key={o.id}>
              {o.card} · {o.price} credits · {o.id}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Completed trades · latest 100</summary>
        <ul>
          {report.history.map((h) => (
            <li key={h.id}>
              {h.at === null
                ? "Date unavailable"
                : new Date(h.at).toLocaleString("en-AU")}{" "}
              · {h.kind} · {h.id}
            </li>
          ))}
        </ul>
      </details>
      <details>
        <summary>Card transfer history · latest 100</summary>
        <pre style={{ overflowX: "auto", maxWidth: "100%" }}>
          {JSON.stringify(report.transfers, null, 2)}
        </pre>
      </details>
      <details>
        <summary>
          Failures, disputes and suspicious activity · latest 100
        </summary>
        <p>
          Record a case reference above. These actions record an investigation;
          they never reverse a trade or change a balance.
        </p>
        <div className="actions">
          {(["dispute", "suspicious", "case_closed"] as const).map(
            (category) => (
              <button
                key={category}
                disabled={busy || !reason.trim()}
                onClick={() => update({ action: "case", category })}
              >
                {category === "case_closed"
                  ? "Record case resolution"
                  : category === "dispute"
                    ? "Record dispute"
                    : "Flag suspicious activity"}
              </button>
            ),
          )}
        </div>
        <ul>
          {report.audit.map((a) => (
            <li key={a.id}>
              {a.action} · {a.detail} · {a.request}
            </li>
          ))}
        </ul>
        <a href="/admin/community">Member moderation and suspension</a>
      </details>
      <a href="/admin/operations">Full ledger and credit circulation report</a>
    </section>
  );
}
