"use client";
import { useCallback, useEffect, useState } from "react";
import { formatAUD, type TradeFeePolicy } from "@/core/fantasy-market-fees";
import { countdown, localTime } from "@/core/fantasy-play";
import { FantasySheet } from "./fantasy-player-sheet";
export type SandboxQuote = {
  id: string;
  kind: string;
  give: string[];
  take: string[];
  price_cents: number;
  fee_cents: number;
  total_fee_cents: number;
  expires_at: string;
  maker: string;
  taker: string;
};
export function SandboxMarketProposal({
  sandbox,
}: {
  sandbox?: {
    quote: () => Promise<SandboxQuote>;
    confirm: (id: string) => Promise<Record<string, unknown>>;
  };
}) {
  const [data, setData] = useState<{
    mode: string;
    serverTime: string;
    policy: TradeFeePolicy;
    window: {
      configured: boolean;
      free: boolean;
      participantCents: number;
      totalCents: number;
      opensAt: string;
      closesAt: string;
      nextBoundary: string;
      expiresAt: string;
    };
  } | null>(null);
  const [now, setNow] = useState(Date.now),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false),
    [quote, setQuote] = useState<SandboxQuote | null>(null),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
  const close = useCallback(() => setOpen(false), []);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/fantasy/market-proposal", {
        cache: "no-store",
      });
      if (!r.ok) throw Error();
      const payload = await r.json();
      if (
        payload.mode !== "ILLUSTRATION_ONLY" ||
        !Number.isFinite(Date.parse(payload.serverTime)) ||
        !payload.window?.configured ||
        !Number.isFinite(Date.parse(payload.window.nextBoundary)) ||
        !Number.isSafeInteger(payload.window.participantCents) ||
        payload.executionEnabled !== false
      )
        throw Error("Invalid schedule");
      setData(payload);
      setError("");
    } catch {
      setError("Fee schedule unavailable. No transaction can proceed.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!data) return;
    const base = Date.now(),
      server = Date.parse(data.serverTime);
    const tick = () => setNow(server + Date.now() - base);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [data]);
  const stale = !!data && Date.parse(data.window.nextBoundary) <= now;
  return (
    <section className="fantasy-panel market-proposal">
      <p className="eyebrow">PROPOSED FEES · SANDBOX ONLY</p>
      <h2>Trade cards. Keep the rules clear.</h2>
      <p>
        AUD $2.50 per participant per completed bilateral trade, once per
        trade—not per card. A 48-hour fee-free window every 28 days. No live
        schedule or real payments are enabled.
      </p>
      <p>
        Picking a team, replacing owned cards, browsing, listing, rejected
        offers, cancellations and failed transfers are free.
      </p>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button onClick={() => void load()}>Retry fee schedule</button>
        </>
      ) : !data ? (
        <p role="status">Loading server-time sandbox schedule…</p>
      ) : (
        <>
          <div className="play-metrics">
            <div>
              <span>Test window</span>
              <strong>
                {stale ? "Refresh" : data.window.free ? "OPEN" : "CLOSED"}
              </strong>
              <small>Explicit test schedule only</small>
            </div>
            <div>
              <span>Each participant</span>
              <strong>
                {stale ? "—" : formatAUD(data.window.participantCents)}
              </strong>
              <small>Simulated AUD</small>
            </div>
            <div>
              <span>Total trade fee</span>
              <strong>{stale ? "—" : formatAUD(data.window.totalCents)}</strong>
              <small>Once per bilateral trade</small>
            </div>
          </div>
          <p>
            {data.window.free ? "Closes" : "Next opens"}{" "}
            {localTime(data.window.nextBoundary)} ·{" "}
            {countdown(data.window.nextBoundary, now)}
          </p>
          {stale ? (
            <button onClick={() => void load()}>Refresh window</button>
          ) : (
            <button
              className="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  if (sandbox) setQuote(await sandbox.quote());
                  setOpen(true);
                } catch {
                  setError("Sandbox quote unavailable. No transfer occurred.");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Review sandbox trade
            </button>
          )}
        </>
      )}
      <details>
        <summary>Swap, sale and bundle treatment</summary>
        <p>
          Swap: cards exchanged, no sale price. Sale: one card for the agreed
          simulated AUD price. Bundle: multiple cards in one bilateral
          agreement, with or without a price. Each participant pays the same
          per-trade fee once. No per-card fee. Both participants must consent to
          the same expiring server quote. A window or policy change needs a new
          quote and new consent.
        </p>
      </details>
      {receipt && (
        <section role="status" className="market-quote">
          <h3>Sandbox receipt</h3>
          <p>
            Recorded atomically in the local QA database. No real cards or
            money.
          </p>
          <p>
            Receipt:{" "}
            <code>{String(receipt.receipt_id ?? receipt.quote_id)}</code>
          </p>
          <p>Status: {String(receipt.status)}</p>
        </section>
      )}
      {open && data && (
        <FantasySheet title="Review sandbox trade" onClose={close}>
          <p className="simulation-label">
            ILLUSTRATION · NOT YOUR HOLDINGS OR WALLET
          </p>
          <div className="market-quote">
            <h3>{quote?.kind ?? "Card swap"} · bilateral agreement</h3>
            <p>
              {quote
                ? `${quote.give.length} card(s) offered ↔ ${quote.take.length} card(s) requested`
                : "One sample card exchanged for one sample card. This illustration reserves no card."}
            </p>
            <dl>
              <div>
                <dt>Agreed sale price</dt>
                <dd>{formatAUD(quote?.price_cents ?? 0)}</dd>
              </div>
              <div>
                <dt>Your fee</dt>
                <dd>
                  {formatAUD(quote?.fee_cents ?? data.window.participantCents)}
                </dd>
              </div>
              <div>
                <dt>Other participant’s fee</dt>
                <dd>
                  {formatAUD(quote?.fee_cents ?? data.window.participantCents)}
                </dd>
              </div>
              <div>
                <dt>Total fees</dt>
                <dd>
                  {formatAUD(quote?.total_fee_cents ?? data.window.totalCents)}
                </dd>
              </div>
            </dl>
            <p>
              Quote expires{" "}
              {localTime(quote?.expires_at ?? data.window.expiresAt)} ·{" "}
              {countdown(quote?.expires_at ?? data.window.expiresAt, now)}.
              Changed fees require fresh consent from both sides.
            </p>
          </div>
          <footer className="sheet-actions">
            <button
              className="button"
              disabled={
                !sandbox ||
                busy ||
                Date.parse(quote?.expires_at ?? data.window.expiresAt) <= now
              }
              onClick={async () => {
                if (!sandbox || !quote) return;
                setBusy(true);
                try {
                  setReceipt(await sandbox.confirm(quote.id));
                  setOpen(false);
                } catch {
                  setError(
                    "Trade was not confirmed. Refresh the quote; no partial transfer or fee is retained.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {sandbox
                ? "Confirm with sandbox balance"
                : "Hosted trading is disabled"}
            </button>
            <button onClick={close}>Cancel · no fee</button>
          </footer>
        </FantasySheet>
      )}
    </section>
  );
}
