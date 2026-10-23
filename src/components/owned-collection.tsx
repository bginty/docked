"use client";
import {
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useSport } from "./sport-context";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { FantasySheet } from "./fantasy-sheet";
import { LightSweep, StartupReady } from "./startup-loading";
import { boundedFetch } from "@/core/bounded-request";
import {
  collectionRarities,
  collectionSports,
  rarityLabel,
  type CollectionCard,
  type CollectionPage,
  type CollectionQuery,
} from "@/core/owned-collection";
import { rarityStyle } from "@/core/rarity-theme";
const Viewer = lazy(() =>
  import("./collectible-viewer").then((m) => ({
    default: m.CollectibleViewer,
  })),
);
const Packs = lazy(() =>
  import("./collection-packs").then((m) => ({ default: m.CollectionPacks })),
);
const labels = { nfl: "NFL", basketball: "NBA", afl: "AFL", nrl: "NRL" };
// Memory only, scoped to the authenticated member. No persistent private inventory.
const cache = new Map<string, { page: CollectionPage; at: number }>();
let cacheMember = "";
function remember(key: string, page: CollectionPage) {
  cache.delete(key);
  cache.set(key, { page, at: Date.now() });
  if (cache.size > 24) cache.delete(cache.keys().next().value!);
}
const Tile = memo(function Tile({
  card,
  onOpen,
  disabled,
}: {
  card: CollectionCard;
  onOpen: (card: CollectionCard) => void;
  disabled: boolean;
}) {
  return (
    <div className="owned-tile" data-card-id={card.id}>
      <FantasyCardArtwork
        card={card}
        faceOnly
        onInspect={disabled ? undefined : () => onOpen(card)}
      />
      <span className="owned-kind">
        {card.inventory === "beta" ? "Beta inventory" : "Collectible"}
      </span>
    </div>
  );
});

