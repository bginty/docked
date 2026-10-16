"use client";
import { competitionNames } from "@/core/competition-display";
import { AcquisitionShare } from "./acquisition-share";
import { useServerClock } from "./use-server-clock";
import { boundedFetch } from "@/core/bounded-request";
import { sevenTransferNotice } from "@/core/nfl-seven";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MemberTestView } from "@/core/member-test-wallet";
import type { PackReceipt } from "@/core/pack-opening";
import PackOpening from "./pack-opening";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { rarities, rarityRule } from "@/core/card-rarity";
import { EconomyCatalogue } from "./economy-catalogue";
import { EconomyOwnerReport } from "./economy-owner-report";
import { audEquivalent } from "@/core/credit-only";

export function MemberTestWallet({
  initial,
  surface = "wallet",
}: {
  initial: MemberTestView;
  surface?: "wallet" | "swaps" | "packs";
}) {
  const [s, setS] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pack, setPack] = useState<string | null>(null),
    [details, setDetails] = useState<string | null>(null);
  const [share, setShare] = useState<{
    reference: string;
    cards: { id: string; name: string; tier?: string }[];
  } | null>(null);
  const pending = useRef<{ key: string; id: string } | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [autoPack, setAutoPack] = useState<string | null>(null);
  const [replayPack, setReplayPack] = useState<string | null>(null);
  const storageKey = `docked:test-wallet:pending:${initial.member}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p.key === "string" && typeof p.id === "string") {
          pending.current = p;
          setRecovery(true);
        }
      }
    } catch {
      setError("Enable device storage before spending test credits.");
    }
  }, [storageKey]);
  async function send(command: Record<string, unknown>) {
    const key = JSON.stringify(command);
    if (pending.current && pending.current.key !== key)
      throw Error("Check the pending request first");
    const request = pending.current?.id ?? crypto.randomUUID();
    pending.current = { key, id: request };
    // Persist only the idempotency envelope, never credentials or financial truth.
    // A lost response or app restart must retrieve this operation, not purchase again.
    localStorage.setItem(storageKey, JSON.stringify(pending.current));
    setRecovery(true);
    setBusy(true);
    setError("");
    try {
      const r = await boundedFetch("/api/test-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, command }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.outcome === "rejected") {
          pending.current = null;
          localStorage.removeItem(storageKey);
          setRecovery(false);
        }
        throw Error(data.error);
      }
      setS(data.state);
      if (
        command.kind === "buy-pack" &&
        typeof data.result?.entitlement === "string"
      ) {
        setAutoPack(data.result.entitlement);
        setPack(data.result.entitlement);
      }
      if (command.kind === "accept") {
        const before = new Set(
          s.cards.filter((c) => c.owner === s.member).map((c) => c.id),
        );
        const received = (data.state as MemberTestView).cards.filter(
          (c) => c.owner === s.member && !before.has(c.id),
        );
        if (received.length)
          setShare({
            reference: request,
            cards: received.map((c) => ({ id: c.id, name: c.name })),
          });
      }
      pending.current = null;
      localStorage.removeItem(storageKey);
      setRecovery(false);
      return data.result;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Connection interrupted. Retry the same action to retrieve its receipt.",
      );
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const act = (c: Record<string, unknown>) => void send(c).catch(() => {});
  const clock = useServerClock(s.serverTime);
  const mine = s.cards.filter((c) => c.owner === s.member);
  const p = s.packs.find((p) => p.id === pack);
  const label = (id: string) =>
    s.peers.find((p) => p.id === id)?.label ?? "Invited member";
  const sydney = (n: number) =>
    new Date(n).toLocaleString("en-AU", {
      timeZone: "Australia/Sydney",
      dateStyle: "medium",
      timeStyle: "short",
    });
  return (
    <div className="test-wallet">
      {share && (
        <AcquisitionShare
          member={s.member}
          reference={share.reference}
          cards={share.cards}
        />
      )}
      {surface === "wallet" && (
        <>
          <header>
            <p className="eyebrow">PRIVATE BETA</p>
            <h1>Test wallet</h1>
            <p>
              Test Docked Credits · no cash value or withdrawals. Your normal
              cards and free swaps stay separate.
            </p>
            <Link href="/fantasy/cards">Back to your main collection</Link>
          </header>
          <section>
            <h2>
              {s.wallet.spendable.toLocaleString()}{" "}
              <small>test Docked Credits</small>
            </h2>
            <p>
              Available {s.wallet.available.toLocaleString()} · reserved{" "}
              {s.wallet.reserved.toLocaleString()}
            </p>
            <p>
              100 Docked Credits = A$1.00. Display equivalent:{" "}
              {audEquivalent(s.wallet.total)}. Test balances cannot be redeemed.
            </p>
            <details>
              <summary>Balance breakdown</summary>
              <p>
                Total {s.wallet.total} · available to spend {s.wallet.spendable}{" "}
                · pending {s.wallet.pending} · reserved {s.wallet.reserved}.
              </p>
              <p>
                Restricted from withdrawal {s.wallet.restricted} · eligible to
                withdraw {s.wallet.withdrawable}. Eligibility is part of your
                balance, not extra credits.
              </p>
            </details>
            <button disabled>Buy credits · unavailable</button>{" "}
            <button disabled>Withdraw · unavailable</button>
            <p>
              Deposits and withdrawals are disabled. Packs and marketplace cards
              use test credits only. Fantasy salary budgets never spend credits.
            </p>
          </section>
        </>
      )}
      {error && <p role="alert">{error}</p>}
      {recovery && (
        <p role="status">
          A test transaction is awaiting confirmation.{" "}
          <button
            disabled={busy}
            onClick={() => {
              if (pending.current) act(JSON.parse(pending.current.key));
            }}
          >
            Retry pending transaction
          </button>
        </p>
      )}
      {(surface === "wallet" || surface === "packs") && (
        <>
          <section id="packs">
            <h2>
              {s.economyEnabled
                ? "NFL nine-card packs"
                : "Legacy single-card packs"}
            </h2>
            <p>Collect your next nine. Test Docked Credits · no cash value.</p>
            <a className="button ghost" href="#pack-history">
              History
            </a>
            <div className="test-wallet-grid">
              {s.products.map((p) => (
                <article key={p.id}>
                  <div
                    className={`social-pack-art ${p.tier === "PREMIUM" ? "premium" : ""}`}
                    aria-hidden="true"
                  >
                    <span>DOCKED</span>
                    <strong>{p.name}</strong>
                    <span>COLLECT · COMPETE</span>
                  </div>
                  <h3>{p.name}</h3>
                  {p.odds?.headline && (
                    <p>
                      <strong>{p.odds.headline}</strong>
                    </p>
                  )}
                  <p>
                    {p.price.toLocaleString()} test credits · {p.cards} cards
                  </p>
                  {p.weights && (
                    <div>
                      <details className="pack-chances">
                        <summary>Rarity chances</summary>
                        <table>
                          <caption>Per card · test settings</caption>
                          <thead>
                            <tr>
                              <th>Rarity</th>
                              <th>Chance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rarities
                              .filter(
                                (r) =>
                                  r !== "CORE" &&
                                  (!p.odds?.headline || p.weights![r] > 0),
                              )
                              .map((r) => (
                                <tr key={r}>
                                  <td>{rarityRule(r).label}</td>
                                  <td>{p.weights![r] / 100}%</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {p.odds?.headline && (
                          <p>{p.odds.excluded.join(", ")}: not included.</p>
                        )}
                      </details>
                      <details className="pack-terms">
                        <summary>Pack details</summary>
                        <p>
                          {p.eligiblePlayers} eligible players ·{" "}
                          {p.positions.join(", ")}. Nine different players. No
                          Core, K or DEF/DST in new gameplay packs. Existing
                          cards and receipts are unchanged.
                        </p>
                        <p>
                          {p.odds?.guarantee ??
                            (Object.keys(p.guaranteedSlots).length
                              ? "Guaranteed slots: " +
                                Object.entries(p.guaranteedSlots)
                                  .map(
                                    ([slot, r]) =>
                                      String(Number(slot) + 1) + ": " + r,
                                  )
                                  .join(", ")
                              : "No guaranteed rarity.")}
                        </p>
                        <p>
                          Percentages are per-card rarity attempts before supply
                          checks, not the chance across a whole pack. Guaranteed
                          slots, if configured, override that slot’s draw.
                          Player draws exclude duplicates. Within a rarity,
                          eligible players are equally likely. If supply cannot
                          fulfil the pack, it fails without charge or
                          substitution; completed-pack frequencies may differ
                          near exhaustion.
                        </p>
                        <small>
                          Configuration: {p.version}. Premium is a pack type,
                          not a rarity.
                        </small>
                      </details>
                    </div>
                  )}
                  <button
                    disabled={
                      busy || !p.available || s.wallet.spendable < p.price
                    }
                    onClick={() => {
                      if (
                        confirm(
                          `Buy ${p.name} for ${p.price.toLocaleString()} test credits?${p.odds?.headline ? ` ${p.odds.headline}. ${p.odds.guarantee}` : ""}`,
                        )
                      )
                        act({
                          kind: "buy-pack",
                          product: p.id,
                          ...(s.economyEnabled
                            ? { configuration: p.version }
                            : {}),
                          confirmed: true,
                          policy: s.policy,
                        });
                    }}
                  >
                    {s.economyEnabled
                      ? `Buy ${p.name}`
                      : `Buy ${p.tier === "RARE" ? "Premium" : "Elite"} pack`}
                  </button>
                </article>
              ))}
            </div>
            <details>
              <summary>Eligible players</summary>
              {s.pool.length > 0 && (
                <EconomyCatalogue pool={s.pool} owner={!!s.ownerReport} />
              )}
            </details>
            <details id="pack-history" className="pack-history">
              <summary>Purchase history · {s.packs.length} packs</summary>
              {s.packs.map((p) => (
                <div className="test-wallet-row" key={p.id} data-pack-id={p.id}>
                  <span>
                    {p.name} ·{" "}
                    {p.status === "SEALED" ? "Ready to open" : "Opened"}
                    <small>
                      {p.purchasedAt
                        ? sydney(p.purchasedAt)
                        : "Date unavailable"}{" "}
                      ·{" "}
                      {p.paidCredits === null
                        ? "Historical amount unavailable"
                        : `${p.paidCredits.toLocaleString()} test credits`}{" "}
                      ·{" "}
                      {p.receipt
                        ? `${p.receipt.cards.length} cards received`
                        : `${p.cardCount ?? "—"} cards awaiting opening`}
                    </small>
                    {p.configuration && (
                      <small> · Purchase terms: {p.configuration}</small>
                    )}
                  </span>
                  <button
                    disabled={busy}
                    onClick={() => {
                      setReplayPack(p.status === "OPENED" ? p.id : null);
                      setPack(p.id);
                    }}
                  >
                    {p.status === "SEALED" ? "Open pack" : "Replay saved pack"}
                  </button>
                </div>
              ))}
            </details>
          </section>
          {p && (
            <PackOpening
              key={p.id}
              replay={p.id === replayPack}
              autoOpen={p.id === autoPack && p.status === "SEALED"}
              userId={s.member}
              name={p.name}
              receipt={p.receipt}
              ownedIds={mine.map((c) => c.id)}
              openPack={async () =>
                (await send({
                  kind: "open-pack",
                  entitlement: p.id,
                })) as PackReceipt
              }
              onClose={() => setPack(null)}
              onViewCard={(c) => {
                setPack(null);
                setDetails(c.id);
              }}
              collectionHref="/fantasy/cards"
              teamHref={s.economyEnabled ? "/fantasy/play" : null}
            />
          )}
          <p id="collection">
            <Link href="/fantasy/cards">View your complete collection</Link> ·{" "}
            <Link href="/fantasy/market?tab=listings">
              Manage listings in Market
            </Link>
          </p>
          {details && (
            <section>
              <h2>Card details and ownership</h2>
              {s.cards
                .filter((c) => c.id === details)
                .map((c) => (
                  <div key={c.id}>
                    <FantasyCardArtwork card={c} />
                    <p>
                      Current team: {c.team} · {c.status}. Printed team:{" "}
                      {c.edition_team ?? c.team}.
                    </p>
                    <p>
                      {c.rarity_version
                        ? `Choose ${competitionNames.SALARY_CAP} or ${competitionNames.OPEN} in Play. K and DEF/DST cards are collectible only in these seven-player competitions and cannot occupy their lineup slots.`
                        : "Legacy test card; original edition terms preserved."}
                    </p>
                    <a href="/fantasy/scoring/how-it-works">Scoring rules</a>
                    {s.supply
                      .filter(
                        (row) =>
                          row.playerId === c.player_id && row.rarity === c.tier,
                      )
                      .map((row) => (
                        <p key={row.rarity}>
                          Lifetime test cap {row.cap.toLocaleString()} · issued{" "}
                          {row.issued} · reserved {row.reserved} · available to
                          issue {row.available.toLocaleString()}
                        </p>
                      ))}
                  </div>
                ))}
              {s.cards
                .find((c) => c.id === details)
                ?.history.map((h, i) => (
                  <p key={i}>
                    {sydney(h.at)} Sydney · {h.reference}
                  </p>
                ))}
              <button onClick={() => setDetails(null)}>Close history</button>
            </section>
          )}
        </>
      )}
      {surface === "wallet" && (
        <p>
          <Link href="/fantasy/market">Browse, list and trade in Market</Link>
        </p>
      )}
      {surface === "swaps" && (
        <section>
          <h2>Test card swaps</h2>
          <p>{sevenTransferNotice}</p>
          <p>
            {s.swapQuote.feeEach} test credits each, charged only when both
            transfers complete. No fee for rejection or cancellation. Choose the
            other member's listed test card to propose a swap.
          </p>
          <p role="status">
            {s.swapQuote.free
              ? `Free swap window open until ${sydney(s.swapQuote.closes!)} Sydney.`
              : s.swapQuote.opens
                ? `Next free swap window: ${sydney(s.swapQuote.opens)} Sydney.`
                : "No free swap window scheduled."}{" "}
            Only swap fees are waived; pack prices and sale commission still
            apply.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget),
                listing = s.listings.find((l) => l.id === f.get("take"));
              if (listing)
                act({
                  kind: "offer",
                  other: listing.member,
                  give: [String(f.get("give"))],
                  take: [listing.card],
                  feeEach: s.swapQuote.feeEach,
                });
            }}
          >
            <label>
              Your card
              <select name="give" required>
                {mine.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.tier} #{c.serial}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Their listed card
              <select name="take" required>
                {s.listings
                  .filter((l) => l.status === "OPEN" && l.member !== s.member)
                  .map((l) => (
                    <option value={l.id} key={l.id}>
                      {s.cards.find((c) => c.id === l.card)?.name} ·{" "}
                      {label(l.member)}
                    </option>
                  ))}
              </select>
            </label>
            <button disabled={busy}>
              Propose swap · {s.swapQuote.feeEach} each
            </button>
          </form>
          {s.swaps.map((offer) => {
            const x = {
              ...offer,
              status:
                offer.status === "OPEN" && offer.expires <= clock
                  ? "EXPIRED"
                  : offer.status,
            };
            return (
              <article key={x.id}>
                <h3>
                  {x.status} · {label(x.member)} ↔ {label(x.other)}
                </h3>
                <p>
                  Offer:{" "}
                  {x.give
                    .map(
                      (id) => s.cards.find((c) => c.id === id)?.name + " " + id,
                    )
                    .join(", ")}
                </p>
                <p>
                  In return:{" "}
                  {x.take
                    .map(
                      (id) => s.cards.find((c) => c.id === id)?.name + " " + id,
                    )
                    .join(", ")}
                </p>
                <p>
                  Each participant:{" "}
                  {x.completedFeeEach ??
                    (x.status === "OPEN"
                      ? s.swapQuote.feeEach
                      : x.feeEach)}{" "}
                  test credits. Original consent: {x.feeEach} each.
                </p>
                {x.status === "OPEN" && s.swapQuote.feeEach > x.feeEach && (
                  <p>
                    A free window has ended. Cancel and create a new offer so
                    both participants can consent to the fee.
                  </p>
                )}
                {x.status === "OPEN" &&
                  (x.member === s.member ? (
                    <button
                      disabled={busy}
                      onClick={() => act({ kind: "cancel-swap", swap: x.id })}
                    >
                      Cancel offer
                    </button>
                  ) : (
                    <>
                      <button
                        disabled={busy || s.swapQuote.feeEach > x.feeEach}
                        onClick={() => {
                          if (
                            confirm(
                              `Accept both sides of this swap and pay ${s.swapQuote.feeEach} test credits each?`,
                            )
                          )
                            act({
                              kind: "accept",
                              swap: x.id,
                              feeEach: s.swapQuote.feeEach,
                            });
                        }}
                      >
                        Accept swap
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => act({ kind: "reject", swap: x.id })}
                      >
                        Reject offer
                      </button>
                    </>
                  ))}
              </article>
            );
          })}
        </section>
      )}
      {surface === "wallet" && (
        <>
          <section>
            <h2>Your transaction history</h2>
            {s.history.map((h) => (
              <p key={h.id}>
                {sydney(h.at)} Sydney · {h.reason} · {h.change > 0 ? "+" : ""}
                {h.change} <small>{h.id}</small>
              </p>
            ))}
          </section>
          {s.ownerReport && (
            <section>
              <h2>Owner-only test report</h2>
              <p>
                No cash backing or payment provider is connected. Grants remain
                restricted to the audited owner operation.
              </p>
              <p>
                Test circulation:{" "}
                {s.ownerReport.circulation.outstanding.toLocaleString()} ·
                reconciliation difference {s.ownerReport.circulation.difference}
                . Commercial payments: 0.
              </p>
              <p>
                Marketplace turnover {s.ownerReport.marketplaceVolume} · seller
                commission {s.ownerReport.commission} · swap fees{" "}
                {s.ownerReport.swapFees} · pack spend{" "}
                {s.ownerReport.packRevenue}. These are test flows, not
                accounting revenue.
              </p>
              <form action="/api/test-wallet" method="get">
                <input type="hidden" name="format" value="csv" />
                <label>
                  From date (Sydney)
                  <input type="date" name="from" />
                </label>
                <label>
                  Through date (Sydney)
                  <input type="date" name="to" />
                </label>
                <button>Export test reconciliation CSV</button>
              </form>
              <details>
                <summary>Funding, balances and reconciliation evidence</summary>
                <pre>{JSON.stringify(s.ownerReport, null, 2)}</pre>
              </details>
              <h3>Schedule a test swap-free window</h3>
              <p>
                Immutable schedule; enter explicit Sydney UTC offset (for
                example +11:00 during daylight saving). Applies only to this
                financial test economy.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const start = Date.parse(String(f.get("start"))),
                    end = Date.parse(String(f.get("end")));
                  if (
                    !Number.isSafeInteger(start) ||
                    !Number.isSafeInteger(end)
                  ) {
                    setError(
                      "Enter valid timestamps including the UTC offset.",
                    );
                    return;
                  }
                  if (
                    confirm(
                      `Schedule zero swap fees from ${sydney(start)} to ${sydney(end)} Sydney?`,
                    )
                  )
                    act({
                      kind: "swap-window",
                      start,
                      end,
                      reason: String(f.get("reason")),
                    });
                }}
              >
                <label>
                  Start with UTC offset
                  <input
                    name="start"
                    placeholder="2026-10-20T09:00:00+11:00"
                    required
                  />
                </label>
                <label>
                  End with UTC offset
                  <input
                    name="end"
                    placeholder="2026-10-22T09:00:00+11:00"
                    required
                  />
                </label>
                <label>
                  Audit reason
                  <input
                    name="reason"
                    minLength={12}
                    maxLength={600}
                    required
                  />
                </label>
                <button disabled={busy}>Review window</button>
              </form>
              {s.swapWindows.map((w) => (
                <p key={w.id}>
                  {sydney(w.start)} – {sydney(w.end)} Sydney · {w.reason}
                </p>
              ))}
              <EconomyOwnerReport state={s} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
