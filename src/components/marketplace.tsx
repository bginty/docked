"use client";
import { competitionNames } from "@/core/competition-display";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MarketplaceView } from "@/core/marketplace";
import { boundedFetch } from "@/core/bounded-request";
import { useClientReady } from "./use-client-ready";
import { rarities } from "@/core/card-rarity";
import { cardIdentity, multiplierLabel } from "@/core/card-display";
import { sellerQuote } from "@/core/credits-policy";
import { sevenTransferNotice } from "@/core/nfl-seven";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { AcquisitionShare } from "./acquisition-share";
import { PlayerShirt } from "./fantasy-player-sheet";
import { FantasySheet } from "./fantasy-player-sheet";
import { MemberTestWallet } from "./member-test-wallet";
import { MakeCardOffer, PrivateOffersInbox } from "./private-card-offers";
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
  const ready = useClientReady();
  const [params, setParams] = useState(() => new URLSearchParams());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [data, setData] = useState<MarketplaceView | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null),
    [review, setReview] = useState<Review | null>(null),
    [listing, setListing] = useState<{
      card: string;
      price: number;
      preference: "sell" | "swap" | "both";
      listing?: string;
    } | null>(null),
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
    if (!ready) return;
    void refresh();
    const online = () => void refresh();
    window.addEventListener("online", online);
    window.addEventListener("docked-app-resume", online);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("docked-app-resume", online);
    };
  }, [refresh, ready]);
  useEffect(() => {
    const back = () => setParams(new URLSearchParams(window.location.search));
    back();
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
    <main
      className="test-wallet marketplace"
      data-market-ready={ready}
      inert={!ready}
    >
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
      <nav className="market-primary" aria-label="Buy or sell">
        <button
          className="button"
          aria-pressed={tab === "listings"}
          onClick={() =>
            navigate({
              tab: "listings",
              q: "",
              inventoryPage: "0",
              own: "only",
            })
          }
        >
          Sell / Swap
        </button>
        <button
          className="button"
          aria-pressed={tab === "browse"}
          onClick={() => navigate({ tab: "browse", q: "", own: "exclude" })}
        >
          Buy / Browse
        </button>
      </nav>
      {data && !data.tradingEnabled && (
        <p className="notice" role="status">
          Trading is paused. Browse your cards and prepare listings; buying,
          listing and acceptance are unavailable until beta trading is approved.
        </p>
      )}
      <Link className="market-offers-link" href="/fantasy/market?tab=swaps">
        Offers received & sent →
      </Link>
      <nav className="market-tabs" aria-label="Marketplace sections">
        <Link
          className="button ghost"
          href="/fantasy/test-wallet?view=packs#packs"
        >
          Packs
        </Link>
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
        <section
          className="market-filter-panel"
          aria-label="Search and filters"
        >
          <form
            className="market-quick-search"
            key={query}
            onSubmit={(e) => {
              e.preventDefault();
              navigate({
                q: String(new FormData(e.currentTarget).get("q") ?? ""),
              });
            }}
          >
            <label>
              <span className="sr-only">Search players</span>
              <input
                name="q"
                type="search"
                placeholder="Search players…"
                defaultValue={params.get("q") ?? ""}
                maxLength={100}
              />
            </label>
            <button type="submit">Search</button>
            <button type="button" onClick={() => setFiltersOpen(true)}>
              Filters
            </button>
            <label>
              <span className="sr-only">Sort listings</span>
              <select
                value={params.get("sort") ?? "newest"}
                onChange={(e) => navigate({ sort: e.target.value })}
              >
                <option value="newest">Newest</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
                <option value="rarity">Rarity</option>
              </select>
            </label>
          </form>
          {[...params].some(
            ([key, value]) =>
              value && !["tab", "sort", "cursor", "sell"].includes(key),
          ) && (
            <div className="market-filter-chips" aria-label="Active filters">
              {[...params]
                .filter(
                  ([key, value]) =>
                    value && !["tab", "sort", "cursor", "sell"].includes(key),
                )
                .map(([key, value]) => (
                  <button
                    type="button"
                    key={key}
                    onClick={() => navigate({ [key]: "" })}
                    aria-label={`Remove ${key} filter`}
                  >
                    <span>
                      {(
                        {
                          q: "Player",
                          min: "Min",
                          max: "Max",
                          team: "Team",
                          position: "Position",
                          rarity: "Rarity",
                          round: "Competition",
                          playable: "Gameplay",
                          available: "Roster",
                          own: "Listings",
                        } as Record<string, string>
                      )[key] ?? "Filter"}
                      :{" "}
                      {key === "round"
                        ? (data?.rounds.find((r) => r.id === value)?.name ??
                          "Selected")
                        : value}
                    </span>{" "}
                    ×
                  </button>
                ))}
              <button
                type="button"
                onClick={() =>
                  navigate(
                    Object.fromEntries(
                      [...params]
                        .filter(([k]) => !["tab", "sort"].includes(k))
                        .map(([k]) => [k, ""]),
                    ),
                  )
                }
              >
                Clear all
              </button>
            </div>
          )}
          {filtersOpen && (
            <FantasySheet
              title="Market filters"
              onClose={() => setFiltersOpen(false)}
            >
              <form
                key={query}
                ref={inputForm}
                className="market-filters"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  setFiltersOpen(false);
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
                    {(data?.positions ?? ["QB", "RB", "WR", "TE", "K"]).map(
                      (t) => (
                        <option key={t}>{t}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Rarity
                  <select
                    name="rarity"
                    defaultValue={params.get("rarity") ?? ""}
                  >
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
                    placeholder="No minimum"
                    defaultValue={params.get("min") ?? ""}
                  />
                </label>
                <label>
                  Maximum credits
                  <input
                    name="max"
                    type="number"
                    min="0"
                    max="1000000000"
                    placeholder="No maximum"
                    defaultValue={params.get("max") ?? ""}
                  />
                </label>
                <label>
                  Sort
                  <select
                    name="sort"
                    defaultValue={params.get("sort") ?? "newest"}
                  >
                    <option value="newest">Newest</option>
                    <option value="price-asc">Price: low to high</option>
                    <option value="price-desc">Price: high to low</option>
                    <option value="rarity">Rarity</option>
                  </select>
                </label>
                <label>
                  Own listings
                  <select
                    name="own"
                    defaultValue={params.get("own") ?? "include"}
                  >
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
                      setFiltersOpen(false);
                      const p = new URLSearchParams({ tab });
                      window.history.pushState({}, "", `?${p}`);
                      setParams(p);
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              </form>
            </FantasySheet>
          )}
        </section>
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
          <h3>Select a card</h3>
          <div className="market-owned-grid">
            {data.inventory.map((c) => (
              <article key={c.id}>
                <FantasyCardArtwork
                  card={c}
                  faceOnly
                  onInspect={() => {
                    if (!c.listed && !c.transferReason)
                      setListing({
                        card: c.id,
                        price: 1000,
                        preference: "sell",
                      });
                  }}
                />
                <small>
                  {c.listed
                    ? "Listed"
                    : c.transferReason || "Available to list"}
                </small>
                {c.listed ? (
                  <Link
                    href={`/fantasy/market?listing=${encodeURIComponent(c.listingId ?? "")}`}
                  >
                    Manage listing
                  </Link>
                ) : (
                  <button
                    disabled={!!c.transferReason}
                    onClick={() =>
                      setListing({
                        card: c.id,
                        price: 1000,
                        preference: "sell",
                      })
                    }
                  >
                    Select card
                  </button>
                )}
              </article>
            ))}
          </div>
          {!data.inventory.length && <p>No owned cards match these filters.</p>}
          <div className="actions">
            <button
              disabled={data.query.inventoryPage === 0}
              onClick={() =>
                navigate({
                  inventoryPage: String(data.query.inventoryPage - 1),
                  sell: "",
                })
              }
            >
              Previous cards
            </button>
            <span>{data.inventoryTotal} owned cards</span>
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
              Next cards
            </button>
          </div>
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
                <div className="market-listing-footer">
                  <strong>
                    {l.preference === "swap"
                      ? "Open to swaps"
                      : `${credits(l.price)} Docked Credits`}
                  </strong>
                  {l.preference === "both" && (
                    <small>Also open to swap offers</small>
                  )}
                  <small>{l.status}</small>
                  {["K", "DEF", "DST"].includes(l.card.position) && (
                    <p>Collectible only · no seven-player slot</p>
                  )}
                  {l.receipt && (
                    <details>
                      <summary>Transaction details</summary>
                      <p>
                        {l.direction} ·{" "}
                        {new Date(l.receipt.at).toLocaleString()} · commission{" "}
                        {credits(l.receipt.fee)} · seller receives{" "}
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
                        : "View card & offers"
                      : "View card"}
                  </button>
                </div>
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
      {tab === "swaps" && <PrivateOffersInbox member={member} />}
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
            {competitionNames.SALARY_CAP} fantasy salary:{" "}
            {detail.card.salary === null
              ? "Unavailable"
              : detail.card.salary.toLocaleString("en-AU")}{" "}
            · {detail.card.salaryRules ?? "Rules unavailable"}. This is a roster
            budget, not Docked Credits or a charge. {competitionNames.OPEN} has no salary cap.
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
              <div className="actions">
                <button
                  disabled={busy || !data?.tradingEnabled}
                  onClick={() => {
                    setListing({
                      card: detail.card.id,
                      price: detail.price,
                      preference: detail.preference,
                      listing: detail.id,
                    });
                    setDetail(null);
                  }}
                >
                  Edit listing
                </button>
                <button
                  disabled={busy}
                  onClick={() => {
                    setCancel(detail);
                    setDetail(null);
                  }}
                >
                  Cancel listing
                </button>
              </div>
            ) : (
              <>
                <MakeCardOffer
                  card={detail.card.id}
                  member={member}
                  enabled={!!data?.offersEnabled}
                  listing={detail.id}
                  preference={detail.preference}
                />
                {detail.preference !== "swap" &&
                  (!review ? (
                    <button
                      disabled={
                        busy ||
                        !data?.tradingEnabled ||
                        !!recovery ||
                        !!detail.card.transferReason
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
                          !data?.tradingEnabled ||
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
                  ))}
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
          <label>
            Listing preference
            <select
              value={listing.preference}
              onChange={(e) =>
                setListing({
                  ...listing,
                  preference: e.target.value as "sell" | "swap" | "both",
                  price: e.target.value === "swap" ? 0 : listing.price || 1000,
                })
              }
            >
              <option value="sell">Sell for credits</option>
              <option value="swap">Open to swaps</option>
              <option value="both">Sell or swap</option>
            </select>
          </label>
          {listing.preference !== "swap" && (
            <label>
              Asking price · test credits
              <input
                type="number"
                min={1}
                max={1000000000}
                step={1}
                value={listing.price || ""}
                onChange={(e) =>
                  setListing({ ...listing, price: Number(e.target.value) })
                }
              />
            </label>
          )}
          {listing.preference === "swap" ? (
            <p>
              Buyers propose their own card. Review the exact offer and
              applicable swap fee before accepting.
            </p>
          ) : (
            listing.price > 0 &&
            Number.isSafeInteger(listing.price) &&
            listing.price <= 1000000000 && (
              <p>
                Sale commission {credits(sellerQuote(listing.price).fee)}{" "}
                credits (7.5%). You receive{" "}
                {credits(sellerQuote(listing.price).net)} credits.
              </p>
            )
          )}
          {listing.listing && (
            <p>
              Saving replaces this listing. Offers made against the previous
              terms cannot be accepted.
            </p>
          )}
          <p>
            Visible only to members allowed by your{" "}
            <Link href="/profile">collection privacy</Link>. Hidden cards stay
            hidden. Enable offers in your collection settings to receive
            proposals.
          </p>
          <p>
            No listing fee. Ownership remains yours until a completed purchase.
            Listed cards cannot be newly selected into a team.
          </p>
          <button
            disabled={
              busy ||
              !data.tradingEnabled ||
              (listing.preference !== "sell" && !data.offersEnabled) ||
              !Number.isSafeInteger(listing.price) ||
              listing.price < (listing.preference === "swap" ? 0 : 1) ||
              listing.price > 1000000000
            }
            onClick={() =>
              void send({
                kind: listing.listing ? "replace-listing" : "list",
                ...listing,
              })
            }
          >
            {data.tradingEnabled
              ? "List card"
              : "Listing unavailable — trading paused"}
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
