"use client";
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
import { sellerQuote } from "@/core/credits-policy";
export function MemberTestWallet({ initial }: { initial: MemberTestView }) {
  const [s, setS] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [pack, setPack] = useState<string | null>(null),
    [details, setDetails] = useState<string | null>(null),
    [rarityFilter, setRarityFilter] = useState("");
  const pending = useRef<{ key: string; id: string } | null>(null);
  const [recovery, setRecovery] = useState(false);
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
      const r = await fetch("/api/test-wallet", {
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
      <header>
        <p className="eyebrow">PRIVATE BETA</p>
        <h1>Test wallet</h1>
        <p>
          Test Docked Credits · no cash value or withdrawals. Your normal cards
          and free swaps stay separate.
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
            Total {s.wallet.total} · available to spend {s.wallet.spendable} ·
            pending {s.wallet.pending} · reserved {s.wallet.reserved}.
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
          Deposits and withdrawals are disabled. Packs and marketplace cards use
          test credits only. Fantasy salary budgets never spend credits.
        </p>
      </section>
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
      <section>
        <h2>
          {s.economyEnabled
            ? "NFL nine-card packs"
            : "Legacy single-card packs"}
        </h2>
        <p>
          {s.economyEnabled
            ? "Exactly nine NFL player cards. No Core. Icon is eligible in both packs. Prices and chances below are test settings, not approved commercial offers. Test cards stay separate from the free friends competition."
            : "Legacy receipts retain their original single-card terms."}
        </p>
        <div className="test-wallet-grid">
          {s.products.map((p) => (
            <article key={p.id}>
              <h3>{p.name}</h3>
              <p>
                {p.price.toLocaleString()} test credits · {p.cards} cards
              </p>
              {p.weights && (
                <details>
                  <summary>Pool, chances and guarantees</summary>
                  <p>
                    {p.eligiblePlayers} active catalogue players across QB, RB,
                    WR, TE and K, subject to source freshness and remaining
                    supply. No guaranteed rarity. Nine different players in this
                    test configuration.
                  </p>
                  <table>
                    <caption>Per-card rarity draw · test settings</caption>
                    <thead>
                      <tr>
                        <th>Rarity</th>
                        <th>Per card</th>
                        <th>At least one in 9*</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(p.weights).map(([r, w]) => (
                        <tr key={r}>
                          <td>{rarityRule(r).label}</td>
                          <td>{w / 100}%</td>
                          <td>
                            {((1 - Math.pow(1 - w / 10000, 9)) * 100).toFixed(
                              3,
                            )}
                            %
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>
                    *Independent rarity draws before supply checks. A chosen
                    rarity with no eligible supply cancels the whole pack
                    without charge; completed-pack frequencies can therefore
                    differ near exhaustion. No lower-tier substitution. Within
                    the chosen rarity, remaining eligible players are equally
                    likely; serial numbers are assigned in order.
                  </p>
                  <small>
                    Configuration: {p.version}. Premium is a pack type, not a
                    rarity.
                  </small>
                </details>
              )}
              <button
                disabled={busy || !p.available || s.wallet.spendable < p.price}
                onClick={() => {
                  if (
                    confirm(
                      `Buy ${p.name} for ${p.price.toLocaleString()} test credits?`,
                    )
                  )
                    act({
                      kind: "buy-pack",
                      product: p.id,
                      ...(s.economyEnabled ? { configuration: p.version } : {}),
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
        {s.pool.length > 0 && (
          <EconomyCatalogue pool={s.pool} owner={!!s.ownerReport} />
        )}
        {s.packs.map((p) => (
          <div className="test-wallet-row" key={p.id} data-pack-id={p.id}>
            <span>
              {p.name} · {p.status === "SEALED" ? "Ready to open" : "Opened"}
            </span>
            <button disabled={busy} onClick={() => setPack(p.id)}>
              {p.status === "SEALED" ? "Open pack" : "Replay saved pack"}
            </button>
          </div>
        ))}
      </section>
      {p && (
        <PackOpening
          key={p.id}
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
          collectionHref="/fantasy/test-wallet#collection"
          teamHref={s.economyEnabled ? "/fantasy/play" : null}
        />
      )}
      <section id="collection">
        <h2>Your test collection</h2>
        <label>
          Rarity{" "}
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value)}
          >
            <option value="">All rarities</option>
            {rarities.map((r) => (
              <option key={r} value={r}>
                {rarityRule(r).label}
              </option>
            ))}
          </select>
        </label>
        <div className="test-wallet-grid">
          {mine
            .filter((c) => !rarityFilter || c.tier === rarityFilter)
            .map((c) => (
              <article key={c.id}>
                <FantasyCardArtwork card={c} />
                <button onClick={() => setDetails(c.id)}>
                  Ownership history
                </button>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const price = Number(
                      new FormData(e.currentTarget).get("price"),
                    );
                    const fee = sellerQuote(price).fee;
                    if (
                      confirm(
                        `List for ${price} test credits? Seller fee ${fee}; you receive ${price - fee}.`,
                      )
                    )
                      act({ kind: "list", card: c.id, price });
                  }}
                >
                  <label>
                    Listing price
                    <input
                      name="price"
                      type="number"
                      min="1"
                      max="1000000000"
                      defaultValue="100"
                      required
                    />
                  </label>
                  <button disabled={busy}>Review listing</button>
                </form>
              </article>
            ))}
        </div>
        {!mine.length && (
          <p>Open a purchased pack to add your first test card.</p>
        )}
      </section>
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
                    ? "Choose the isolated RARITY TEST competition in Play to use these cards. K cards are collectible; the seven-player offence formation has no kicker slot."
                    : "Legacy test card; original edition terms preserved."}
                </p>
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
                {sydney(h.at)} Sydney ·{" "}
                {h.from ? label(h.from) : "Test edition"} → {label(h.to)} ·{" "}
                {h.reference}
              </p>
            ))}
          <button onClick={() => setDetails(null)}>Close history</button>
        </section>
      )}
      <section>
        <h2>Test marketplace</h2>
        <p>{sevenTransferNotice}</p>
        <p>
          7.5% seller commission, rounded to the nearest whole credit. All cards
          and proceeds stay in this test wallet.
        </p>
        {s.listings
          .filter((l) => l.status === "OPEN")
          .map((l) => (
            <article key={l.id}>
              <h3>
                {s.cards.find((c) => c.id === l.card)?.name} · {label(l.member)}
              </h3>
              <p>
                {l.price} test credits · fee {sellerQuote(l.price).fee} · seller
                receives {sellerQuote(l.price).net}
              </p>
              {l.member === s.member ? (
                <button
                  disabled={busy}
                  onClick={() => act({ kind: "cancel-listing", listing: l.id })}
                >
                  Cancel listing
                </button>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Buy this test card for ${l.price} credits?`))
                      act({
                        kind: "buy",
                        listing: l.id,
                        expectedPrice: l.price,
                        policy: s.policy,
                        confirmed: true,
                      });
                  }}
                >
                  Buy test card
                </button>
              )}
            </article>
          ))}
      </section>
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
        {s.swaps.map((x) => (
          <article key={x.id}>
            <h3>
              {x.status} · {label(x.member)} ↔ {label(x.other)}
            </h3>
            <p>
              Offer:{" "}
              {x.give
                .map((id) => s.cards.find((c) => c.id === id)?.name + " " + id)
                .join(", ")}
            </p>
            <p>
              In return:{" "}
              {x.take
                .map((id) => s.cards.find((c) => c.id === id)?.name + " " + id)
                .join(", ")}
            </p>
            <p>
              Each participant:{" "}
              {x.completedFeeEach ??
                (x.status === "OPEN" ? s.swapQuote.feeEach : x.feeEach)}{" "}
              test credits. Original consent: {x.feeEach} each.
            </p>
            {x.status === "OPEN" && s.swapQuote.feeEach > x.feeEach && (
              <p>
                A free window has ended. Cancel and create a new offer so both
                participants can consent to the fee.
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
        ))}
      </section>
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
            reconciliation difference {s.ownerReport.circulation.difference}.
            Commercial payments: 0.
          </p>
          <p>
            Marketplace turnover {s.ownerReport.marketplaceVolume} · seller
            commission {s.ownerReport.commission} · swap fees{" "}
            {s.ownerReport.swapFees} · pack spend {s.ownerReport.packRevenue}.
            These are test flows, not accounting revenue.
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
            Immutable schedule; enter explicit Sydney UTC offset (for example
            +11:00 during daylight saving). Applies only to this financial test
            economy.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const start = Date.parse(String(f.get("start"))),
                end = Date.parse(String(f.get("end")));
              if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
                setError("Enter valid timestamps including the UTC offset.");
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
              <input name="reason" minLength={12} maxLength={600} required />
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
    </div>
  );
}