export function OwnedCollection({ member }: { member: string }) {
  const { sport, change, beta } = useSport();
  const [tab, setTab] = useState<"cards" | "packs">("cards");
  useEffect(() => {
    const read = () =>
      setTab(
        new URLSearchParams(location.search).get("tab") === "packs"
          ? "packs"
          : "cards",
      );
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);
  const selectTab = (value: "cards" | "packs") => {
    setTab(value);
    const url = new URL(location.href);
    if (value === "packs") url.searchParams.set("tab", "packs");
    else url.searchParams.delete("tab");
    history.replaceState(null, "", url);
  };
  if (!collectionSports.includes(sport as CollectionQuery["sport"]))
    return <p>This collection is unavailable.</p>;
  const selected = sport as CollectionQuery["sport"];
  return (
    <section className="owned-collection">
      <StartupReady />
      <nav className="owned-sports" aria-label="Collection sport">
        {collectionSports.map((s) => (
          <button
            key={s}
            disabled={s !== "nfl" && !beta.includes(s)}
            aria-pressed={sport === s}
            onClick={() => change(s)}
          >
            {labels[s]}
          </button>
        ))}
      </nav>
      <nav className="owned-tabs" aria-label="Collection navigation">
        <button
          aria-pressed={tab === "cards"}
          onClick={() => selectTab("cards")}
        >
          My Cards
        </button>
        <button
          aria-pressed={tab === "packs"}
          onClick={() => selectTab("packs")}
        >
          Packs
        </button>
      </nav>
      {tab === "cards" ? (
        <CollectionInventory
          key={`${member}:${sport}`}
          member={member}
          sport={selected}
          onOpenPacks={() => selectTab("packs")}
        />
      ) : (
        <Suspense fallback={<LightSweep compact label="Loading your packs…" />}>
          <Packs key={`${member}:${sport}`} member={member} sport={selected} />
        </Suspense>
      )}
    </section>
  );
}
function CollectionInventory({
  member,
  sport,
  onOpenPacks,
}: {
  member: string;
  sport: CollectionQuery["sport"];
  onOpenPacks: () => void;
}) {
  const [search, setSearch] = useState(""),
    [debounced, setDebounced] = useState(""),
    [rarity, setRarity] = useState<CollectionQuery["rarity"]>("ALL");
  const [team, setTeam] = useState(""),
    [position, setPosition] = useState(""),
    [sort, setSort] = useState<CollectionQuery["sort"]>("recent");
  const [drawer, setDrawer] = useState(false),
    [detail, setDetail] = useState<CollectionCard | null>(null);
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined]);
  const [attempt, setAttempt] = useState(0);
  const query = new URLSearchParams({
    sport,
    rarity,
    search: debounced,
    team,
    position,
    sort,
  });
  const cursor = cursors.at(-1);
  if (cursor) query.set("cursor", cursor);
  const url = `/api/fantasy/collection?${query}`;
  const key = member + url;
  if (cacheMember !== member) {
    cache.clear();
    cacheMember = member;
  }
  const cached = cache.get(key);
  const [result, setResult] = useState<{
    key: string;
    page: CollectionPage;
  } | null>(cached ? { key, page: cached.page } : null);
  const [verified, setVerified] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [denied, setDenied] = useState(false);
  const [notice, setNotice] = useState("");
  const current = result?.key === key ? result.page : cached?.page;
  const page = denied ? undefined : current;
  const summary = denied ? undefined : (page ?? result?.page);
  const open = useCallback((card: CollectionCard) => setDetail(card), []);
  const close = useCallback(() => setDetail(null), []);
  const scroller = useRef<HTMLDivElement>(null);
  const backgroundRefresh = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setCursors([undefined]);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const invalidate = () => {
      backgroundRefresh.current = false;
      cache.clear();
      setVerified("");
      setDetail(null);
      clearTimeout(timer);
      timer = setTimeout(() => {
        setCursors([undefined]);
        setAttempt((n) => n + 1);
      }, 120);
    };
    const resume = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    for (const event of [
      "docked-app-resume",
      "docked-market-changed",
      "docked:offers-updated",
      "focus",
      "online",
    ])
      window.addEventListener(event, resume);
    document.addEventListener("visibilitychange", resume);
    // Cross-device transfers are rechecked while this collection is visible.
    const poll = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      backgroundRefresh.current = true;
      setAttempt((n) => n + 1);
    }, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      for (const event of [
        "docked-app-resume",
        "docked-market-changed",
        "docked:offers-updated",
        "focus",
        "online",
      ])
        window.removeEventListener(event, resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setDenied(false);
    if (!backgroundRefresh.current) setVerified("");
    backgroundRefresh.current = false;
    void boundedFetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          if ([401, 403].includes(response.status)) {
            cache.clear();
            setResult(null);
            setDenied(true);
            setDetail(null);
          }
          throw Error(data.error || "Collection unavailable");
        }
        if (data.member !== member || data.sport !== sport) {
          cache.clear();
          setResult(null);
          setDenied(true);
          setDetail(null);
          throw Error("Your account changed. Sign in again.");
        }
        if (data.changed) {
          cache.clear();
          setResult(null);
          setNotice("Your collection changed. Showing the latest cards.");
          setCursors([undefined]);
          setAttempt((n) => n + 1);
          return;
        }
        setDetail((previous) =>
          previous
            ? ((data.cards as CollectionCard[]).find(
                (card) => card.id === previous.id,
              ) ?? null)
            : null,
        );
        remember(key, data);
        setResult({ key, page: data });
        setVerified(key);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Collection unavailable");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [url, key, member, sport, attempt]);
  const reset = () => {
    setSearch("");
    setDebounced("");
    setRarity("ALL");
    setTeam("");
    setPosition("");
    setSort("recent");
    setCursors([undefined]);
  };
  const filtered = !!(
    search ||
    team ||
    position ||
    rarity !== "ALL" ||
    sort !== "recent"
  );
  const isVerified = verified === key && !error;
  return (
    <>
      <header className="owned-heading">
        <div>
          <h1>My Collection</h1>
          <p>
            {summary
              ? `${summary.total.toLocaleString()} owned ${summary.total === 1 ? "card" : "cards"}`
              : "Your owned cards"}
          </p>
        </div>
        <Link href={`/fantasy/market?sport=${sport}`}>Market ↗</Link>
      </header>
      <div className="owned-rarities" aria-label="Filter by rarity">
        {(["ALL", ...collectionRarities] as const).map((r) => (
          <button
            key={r}
            style={r === "ALL" ? undefined : rarityStyle(r)}
            aria-pressed={rarity === r}
            onClick={() => {
              setRarity(r);
              setCursors([undefined]);
            }}
          >
            {rarityLabel(r)}
            {summary && (
              <span>
                {r === "ALL" ? summary.total : (summary.counts[r] ?? 0)}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="owned-search">
        <input
          aria-label="Search your cards"
          placeholder="Player, team or serial number"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={() => setDrawer(true)}
          aria-label="Open collection filters"
        >
          Filters{team || position || sort !== "recent" ? " •" : ""}
        </button>
      </div>
      {filtered && (
        <button className="owned-reset" onClick={reset}>
          Reset filters
        </button>
      )}
      {drawer && (
        <FantasySheet
          title="Collection filters"
          onClose={() => setDrawer(false)}
          className="owned-filter-sheet"
        >
          <div className="owned-filter-fields">
            <label>
              Position
              <select
                value={position}
                onChange={(e) => {
                  setPosition(e.target.value);
                  setCursors([undefined]);
                }}
              >
                <option value="">All positions</option>
                {summary?.positions.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Team
              <select
                value={team}
                onChange={(e) => {
                  setTeam(e.target.value);
                  setCursors([undefined]);
                }}
              >
                <option value="">All teams</option>
                {summary?.teams.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Sort by
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as CollectionQuery["sort"]);
                  setCursors([undefined]);
                }}
              >
                <option value="recent">Recently acquired</option>
                <option value="rarity">Highest rarity</option>
                <option value="name">Player name</option>
                <option value="serial">Serial number</option>
              </select>
            </label>
            <div className="actions">
              <button onClick={reset}>Reset filters</button>
              <button className="button" onClick={() => setDrawer(false)}>
                Show cards
              </button>
            </div>
          </div>
        </FantasySheet>
      )}
      {notice && (
        <p className="small-note" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="owned-error" role="alert">
          <p>{error}</p>
          {denied ? (
            <Link href="/app/login">Sign in</Link>
          ) : (
            <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
          )}
        </div>
      )}
      {!page && !error && (
        <LightSweep compact label="Loading your collection…" />
      )}
      {page && (
        <>
          {loading && (
            <p className="owned-refresh" role="status">
              Updating ownership…
            </p>
          )}
          {page.cards.length ? (
            <div
              ref={scroller}
              className="owned-grid"
              aria-label="Owned cards"
              aria-busy={loading}
            >
              {page.cards.map((card) => (
                <Tile
                  key={card.id}
                  card={card}
                  onOpen={open}
                  disabled={!isVerified}
                />
              ))}
            </div>
          ) : (
            <div className="owned-empty">
              <h2>
                {page.total
                  ? "No matching cards"
                  : "Your collection starts here"}
              </h2>
              <p>
                {page.total
                  ? "Try another player, team or rarity."
                  : "Open a pack to add cards to your collection. Free Core players are ready in Play."}
              </p>
              {page.total ? (
                <button onClick={reset}>Reset filters</button>
              ) : (
                <div className="actions">
                  <button className="button" onClick={onOpenPacks}>
                    Explore packs
                  </button>
                  <Link href={`/fantasy/play?sport=${sport}`}>
                    Play with free Core
                  </Link>
                </div>
              )}
            </div>
          )}
          {(cursors.length > 1 || page.next) && (
            <nav className="owned-pagination" aria-label="Collection pages">
              <button
                disabled={loading || cursors.length === 1}
                onClick={() => {
                  setCursors((c) => c.slice(0, -1));
                  scroller.current?.scrollIntoView({ block: "start" });
                }}
              >
                Previous
              </button>
              <span>
                {(cursors.length - 1) * 18 + 1}–
                {(cursors.length - 1) * 18 + page.cards.length} of{" "}
                {page.filtered}
              </span>
              <button
                disabled={loading || !page.next}
                onClick={() => {
                  setCursors((c) => [...c, page.next!]);
                  scroller.current?.scrollIntoView({ block: "start" });
                }}
              >
                Next cards
              </button>
            </nav>
          )}
          {page.cards.some((c) => c.inventory === "beta") && (
            <details className="owned-disclosure">
              <summary>About beta inventory</summary>
              <p>
                Beta cards are non-permanent testing inventory. Docked test
                credits have no cash value.
              </p>
            </details>
          )}
        </>
      )}
      {detail && isVerified && (
        <Suspense
          fallback={
            <FantasySheet
              title={detail.name}
              onClose={close}
              className="collectible-viewer"
            >
              <LightSweep compact label="Opening card…" />
            </FantasySheet>
          }
        >
          <Viewer card={detail} onClose={close} />
        </Suspense>
      )}
    </>
  );
}
