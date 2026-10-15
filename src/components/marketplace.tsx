"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MarketplaceView } from "@/core/marketplace";
import { boundedFetch } from "@/core/bounded-request";
import { rarities } from "@/core/card-rarity";
import { cardIdentity, multiplierLabel } from "@/core/card-display";
import { sellerQuote } from "@/core/credits-policy";
import { sevenTransferNotice } from "@/core/nfl-seven";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { AcquisitionShare } from "./acquisition-share";
import { PlayerShirt } from "./fantasy-player-sheet";
import { FantasySheet } from "./fantasy-player-sheet";
import { MemberTestWallet } from "./member-test-wallet";
import { SandboxSwaps } from "./sandbox-swaps";
import type { MemberTestView } from "@/core/member-test-wallet";
type Row = MarketplaceView["rows"][number];
type Review = {
  review: string;
  listing: string;
  card: string;
  version: number;
  price: number;
  fee: number;
  net: number;
  policy: string;
  expires: number;
};
type Envelope = { request: string; command: Record<string, unknown> };
const tabs = [
  ["browse", "Browse"],
  ["listings", "My Listings"],
  ["activity", "Activity"],
  ["swaps", "Swaps"],
] as const;
export function Marketplace({ member }: { member: string }) {
  const [params, setParams] = useState<URLSearchParams>(
    () =>
      new URLSearchParams(
        typeof window === "undefined" ? "" : window.location.search,
      ),
  );
  const [data, setData] = useState<MarketplaceView | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [ownedCard, setOwnedCard] = useState(() =>
      typeof window === "undefined"
        ? ""
        : (new URLSearchParams(window.location.search).get("sell") ?? ""),
    ),
    [askPrice, setAskPrice] = useState("1000");
  const [detail, setDetail] = useState<Row | null>(null),
    [review, setReview] = useState<Review | null>(null),
    [listing, setListing] = useState<{ card: string; price: number } | null>(
      null,
    ),
    [cancel, setCancel] = useState<Row | null>(null);
  const [receipt, setReceipt] = useState<Record<string, unknown> | null>(null),
    [recovery, setRecovery] = useState<Envelope | null>(null),
    [swapData, setSwapData] = useState<MemberTestView | null>(null),
    [freeSwaps, setFreeSwaps] = useState(false);
  const generation = useRef(0),
    inFlight = useRef(false),
    alive = useRef(true),
    inputForm = useRef<HTMLFormElement>(null);
  const key = `docked:market:pending:${member}`,
    query = params.toString(),
    tab = params.get("tab") ?? "browse";
  useEffect(() => {
    alive.current = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) setRecovery(JSON.parse(raw));
    } catch {
      setError("Enable device storage before a transaction.");
    }
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, [key]);
  const refresh = useCallback(async () => {
    const id = ++generation.current;
    setLoading(true);
    setError("");
    setData(null);
    setSwapData(null);
    try {
      const r = await boundedFetch(`/api/marketplace?${query}`);
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (d.state.member !== member)
        throw Error("Account changed. Sign in again.");
      if (!alive.current || id !== generation.current) return;
      setData(d.state);
      if (tab === "swaps") {
        const x = await boundedFetch("/api/test-wallet");
        const v = await x.json();
        if (!x.ok || v.state?.member !== member)
          throw Error("Swaps unavailable. Retry.");
        if (alive.current && id === generation.current) setSwapData(v.state);
      }
    } catch (e) {
      if (alive.current && id === generation.current)
        setError(e instanceof Error ? e.message : "Market unavailable");
    } finally {
      if (alive.current && id === generation.current) setLoading(false);
    }
  }, [query, member, tab]);
  useEffect(() => {
    void refresh();
    const online = () => void refresh();
    window.addEventListener("online", online);
    window.addEventListener("docked-app-resume", online);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("docked-app-resume", online);
    };
  }, [refresh]);
  useEffect(() => {
    const back = () => setParams(new URLSearchParams(window.location.search));
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  const navigate = (changes: Record<string, string>, reset = true) => {
    if (inFlight.current) return;
    const p = new URLSearchParams(params);
    if (reset) p.delete("cursor");
    for (const [k, v] of Object.entries(changes)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    window.history.pushState({}, "", `?${p}`);
    setParams(p);
    setDetail(null);
    setReview(null);
    setReceipt(null);
  };
  const send = async (
    command: Record<string, unknown>,
    original?: Envelope,
  ) => {
    if (inFlight.current) return;
    if (recovery && !original) {
      setError("Recover the pending transaction first.");
      return;
    }
    inFlight.current = true;
    const requestGeneration = ++generation.current;
    setLoading(false);
    setBusy(true);
    setError("");
    const envelope = original ?? { request: crypto.randomUUID(), command };
    let definitive = false;
    try {
      localStorage.setItem(key, JSON.stringify(envelope));
      setRecovery(envelope);
      const r = await boundedFetch(`/api/marketplace?${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envelope),
      });
      const d = await r.json();
      if (!r.ok) {
        if (d.outcome === "rejected") {
          definitive = true;
          localStorage.removeItem(key);
          setRecovery(null);
        }
        throw Error(d.error);
      }
      if (!alive.current) return;
      if (d.state.member !== member)
        throw Error("Account changed. Reload using your own account.");
      localStorage.removeItem(key);
      setRecovery(null);
      if (generation.current === requestGeneration) setData(d.state);
      if (command.kind === "review-buy") setReview(d.result);
      else {
        setReview(null);
        setListing(null);
        setCancel(null);
        setDetail(null);
        const confirmedCard =
          d.state.inventory.find(
            (c: { id: string }) => c.id === d.result.card,
          ) ??
          data?.rows.find((l) => l.id === command.listing)?.card ??
          data?.inventory.find((c) => c.id === command.card);
        setReceipt({
          ...d.result,
          action: command.kind,
          displayCard: confirmedCard,
        });
      }
      return d.result;
    } catch (e) {
      if (definitive && alive.current) {
        setReview(null);
        setCancel(null);
        setDetail(null);
        try {
          const latest = await boundedFetch(`/api/marketplace?${query}`);
          const fresh = await latest.json();
          if (
            latest.ok &&
            fresh.state.member === member &&
            generation.current === requestGeneration
          )
            setData(fresh.state);
          if (typeof command.listing === "string") {
            const one = await boundedFetch(
              `/api/marketplace?listing=${encodeURIComponent(command.listing)}`,
            );
            const current = await one.json();
            if (
              one.ok &&
              current.state.member === member &&
              generation.current === requestGeneration
            )
              setDetail(current.state.rows[0] ?? null);
          }
        } catch {
          /* The definitive error remains; a safe read can be retried. */
        }
      }
      if (alive.current)
        setError(
          e instanceof Error
            ? e.message
            : "Connection interrupted. Recover the original request.",
        );
    } finally {
      inFlight.current = false;
      if (alive.current) {
        setBusy(false);
        if (generation.current !== requestGeneration)
          window.dispatchEvent(new Event("docked-app-resume"));
      }
    }
  };
  const closeDetail = useCallback(() => {
    setDetail(null);
    setReview(null);
  }, []);
  const closeListing = useCallback(() => setListing(null), []),
    closeCancel = useCallback(() => setCancel(null), []);
  const credits = (n: number) => n.toLocaleString("en-AU");
  return (
    <main className="test-wallet marketplace">
      <header>
        <p className="eyebrow">DOCKED · NFL</p>
        <h1>Market</h1>
        <p>Test cards · Test Docked Credits — no cash value.</p>
        <nav aria-label="Market shortcuts">
          <Link href="/fantasy/test-wallet?view=packs#packs">Packs</Link> ·{" "}
          <Link href="/fantasy/test-wallet">Wallet & history</Link> ·{" "}
          <Link href="/fantasy/cards">Collection</Link>
        </nav>
        {data && (
          <p>
            <strong>{credits(data.wallet.spendable)}</strong> Docked Credits
            available
          </p>
        )}
      </header>
      <nav className="market-tabs" aria-label="Marketplace sections">
        <Link className="button ghost" href="/fantasy/test-wallet?view=packs#packs">Packs</Link>
        {tabs.map(([v, label]) => (
          <button
            key={v}
            aria-current={tab === v ? "page" : undefined}
            onClick={() => navigate({ tab: v, status: "OPEN", cursor: "" })}
          >
            {label}
          </button>
        ))}
      </nav>
      {recovery && (
        <p role="status">
          A transaction needs confirmation.{" "}
          <button
            disabled={busy}
            onClick={() => void send(recovery.command, recovery)}
          >
            Recover original transaction
          </button>{" "}
          Do not submit it again with a new request.
        </p>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button disabled={loading || busy} onClick={() => void refresh()}>
            Retry loading
          </button>{" "}
          <Link href="/app/login">Sign in</Link>
        </div>
      )}
      {receipt && (
        <section className="market-success" role="status">
          <PlayerShirt card={receipt.displayCard as Row["card"] | undefined} />
          <div>
            <h2>
              {receipt.action === "list"
                ? "Listed"
                : receipt.action === "cancel-listing"
                  ? "Cancelled"
                  : "Purchased"}
            </h2>
            <p>
              {(receipt.displayCard as Row["card"] | undefined)?.name ??
                "Card transaction confirmed"}
            </p>
            {!!receipt.receipt && (
              <p>
                {String((receipt.receipt as { price: number }).price)} Docked
                Credits
              </p>
            )}
          </div>
          <div className="success-actions">
            {receipt.action === "buy" && typeof receipt.card === "string" ? (
              <Link
                className="button"
                href={`/fantasy/cards?card=${encodeURIComponent(receipt.card)}`}
              >
                View card
              </Link>
            ) : (
              typeof receipt.listing === "string" && (
                <Link
                  href={`/fantasy/market?listing=${encodeURIComponent(receipt.listing)}`}
                >
                  View listing
                </Link>
              )
            )}
            <button onClick={() => navigate({ tab: "activity" })}>
              {receipt.receipt ? "View receipt" : "View activity"}
            </button>
          </div>
          {receipt.action === "buy" &&
            !!receipt.receipt &&
            !!receipt.displayCard && (
              <AcquisitionShare
                member={member}
                reference={String(
                  (receipt.receipt as { reference: string }).reference,
                )}
                cards={[receipt.displayCard as Row["card"]]}
              />
            )}
        </section>
      )}
      {tab !== "swaps" && tab !== "activity" && (
        <details className="market-filter-panel">
          <summary>Search & filters</summary>
          <form
            key={query}
            ref={inputForm}
            className="market-filters"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              navigate(
                Object.fromEntries([...f].map(([k, v]) => [k, String(v)])),
              );
            }}
          >
            <label>
              Player search
              <input
                name="q"
                defaultValue={params.get("q") ?? ""}
                maxLength={100}
              />
            </label>
            <label>
              Team
              <select name="team" defaultValue={params.get("team") ?? ""}>
                <option value="">All teams</option>
                {data?.teams.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Position
              <select
                name="position"
                defaultValue={params.get("position") ?? ""}
              >
                <option value="">All positions</option>
                {(data?.positions ?? ["QB", "RB", "WR", "TE", "K"]).map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Rarity
              <select name="rarity" defaultValue={params.get("rarity") ?? ""}>
                <option value="">All rarities</option>
                {rarities.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Minimum credits
              <input
                name="min"
                type="number"
                min="0"
                max="1000000000"
                defaultValue={params.get("min") ?? "0"}
              />
            </label>
            <label>
              Maximum credits
              <input
                name="max"
                type="number"
                min="0"
                max="1000000000"
                defaultValue={params.get("max") ?? "1000000000"}
              />
            </label>
            <label>
              Sort
              <select name="sort" defaultValue={params.get("sort") ?? "newest"}>
                <option value="newest">Newest</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="rarity">Rarity</option>
              </select>
            </label>
            <label>
              Own listings
              <select name="own" defaultValue={params.get("own") ?? "include"}>
                <option value="include">Include</option>
                <option value="exclude">Exclude</option>
                <option value="only">Only mine</option>
              </select>
            </label>
            <label>
              Gameplay
              <select
                name="playable"
                defaultValue={params.get("playable") ?? ""}
              >
                <option value="">All collectibles</option>
                <option value="yes">Seven-player positions</option>
              </select>
            </label>
            <label>
              Eligible for competition
              <select name="round" defaultValue={params.get("round") ?? ""}>
                <option value="">Any / not selected</option>
                {data?.rounds.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Roster
              <select
                name="available"
                defaultValue={params.get("available") ?? ""}
              >
                <option value="">All / unknown included</option>
                <option value="yes">Verified fresh active roster</option>
              </select>
            </label>
            <div>
              <button>Apply filters</button>{" "}
              <button
                type="button"
                onClick={() => {
                  if (inFlight.current) return;
                  inputForm.current?.reset();
                  const p = new URLSearchParams({ tab });
                  window.history.pushState({}, "", `?${p}`);
                  setParams(p);
                }}
              >
                Clear filters
              </button>
            </div>
          </form>
        </details>
      )}
      {loading && <p role="status">Loading market…</p>}
      {data && tab === "listings" && (
        <section>
          <h2>My Listings</h2>
          <div className="actions">
            {["OPEN", "SOLD", "CANCELLED"].map((v) => (
              <button
                key={v}
                aria-pressed={data.query.status === v}
                onClick={() => navigate({ status: v })}
              >
                {v === "OPEN" ? "Active" : v === "SOLD" ? "Sold" : "Cancelled"}
              </button>
            ))}
          </div>
          <details open={!!params.get("sell") || undefined}>
            <summary>Create listing from your owned cards</summary>
            <p>{sevenTransferNotice}</p>
            <p>
              Core cards remain in your collection and cannot be sold for
              credits.
            </p>
            {ownedCard && !data.inventory.some((c) => c.id === ownedCard) && (
              <p>
                This card is not an eligible opened card in this credit economy,
                or is on another inventory page. Free Core cards cannot be sold
                for credits.
              </p>
            )}
            {data.inventory
              .filter((c) => c.id === ownedCard)
              .map((c) => (
                <section key={c.id}>
                  <p>
                    {c.transferReason ||
                      "Eligible to list, subject to confirmation."}
                  </p>
                  {c.listingId && (
                    <Link
                      href={`/fantasy/market?listing=${encodeURIComponent(c.listingId)}`}
                    >
                      Listed · View listing
                    </Link>
                  )}
                  {c.ownerReservations.map((r) => (
                    <p key={`${r.competition}:${r.slot}`}>
                      {r.name} · Entry slot {r.slot}.{" "}
                      <Link
                        href={`/fantasy/play?competition=${encodeURIComponent(r.competition)}`}
                      >
                        Replace card
                        {r.withdrawable
                          ? " or withdraw entry"
                          : " (withdrawal closed)"}
                      </Link>
                    </p>
                  ))}
                </section>
              ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setListing({
                  card: String(f.get("card")),
                  price: Number(f.get("price")),
                });
              }}
            >
              <label>
                Exact owned card
                <select
                  name="card"
                  required
                  value={ownedCard}
                  onChange={(e) => setOwnedCard(e.target.value)}
                >
                  <option value="">Select a card</option>
                  {data.inventory.map((c) => (
                    <option key={c.id} value={c.id} disabled={false}>
                      {c.name} · {c.tier} #{c.serial} · {c.id.slice(-8)}
                      {c.listed
                        ? " — listed"
                        : c.transferReason
                          ? ` — ${c.transferReason}`
                          : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Asking price · Docked Credits
                <input
                  name="price"
                  type="number"
                  min="1"
                  max="1000000000"
                  step="1"
                  required
                  value={askPrice}
                  onChange={(e) => setAskPrice(e.target.value)}
                />
              </label>
              <button
                disabled={
                  busy ||
                  !data.inventory.some(
                    (c) => c.id === ownedCard && !c.listed && !c.transferReason,
                  )
                }
              >
                Review listing
              </button>
            </form>
            <p>
              {data.inventoryTotal} owned opened test cards · showing page{" "}
              {data.query.inventoryPage + 1}
            </p>
            <button
              disabled={data.query.inventoryPage === 0}
              onClick={() =>
                navigate({
                  inventoryPage: String(data.query.inventoryPage - 1),
                  sell: "",
                })
              }
            >
              Previous owned cards
            </button>
            <button
              disabled={
                (data.query.inventoryPage + 1) * 40 >= data.inventoryTotal
              }
              onClick={() =>
                navigate({
                  inventoryPage: String(data.query.inventoryPage + 1),
                  sell: "",
                })
              }
            >
              Next owned cards
            </button>
            {!data.inventory.some((c) => !c.listed && !c.transferReason) && (
              <p>
                No eligible owned test cards. Open an owned pack, cancel a
                listing/offer, or replace a card in Play where permitted.
              </p>
            )}
          </details>
        </section>
      )}
      {data && tab !== "swaps" && tab !== "activity" && (
        <>
          <p>
            {data.total} matching{" "}
            {tab === "activity" ? "transactions" : "listings"}
          </p>
          <div className="market-grid">
            {data.rows.map((l) => (
              <article key={l.id}>
                <FantasyCardArtwork
                  card={l.card}
                  onInspect={() => {
                    setDetail(l);
                    setReview(null);
                  }}
                />
                <small className="listing-identity">
                  {l.card.tier === "CORE"
                    ? "Core · unlimited"
                    : `#${l.card.serial} / ${l.card.max_supply.toLocaleString()}`}
                </small>
                <strong>{credits(l.price)} Docked Credits</strong>
                <small>{l.status}</small>
                {["K", "DEF", "DST"].includes(l.card.position) && (
                  <p>Collectible only · no seven-player slot</p>
                )}
                {l.receipt && (
                  <details>
                    <summary>Transaction details</summary>
                    <p>
                      {l.direction} · {new Date(l.receipt.at).toLocaleString()}{" "}
                      · commission {credits(l.receipt.fee)} · seller receives{" "}
                      {credits(l.receipt.net)} · receipt {l.receipt.reference}
                    </p>
                  </details>
                )}
                <button
                  onClick={() => {
                    setDetail(l);
                    setReview(null);
                  }}
                >
                  {l.status === "OPEN"
                    ? l.own
                      ? "Manage listing"
                      : "View card & buy"
                    : "View card"}
                </button>
              </article>
            ))}
          </div>
          {!data.rows.length && (
            <section>
              <h2>
                {tab === "activity"
                  ? "No completed trades here yet"
                  : data.total === 0 &&
                      ["q", "team", "position", "rarity", "round"].some((k) =>
                        params.get(k),
                      )
                    ? "No matching results"
                    : "No listings here yet"}
              </h2>
              <p>
                {tab === "browse"
                  ? "Try clearing filters, or list an eligible owned card in My Listings."
                  : "Choose another status or explore Browse."}
              </p>
            </section>
          )}
          <div className="actions">
            <button
              disabled={!params.get("cursor")}
              onClick={() => navigate({ cursor: "" })}
            >
              First page
            </button>
            <button
              disabled={!data.next}
              onClick={() => navigate({ cursor: data.next! }, false)}
            >
              Next page
            </button>
          </div>
        </>
      )}
      {data && tab === "activity" && (
        <section>
          <h2>Your activity</h2>
          <label>
            Activity type
            <select
              value={data.query.activityType}
              onChange={(e) => navigate({ activityType: e.target.value })}
            >
              <option value="all">All activity</option>
              <option value="purchase">Purchases</option>
              <option value="sale">Sales</option>
              <option value="cancellation">Cancellations</option>
              <option value="swap">Swap outcomes</option>
            </select>
          </label>
          <p>
            {data.activityTotal}{" "}
            {data.activityTotal === 1 ? "record" : "records"}. Cancellations and
            free swaps are events, not wallet charges.
          </p>
          <div className="market-grid">
            {data.activity.map((a) => (
              <article key={a.id}>
                <h3>
                  {a.kind === "swap"
                    ? "Swap"
                    : a.kind === "cancellation"
                      ? "Cancellation"
                      : a.kind === "sale"
                        ? "Sale"
                        : "Purchase"}{" "}
                  · {a.status}
                </h3>
                <p>{a.description}</p>
                <p>
                  {a.at === null
                    ? "Timestamp unavailable"
                    : new Date(a.at).toLocaleString()}
                </p>
                {a.price !== undefined && (
                  <p>
                    {credits(a.price)} Docked Credits · commission{" "}
                    {credits(a.fee!)} · seller receives {credits(a.net!)}
                  </p>
                )}
                {a.kind === "swap" && a.fee !== undefined && (
                  <p>
                    Your completed swap fee: {credits(a.fee)} Docked Credits
                  </p>
                )}
                <details>
                  <summary>Record reference</summary>
                  <p>{a.reference}</p>
                </details>
                {a.listing && (
                  <Link
                    href={`/fantasy/market?listing=${encodeURIComponent(a.listing)}`}
                  >
                    View listing & receipt
                  </Link>
                )}
              </article>
            ))}
          </div>
          {!data.activity.length && <p>No matching activity yet.</p>}
          <button
            disabled={!params.get("cursor")}
            onClick={() => navigate({ cursor: "" })}
          >
            First page
          </button>
          <button
            disabled={!data.activityNext}
            onClick={() => navigate({ cursor: data.activityNext! }, false)}
          >
            Next page
          </button>
        </section>
      )}
      {tab === "swaps" && (
        <>
          <div className="actions">
            <button
              aria-pressed={!freeSwaps}
              onClick={() => setFreeSwaps(false)}
            >
              Test-credit swaps
            </button>
            <button aria-pressed={freeSwaps} onClick={() => setFreeSwaps(true)}>
              Free beta card swaps
            </button>
          </div>
          {freeSwaps ? (
            <SandboxSwaps member={member} />
          ) : (
            swapData && (
              <MemberTestWallet
                key={member}
                initial={swapData}
                surface="swaps"
              />
            )
          )}
        </>
      )}
      {detail && (
        <FantasySheet title={detail.card.name} onClose={closeDetail}>
          <FantasyCardArtwork card={detail.card} />
          <p>{cardIdentity(detail.card)} · Test economy</p>
          <p>
            Current team {detail.card.team}. Printed team{" "}
            {detail.card.edition_team ?? detail.card.team}. Artwork{" "}
            {detail.card.presentation ?? detail.card.season}.
          </p>
          <p>{detail.card.availability}</p>
          <p>{detail.card.gameplay}</p>
          <p>
            Salary Cap fantasy salary:{" "}
            {detail.card.salary === null
              ? "Unavailable"
              : detail.card.salary.toLocaleString("en-AU")}{" "}
            · {detail.card.salaryRules ?? "Rules unavailable"}. This is a roster
            budget, not Docked Credits or a charge. Open has no salary cap.
          </p>
          <p>
            Asking price: {credits(detail.price)} Docked Credits ·{" "}
            {detail.status}
          </p>
          <p>
            Recent base / rarity-adjusted points: unavailable in this
            marketplace view. No verified scoring period is attached.{" "}
            <Link href="/fantasy/results">View sourced round results</Link>.
          </p>
          {detail.receipt && (
            <p>
              Receipt {detail.receipt.reference} ·{" "}
              {credits(detail.receipt.price)} credits · commission{" "}
              {credits(detail.receipt.fee)} · seller receives{" "}
              {credits(detail.receipt.net)}
            </p>
          )}
          {detail.card.ownerReservations.map((r) => (
            <p key={`${r.competition}:${r.slot}`}>
              {r.name} · Entry slot {r.slot}.{" "}
              <Link
                href={`/fantasy/play?competition=${encodeURIComponent(r.competition)}`}
              >
                Replace card
                {r.withdrawable ? " or withdraw entry" : " (withdrawal closed)"}
              </Link>
            </p>
          ))}
          <p>
            {detail.card.fixture
              ? `Kickoff ${new Date(detail.card.fixture.scheduledAt).toLocaleString()}`
              : "Matchup and kickoff: select a competition, or awaiting mapping."}
          </p>
          <p>{multiplierLabel(detail.card.tier)}</p>
          <p>{sevenTransferNotice}</p>
          {detail.card.transferReason && (
            <p role="status">{detail.card.transferReason}</p>
          )}
          <Link
            href={`/fantasy/scoring/how-it-works${data?.query.round ? `?competition=${encodeURIComponent(data.query.round)}` : ""}`}
          >
            Competition scoring rules
          </Link>
          {detail.status === "OPEN" &&
            (detail.own ? (
              <button
                disabled={busy}
                onClick={() => {
                  setCancel(detail);
                  setDetail(null);
                }}
              >
                Cancel listing
              </button>
            ) : (
              <>
                {!review ? (
                  <button
                    disabled={
                      busy || !!recovery || !!detail.card.transferReason
                    }
                    onClick={() =>
                      void send({ kind: "review-buy", listing: detail.id })
                    }
                  >
                    Review purchase
                  </button>
                ) : (
                  <section>
                    <h3>Confirm purchase</h3>
                    <p>Exact card {review.card}</p>
                    <p>
                      Debit {credits(review.price)} Docked Credits. Available{" "}
                      {credits(data?.wallet.spendable ?? 0)}. Remaining{" "}
                      {credits((data?.wallet.spendable ?? 0) - review.price)}.
                    </p>
                    <p>
                      Marketplace commission {credits(review.fee)}. Seller
                      receives {credits(review.net)}. No extra buyer fee.
                    </p>
                    <p>
                      {(data?.wallet.spendable ?? 0) < review.price &&
                        `Shortfall: ${credits(review.price - (data?.wallet.spendable ?? 0))} Docked Credits. Cash funding is unavailable. `}
                      Review valid until{" "}
                      {new Date(review.expires).toLocaleTimeString()}. Test
                      assets only, no cash value.
                    </p>
                    <button
                      disabled={
                        busy ||
                        !!recovery ||
                        (data?.wallet.spendable ?? 0) < review.price
                      }
                      onClick={() =>
                        void send({
                          kind: "buy",
                          listing: review.listing,
                          review: review.review,
                          expectedPrice: review.price,
                          policy: review.policy,
                          confirmed: true,
                        })
                      }
                    >
                      Confirm purchase · {credits(review.price)} credits
                    </button>
                  </section>
                )}
              </>
            ))}
          {error && <p role="alert">{error}</p>}
          {recovery && (
            <button
              disabled={busy}
              onClick={() => void send(recovery.command, recovery)}
            >
              Recover original transaction
            </button>
          )}
        </FantasySheet>
      )}
      {listing && data && (
        <FantasySheet title="Confirm listing" onClose={closeListing}>
          <p>
            {data.inventory.find((c) => c.id === listing.card)?.name} ·{" "}
            {data.inventory.find((c) => c.id === listing.card)?.tier}
            {data.inventory.find((c) => c.id === listing.card) &&
              ` · ${cardIdentity(data.inventory.find((c) => c.id === listing.card)!)}`}
          </p>
          <details>
            <summary>Exact card identity</summary>
            <p>{listing.card}</p>
          </details>
          <p>Asking price {credits(listing.price)} Docked Credits</p>
          <p>
            Marketplace commission {credits(sellerQuote(listing.price).fee)}{" "}
            (7.5%, half-up whole credit). Seller receives{" "}
            {credits(sellerQuote(listing.price).net)}.
          </p>
          <p>
            No listing fee. Ownership remains yours until a completed purchase.
            Listed cards cannot be newly selected into a team.
          </p>
          <button
            disabled={busy}
            onClick={() => void send({ kind: "list", ...listing })}
          >
            Confirm listing
          </button>
          {error && <p role="alert">{error}</p>}
        </FantasySheet>
      )}
      {cancel && (
        <FantasySheet title="Cancel listing?" onClose={closeCancel}>
          <p>
            {cancel.card.name} · {cardIdentity(cancel.card)}
          </p>
          <p>
            No cancellation fee. Changing the price requires cancellation and
            relisting. If it has already sold, the sale remains final.
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void send({ kind: "cancel-listing", listing: cancel.id })
            }
          >
            Confirm cancellation
          </button>
          {error && <p role="alert">{error}</p>}
        </FantasySheet>
      )}
    </main>
  );
}
