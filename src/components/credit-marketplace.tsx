"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MarketplaceView } from "@/core/marketplace";
import { boundedFetch } from "@/core/bounded-request";
import { rarities, rarityLabel } from "@/core/card-rarity";
import { cardIdentity } from "@/core/card-display";
import { CollectibleViewer, type ViewerCard } from "./collectible-viewer";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { FantasySheet } from "./fantasy-sheet";
import { MarketListingDialog, useMarketCommand } from "./market-listing-dialog";
import { useSport } from "./sport-context";
type Row = MarketplaceView["rows"][number];
type Review = {
  review: string;
  listing: string;
  price: number;
  fee: number;
  net: number;
  policy: string;
  expires: number;
};
const tabs = [
  ["browse", "Browse"],
  ["listings", "My Listings"],
  ["activity", "Activity"],
] as const;
export function Marketplace({ member }: { member: string }) {
  const { sport } = useSport();
  const [params, setParams] = useState(new URLSearchParams()),
    [data, setData] = useState<MarketplaceView | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  const [card, setCard] = useState<ViewerCard | null>(null),
    [manage, setManage] = useState<Row | null>(null),
    [detail, setDetail] = useState<Row | null>(null),
    [review, setReview] = useState<Review | null>(null),
    [receipt, setReceipt] = useState<Record<string, unknown> | null>(null);
  const generation = useRef(0),
    busyRef = useRef(false);
  const tab = ["browse", "listings", "activity"].includes(
    params.get("tab") ?? "",
  )
    ? params.get("tab")!
    : "browse";
  const query = new URLSearchParams(params);
  query.set("tab", tab);
  query.set("sport", sport);
  if (
    sport === "nfl" &&
    ["K", "KICKER"].includes((query.get("position") ?? "").toUpperCase())
  ) {
    query.delete("position");
    query.delete("cursor");
  }
  const queryString = query.toString();
  const {
    busy,
    error: commandError,
    pending,
    send,
  } = useMarketCommand(member, (r, c) => {
    if (c.kind === "review-buy") setReview(r as Review);
    else {
      setReceipt(r);
      setReview(null);
      setDetail(null);
    }
  });
  busyRef.current = busy;
  useEffect(() => {
    if (commandError && !pending) setReview(null);
  }, [commandError, pending]);
  const refresh = useCallback(
    async (background = false) => {
      if (busyRef.current) return;
      const token = ++generation.current;
      if (!background) setLoading(true);
      try {
        const r = await boundedFetch(`/api/marketplace?${queryString}`, {
          cache: "no-store",
        });
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "Marketplace unavailable.");
        if (d.state.member !== member)
          throw Error("Account changed. Sign in again.");
        if (token === generation.current) {
          setData(d.state);
          setError("");
        }
      } catch (e) {
        if (token === generation.current)
          setError(e instanceof Error ? e.message : "Marketplace unavailable.");
      } finally {
        if (token === generation.current) setLoading(false);
      }
    },
    [queryString, member],
  );
  useEffect(() => {
    const back = () => setParams(new URLSearchParams(location.search));
    back();
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  useEffect(() => {
    void refresh();
    const update = () => {
      if (!document.hidden) void refresh(true);
    };
    const timer = setInterval(update, 10000);
    for (const event of [
      "focus",
      "online",
      "docked-app-resume",
      "docked-market-changed",
    ])
      window.addEventListener(event, update);
    document.addEventListener("visibilitychange", update);
    return () => {
      generation.current++;
      clearInterval(timer);
      for (const event of [
        "focus",
        "online",
        "docked-app-resume",
        "docked-market-changed",
      ])
        window.removeEventListener(event, update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refresh]);
  const navigate = (changes: Record<string, string>, cursor = false) => {
    if (busy) return;
    const p = new URLSearchParams(params);
    if (!cursor) p.delete("cursor");
    for (const [k, v] of Object.entries(changes)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    p.set("sport", sport);
    history.pushState({}, "", `?${p}`);
    setParams(p);
    setDetail(null);
    setReview(null);
    setReceipt(null);
  };
  const selected = detail
    ? (data?.rows.find((r) => r.id === detail.id) ?? detail)
    : data?.rows.find((r) => r.id === params.get("listing"));
  const close = () => {
    setDetail(null);
    setReview(null);
    if (params.has("listing")) navigate({ listing: "" });
  };
  return (
    <main className="marketplace fixed-market" data-market-ready={!!data}>
      <header className="market-heading">
        <h1>Marketplace</h1>
        <p>Docked Credits · Test credits have no cash value.</p>
      </header>
      <nav
        className="period-tabs market-tabs"
        aria-label="Marketplace sections"
      >
        {tabs.map(([id, label]) => (
          <button
            className="button"
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() =>
              navigate({
                tab: id,
                listing: "",
                cursor: "",
                q: "",
                rarity: "",
                position: "",
                own: "",
                status: "",
              })
            }
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <div className="market-error" role="alert">
          <p>{error}</p>
          <button className="button" onClick={() => void refresh()}>
            Retry
          </button>
        </div>
      )}
      {pending && !selected && (
        <section role="status">
          <p>A previous request needs confirmation.</p>
          {commandError && <p role="alert">{commandError}</p>}
          <button
            className="button"
            disabled={busy}
            onClick={() => void send(pending.command, true)}
          >
            Check original request
          </button>
        </section>
      )}
      {receipt && (
        <section className="market-confirmed" role="status">
          <h2>Request confirmed</h2>
          {receipt.price !== undefined && (
            <p>{Number(receipt.price).toLocaleString()} Docked Credits</p>
          )}
          <Link className="button" href="/fantasy/cards">
            View collection
          </Link>
          <button
            className="button"
            onClick={() => navigate({ tab: "activity" })}
          >
            View activity
          </button>
        </section>
      )}
      {tab === "browse" && (
        <form
          className="market-filters"
          key={queryString}
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            navigate({
              q: String(f.get("q") ?? ""),
              rarity: String(f.get("rarity") ?? ""),
              position: String(f.get("position") ?? ""),
              sort: String(f.get("sort") ?? "newest"),
              listing: "",
            });
          }}
        >
          <label>
            Search players
            <input
              name="q"
              type="search"
              defaultValue={params.get("q") ?? ""}
            />
          </label>
          <label>
            Rarity
            <select name="rarity" defaultValue={params.get("rarity") ?? ""}>
              <option value="">All rarities</option>
              {rarities.map((r) => (
                <option key={r} value={r}>
                  {rarityLabel(r)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Position
            <select name="position" defaultValue={query.get("position") ?? ""}>
              <option value="">All positions</option>
              {(data?.positions ?? ["QB", "RB", "WR", "TE"]).map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
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
          <button className="button">Apply</button>
          <button
            type="button"
            className="button"
            onClick={() =>
              navigate({
                q: "",
                rarity: "",
                position: "",
                sort: "",
                own: "",
                listing: "",
              })
            }
          >
            Clear
          </button>
        </form>
      )}
      {loading && !data && <p role="status">Loading marketplace…</p>}
      {tab !== "activity" && data && (
        <section
          aria-label={tab === "listings" ? "My Listings" : "Browse listings"}
        >
          <h2>{tab === "listings" ? "My Listings" : "Browse"}</h2>
          <p className="market-count">
            {data.total} active {data.total === 1 ? "listing" : "listings"}
          </p>
          <div className="market-grid">
            {data.rows.map((l) => (
              <article className="market-tile" key={l.id}>
                <FantasyCardArtwork
                  card={l.card}
                  faceOnly
                  onInspect={() => setCard(l.card)}
                />
                <div className="market-listing-footer">
                  <h3>{l.card.name}</h3>
                  <span>
                    {rarityLabel(l.card.tier)} · {cardIdentity(l.card)}
                  </span>
                  <strong className="market-price">
                    {l.price.toLocaleString()} credits
                  </strong>
                  <span className="market-status">
                    Active {l.own ? "· Your listing" : ""}
                  </span>
                  <span>Seller: {l.seller}</span>
                  {tab === "listings" ? (
                    <button className="button" onClick={() => setManage(l)}>
                      Manage listing
                    </button>
                  ) : (
                    <button
                      className="button"
                      onClick={() => {
                        setDetail(l);
                        setReview(null);
                      }}
                    >
                      {l.own ? "View listing" : "Buy card"}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {!data.rows.length && !error && (
            <div className="market-empty">
              <h3>
                {tab === "listings"
                  ? "No active listings"
                  : "No listings found"}
              </h3>
              {tab === "listings" ? (
                <Link className="button" href="/fantasy/cards">
                  Go to collection
                </Link>
              ) : (
                <p>Try another filter or check back soon.</p>
              )}
            </div>
          )}
          <Pagination
            next={data.next}
            cursor={params.get("cursor")}
            navigate={navigate}
          />
        </section>
      )}
      {tab === "activity" && data && (
        <section>
          <h2>Market activity</h2>
          {data.query.sale && (
            <button
              className="button ghost"
              onClick={() => navigate({ sale: "", cursor: "" })}
            >
              View all activity
            </button>
          )}
          <div className="period-tabs" aria-label="Activity filter">
            {[
              ["all", "All"],
              ["purchase", "Bought"],
              ["sale", "Sold"],
            ].map(([value, label]) => (
              <button
                className="button"
                key={value}
                aria-pressed={data.query.activityType === value}
                onClick={() => navigate({ activityType: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="market-activity">
            {data.activity.map((a) => (
              <article key={a.id}>
                <div className="market-thumbnail">
                  <FantasyCardArtwork
                    card={a.card}
                    faceOnly
                    onInspect={() => setCard(a.card)}
                  />
                </div>
                <div className="market-activity-name">
                  <h3>{a.card.name}</h3>
                  <p>
                    {rarityLabel(a.card.tier)} · {cardIdentity(a.card)}
                  </p>
                  <time>
                    {a.at
                      ? new Date(a.at).toLocaleDateString("en-AU")
                      : "Date unavailable"}
                  </time>
                </div>
                <div className="market-activity-amount">
                  <span className={`market-badge ${a.kind}`}>
                    {a.kind === "sale" ? "Sold" : "Bought"}
                  </span>
                  <strong>{a.price?.toLocaleString()} credits</strong>
                  <span>{a.kind === "sale" ? "Sale price" : "Paid"}</span>
                  {a.kind === "sale" && (
                    <small>
                      Fee {a.fee?.toLocaleString()} · Received{" "}
                      {a.net?.toLocaleString()}
                    </small>
                  )}
                  {a.status !== "SOLD" && <span>{a.status}</span>}
                </div>
              </article>
            ))}
          </div>
          {!data.activity.length && !error && (
            <p>No completed purchases or sales yet.</p>
          )}
          <Pagination
            next={data.activityNext}
            cursor={params.get("cursor")}
            navigate={navigate}
          />
        </section>
      )}
      <details className="market-help">
        <summary>Fees & selling</summary>
        <p>
          Seller commission is 5%, rounded half-up to whole credits, with no
          minimum and a maximum of 2,000 credits. Buyers pay only the asking
          price. Competition restrictions still apply.
        </p>
      </details>
      {manage && (
        <MarketListingDialog
          card={manage.card}
          listing={manage}
          onClose={() => setManage(null)}
          onSaved={() => void refresh(true)}
        />
      )}
      {selected && (
        <FantasySheet
          title={selected.card.name}
          historyEntry
          onClose={close}
          className="market-purchase-sheet"
        >
          <div className="market-confirm-card">
            <FantasyCardArtwork
              card={selected.card}
              faceOnly
              onInspect={() => setCard(selected.card)}
            />
          </div>
          <p>
            {rarityLabel(selected.card.tier)} · {cardIdentity(selected.card)}
          </p>
          <p>Seller: {selected.seller}</p>
          <strong className="market-price">
            {(review?.price ?? selected.price).toLocaleString()} Docked Credits
          </strong>
          <p>No buyer commission.</p>
          {selected.own ? (
            <>
              <p>Your listing</p>
              <button
                className="button"
                onClick={() => navigate({ tab: "listings", listing: "" })}
              >
                My Listings
              </button>
            </>
          ) : (
            <>
              {selected.card.transferReason && (
                <p>{selected.card.transferReason}</p>
              )}
              {commandError && <p role="alert">{commandError}</p>}
              {pending && !busy ? (
                <button
                  className="button"
                  onClick={() => void send(pending.command, true)}
                >
                  Check original request
                </button>
              ) : review ? (
                <>
                  <p>You pay {review.price.toLocaleString()} credits.</p>
                  <button
                    className="button primary"
                    disabled={busy}
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
                    {busy ? "Confirming…" : "Confirm purchase"}
                  </button>
                </>
              ) : (
                <button
                  className="button primary"
                  disabled={
                    busy ||
                    !!selected.card.transferReason ||
                    !data?.tradingEnabled
                  }
                  onClick={() =>
                    void send({ kind: "review-buy", listing: selected.id })
                  }
                >
                  {busy ? "Checking…" : "Review purchase"}
                </button>
              )}
            </>
          )}
        </FantasySheet>
      )}
      {card && <CollectibleViewer card={card} onClose={() => setCard(null)} />}
    </main>
  );
}
function Pagination({
  next,
  cursor,
  navigate,
}: {
  next: string | null;
  cursor: string | null;
  navigate: (v: Record<string, string>, cursor?: boolean) => void;
}) {
  return (
    <div className="actions market-pagination">
      <button
        className="button"
        disabled={!cursor}
        onClick={() => navigate({ cursor: "" })}
      >
        First page
      </button>
      <button
        className="button"
        disabled={!next}
        onClick={() => navigate({ cursor: next! }, true)}
      >
        Next page
      </button>
    </div>
  );
}
