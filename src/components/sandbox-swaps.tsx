"use client";
import { useEffect, useState } from "react";
import type { SwapState, SwapCard } from "@/core/sandbox-swaps";
import { formatAUD } from "@/core/fantasy-market-fees";
export function SandboxSwaps() {
  const [state, setState] = useState<SwapState | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [give, setGive] = useState(""),
    [take, setTake] = useState("");
  const [pending, setPending] = useState<{
    action: string;
    request_id: string;
    payload: Record<string, unknown>;
  } | null>(null);
  async function refresh() {
    setBusy(true);
    try {
      const r = await fetch("/api/fantasy/swaps", { cache: "no-store" });
      const v = await r.json();
      if (!r.ok || v.error) throw Error(v.error ?? "Sandbox unavailable");
      setState(v.state);
      setMessage("");
      const saved = sessionStorage.getItem(
        "docked-swap-pending:" + v.state.user_id,
      );
      if (saved) setPending(JSON.parse(saved));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to check sandbox");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  async function send(
    action: string,
    payload: Record<string, unknown>,
    retry = false,
  ) {
    if (!state || busy) return;
    const request = retry
      ? pending
      : { action, payload, request_id: crypto.randomUUID() };
    if (!request) return;
    setBusy(true);
    setMessage("");
    setPending(request);
    sessionStorage.setItem(
      "docked-swap-pending:" + state.user_id,
      JSON.stringify(request),
    );
    try {
      const r = await fetch("/api/fantasy/swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const v = await r.json();
      if (!r.ok || v.error) throw Error(v.error ?? "Unable to confirm");
      setState(v.state);
      setPending(null);
      sessionStorage.removeItem("docked-swap-pending:" + state.user_id);
      setMessage(
        "Saved. Both accounts will see the current ownership after refresh.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Connection interrupted. Check history before retrying the same request.",
      );
    } finally {
      setBusy(false);
    }
  }
  const label = (id: string) => {
    const c = state?.cards.find((c) => c.id === id);
    return c
      ? `${c.name} · ${c.position} · #${c.serial}`
      : "Card " + id.slice(0, 8);
  };
  const cardOption = (c: SwapCard) => (
    <option key={c.id} value={c.id} disabled={c.in_lineup || c.unopened}>
      {label(c.id)}
      {c.in_lineup
        ? " — in saved lineup"
        : c.unopened
          ? " — pack unopened"
          : ""}
    </option>
  );
  return (
    <section className="fantasy-market-panel">
      <h2>Two-person sandbox swaps</h2>
      <p>
        Beta cards and simulated AUD only. No deposits, withdrawals, purchases
        or monetary value. Only the owner and one admitted tester can use this
        sandbox.
      </p>
      <p>
        Open packs first. Cards in any unsettled saved team must be removed
        before swapping. Locked teams cannot be edited until settlement;
        historical teams and points are preserved.
      </p>
      <button disabled={busy} onClick={() => void refresh()}>
        Refresh ownership and receipts
      </button>
      <p role="status">{message}</p>
      {state && (
        <>
          {!state.reserves_granted && (
            <button
              disabled={busy || !!pending}
              onClick={() => void send("reserve_pack", {})}
            >
              Claim one-time beta reserve pack (open it in Cards)
            </button>
          )}
          <p>
            Practice balance: {formatAUD(Number(state.balance_cents))} simulated
            AUD.
          </p>
          {!state.credited && (
            <button
              disabled={busy || !!pending}
              onClick={() => void send("practice_credit", {})}
            >
              Add one-time AUD $100 practice balance
            </button>
          )}
          <p>
            {state.window.free
              ? "Free window: no simulated fee."
              : `Test fee: ${formatAUD(state.window.fee_cents)} simulated AUD per participant.`}{" "}
            Normally free for 48 hours every 28 days. Next change:{" "}
            {new Date(state.window.next_boundary).toLocaleString()}. Offers
            expire within five minutes.
          </p>
          {pending && (
            <div className="notice">
              <p>
                A request needs a confirmed receipt. Refresh the history, or
                retry this exact request; it cannot execute twice.
              </p>
              <button disabled={busy} onClick={() => void send("", {}, true)}>
                Check / retry same request
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  sessionStorage.removeItem(
                    "docked-swap-pending:" + state.user_id,
                  );
                  setPending(null);
                  setMessage(
                    "Review current history before creating another request.",
                  );
                }}
              >
                Dismiss after checking history
              </button>
            </div>
          )}
          <form
            className="app-auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send("offer", {
                give_card: give,
                take_card: take,
                fee_cents: state.window.fee_cents,
                policy_revision: state.window.revision,
              });
            }}
          >
            <label>
              You give
              <select
                value={give}
                onChange={(e) => setGive(e.target.value)}
                required
              >
                <option value="">Choose your card</option>
                {state.cards
                  .filter((c) => c.owner_id === state.user_id)
                  .map(cardOption)}
              </select>
            </label>
            <label>
              You receive
              <select
                value={take}
                onChange={(e) => setTake(e.target.value)}
                required
              >
                <option value="">Choose their card</option>
                {state.cards
                  .filter((c) => c.owner_id !== state.user_id)
                  .map(cardOption)}
              </select>
            </label>
            {give && take && (
              <p>
                Review: give {label(give)} and receive {label(take)}. Your fee
                if accepted: {formatAUD(state.window.fee_cents)} simulated AUD;
                the other participant pays the same.
              </p>
            )}
            <button disabled={busy || !!pending || !give || !take}>
              Agree to test fee and propose swap
            </button>
          </form>
          {state.owner && (
            <section>
              <h3>Owner fee testing</h3>
              <p>
                Requires your MFA session. An override lasts one hour and
                invalidates existing offers. It never changes rewards, real
                money or lineup clocks.
              </p>
              {(["free", "paid", "scheduled"] as const).map((mode) => (
                <button
                  key={mode}
                  disabled={busy || !!pending}
                  onClick={() => void send("fee_mode", { mode })}
                >
                  {mode === "scheduled"
                    ? "Restore schedule"
                    : `Exercise ${mode} state`}
                </button>
              ))}
            </section>
          )}
          <h3>Offers and completed swaps</h3>
          {!state.swaps.length && <p>No offers yet.</p>}
          {state.swaps.map((s) => (
            <article className="notice" key={s.id}>
              <p>
                {s.sender === state.user_id ? "You offer" : "They offer"}{" "}
                {label(s.give_card)} for {label(s.take_card)}.
              </p>
              <p>
                {s.state} · fee per person {formatAUD(s.fee_cents)} simulated
                AUD · expires {new Date(s.expires_at).toLocaleString()}
              </p>
              {s.state === "pending" &&
                (s.recipient === state.user_id ? (
                  <>
                    <button
                      disabled={busy || !!pending}
                      onClick={() =>
                        void send("accept", {
                          swap_id: s.id,
                          fee_cents: s.fee_cents,
                        })
                      }
                    >
                      Accept both cards and test fee
                    </button>
                    <button
                      disabled={busy || !!pending}
                      onClick={() => void send("reject", { swap_id: s.id })}
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <button
                    disabled={busy || !!pending}
                    onClick={() => void send("cancel", { swap_id: s.id })}
                  >
                    Cancel offer
                  </button>
                ))}
            </article>
          ))}
          <h3>Ownership history</h3>
          {state.ownership_history.map((e, i) => (
            <p key={e.reference + e.card_id + i}>
              {label(e.card_id)} ·{" "}
              {e.to_user === state.user_id ? "received" : "sent"} ·{" "}
              {new Date(e.created_at).toLocaleString()} · receipt{" "}
              {e.reference.slice(0, 8)}
            </p>
          ))}
          <h3>Simulated charge history</h3>
          {state.ledger.map((l, i) => (
            <p key={l.reference + l.kind + i}>
              {l.kind === "practice_credit"
                ? "Practice balance grant"
                : "Sandbox swap fee"}
              : {formatAUD(Number(l.amount_cents))} ·{" "}
              {new Date(l.created_at).toLocaleString()}
            </p>
          ))}
        </>
      )}
    </section>
  );
}
