"use client";
import { competitionLabel } from "@/core/competition-display";
import { useSport } from "./sport-context";
import { boundedFetch } from "@/core/bounded-request";
import { collectionPositions, sevenEligibility } from "@/core/card-display";
import { fullTeamName } from "@/core/card-presentation";
import { RarityCounts } from "./rarity-counts";
import { ProfileOverview } from "./profile-overview";
import type { PrivateAccountSummary } from "@/core/profile-overview";
import { rarities, rarityRule } from "@/core/card-rarity";
import { FantasyCardArtwork as Card } from "./fantasy-card-artwork";
import { PackProducts } from "./pack-products";
import Link from "next/link";
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  lazy,
  Suspense,
  type FormEvent,
} from "react";
import {
  fantasyRetry,
  type PendingFantasyRequest,
} from "@/core/fantasy-request";
import { FantasyPlay } from "./fantasy-play";
import { FantasyPlayerDetails } from "./fantasy-player-sheet";
import { FantasyAdmin } from "./fantasy-admin";
import { FantasyRewards } from "./fantasy-rewards";
import { fantasyResponseRejects } from "@/core/fantasy-response";
import type { FantasyCard, FantasyState } from "@/core/fantasy";
import type { AwardedCard, PackReceipt } from "@/core/pack-opening";
import { FantasySheet } from "./fantasy-player-sheet";
const PackOpening = lazy(() => import("./pack-opening"));
import { PackViewerBoundary } from "./pack-viewer-boundary";
const tiers: string[] = rarities;
const stamp = (s: string) =>
  new Date(s).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  });
export function FantasyScreen({
  tab,
  initial,
  packExperience = false,
  account,
}: {
  tab: string;
  initial: FantasyState;
  packExperience?: boolean;
  account?: PrivateAccountSummary;
}) {
  const production = initial.mode === "production";
  const [showPacks, setShowPacks] = useState(false);
  const [teamFilter, setTeamFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [collectionView, setCollectionView] = useState<"grid" | "list">("grid");
  const [collectionPage, setCollectionPage] = useState({ key: "", index: 0 });
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const { sport } = useSport();
  const [competitionFilter] = useState("");
  const [search, setSearch] = useState(""),
    [tier, setTier] = useState(""),
    [position, setPosition] = useState(""),
    [subset] = useState("all"),
    [sort, setSort] = useState("newest");
  useEffect(() => {
    setSearch("");
    const requested = new URLSearchParams(location.search).get("rarity") ?? "";
    setTier(tiers.includes(requested) ? requested : "");
    setPosition("");
    setTeamFilter("");
    setCollectionPage({ key: "", index: 0 });
  }, [sport]);
  const [detail, setDetail] = useState<string | null>(null),
    [reveal, setReveal] = useState<string[]>([]),
    [revealIndex, setRevealIndex] = useState(0);
  const [recipient, setRecipient] = useState(""),
    [give, setGive] = useState<string[]>([]),
    [receive, setReceive] = useState<string[]>([]);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("card");
    if (id && initial.cards.some((c) => c.id === id)) setDetail(id);
  }, [initial.user_id]);
  const closeDetail = useCallback(() => setDetail(null), []);
  const [pack, setPack] = useState<{
    name: string;
    id?: string;
    receipt?: PackReceipt | null;
  } | null>(null);
  const [awardedDetail, setAwardedDetail] = useState<AwardedCard | null>(null);
  const closePack = useCallback(() => setPack(null), []);
  const closeAwardedDetail = useCallback(() => setAwardedDetail(null), []);
  const lastState = useRef(initial);
  const pending = useRef<PendingFantasyRequest | null>(null);
  const pendingUnconfirmed = useRef(false);
  const inFlight = useRef(false);
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const r = await boundedFetch("/api/fantasy", { cache: "no-store" });
      if (!r.ok) {
        if (r.status === 403)
          setData({ ...initial, cards: [], seven: undefined });
        throw Error(
          "Could not refresh. Sign in again if your session has expired.",
        );
      }
      const next = await r.json();
      if (next.state.user_id !== initial.user_id) {
        window.location.reload();
        return;
      }
      setData(next.state);
      lastState.current = next.state;
      setMessage("Updated from the server.");
    } catch {
      setMessage("Could not refresh. Please retry.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [initial]);
  useEffect(() => {
    if (!inFlight.current) setData(initial);
  }, [initial]);
  useEffect(() => {
    const resume = () => void refresh();
    window.addEventListener("docked-app-resume", resume);
    window.addEventListener("online", resume);
    return () => {
      window.removeEventListener("docked-app-resume", resume);
      window.removeEventListener("online", resume);
    };
  }, [refresh]);
  async function act(action: string, payload: Record<string, unknown> = {}) {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      pending.current = fantasyRetry(pending.current, action, payload, () =>
        crypto.randomUUID(),
      );
      const response = await boundedFetch("/api/fantasy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending.current),
      });
      const result = await response.json();
      if (!response.ok) {
        if (
          fantasyResponseRejects(
            response.status,
            result,
            pendingUnconfirmed.current,
          )
        )
          pending.current = null;
        throw Error(result.error);
      }
      pending.current = null;
      pendingUnconfirmed.current = false;
      setData(result.state);
      lastState.current = result.state;
      setMessage("Saved securely.");
      return result.result as Record<string, unknown>;
    } catch (e) {
      pendingUnconfirmed.current = pending.current !== null;
      setMessage(
        e instanceof Error
          ? `${e.message}${pending.current ? " Retry the pending action below to confirm its outcome without duplicating it." : ""}`
          : "Request failed. Refresh to check the saved state before retrying.",
      );
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function form(
    event: FormEvent<HTMLFormElement>,
    action: string,
    fields: (f: FormData) => Record<string, unknown>,
  ) {
    event.preventDefault();
    void act(action, fields(new FormData(event.currentTarget)));
  }
  const name = (id: string) =>
    data.members.find((m) => m.id === id)?.name ?? "Preview member";
  const filtered = data.cards
    .filter(
      (c) =>
        (!search ||
          `${c.name} ${c.team} ${c.serial} ${c.season}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        c.sport === sport &&
        (!teamFilter || c.team === teamFilter) &&
        (!competitionFilter || !sevenEligibility(c, data, competitionFilter)) &&
        (!tier || c.tier === tier) &&
        (!position || c.position === position) &&
        (subset === "all" ||
          (subset === "first" && c.kind === "first_year") ||
          (subset === "listed" && c.listed) ||
          (subset === "tradeable" && c.tradeable) ||
          (subset === "retired" && ["retired", "delisted"].includes(c.status))),
    )
    .sort((a, b) =>
      sort === "rarity"
        ? tiers.indexOf(b.tier) - tiers.indexOf(a.tier)
        : sort === "player"
          ? a.name.localeCompare(b.name)
          : sort === "serial"
            ? a.serial - b.serial
            : sort === "season"
              ? b.season.localeCompare(a.season)
              : b.created_at.localeCompare(a.created_at),
    );
  const pageKey = JSON.stringify([
    data.user_id,
    sport,
    search,
    tier,
    position,
    subset,
    sort,
    competitionFilter,
    teamFilter,
  ]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const pageIndex = Math.min(
    collectionPage.key === pageKey ? collectionPage.index : 0,
    pageCount - 1,
  );
  const visibleCards = filtered.slice(pageIndex * 10, pageIndex * 10 + 10);
  const sportCards = data.cards.filter((c) => c.sport === sport);
  const toggle = (id: string, list: string[], setter: (v: string[]) => void) =>
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const title: Record<string, string> = {
    play: "Your next match starts here.",
    cards: "Cards",
    market: "Find your next first-team player.",
    social: "The game is better together.",
    profile: "Your Docked record.",
    admin: production ? "Free-play administration." : "Preview control room.",
  };
  const rewardsPanel = data.rewards ? (
    <FantasyRewards
      rewards={data.rewards}
      busy={busy}
      act={act}
      refresh={refresh}
      onOpenStarter={
        packExperience && data.nfl_beta
          ? () =>
              setPack({
                name: "NFL starter pack",
                receipt: data.starter_receipt,
              })
          : undefined
      }
      onReplayStarter={
        packExperience && data.starter_receipt
          ? () =>
              setPack({
                name: "NFL starter pack",
                receipt: data.starter_receipt,
              })
          : undefined
      }
    />
  ) : null;
  return (
    <div className={`fantasy-screen fantasy-screen-${tab}`} aria-busy={busy}>
      {!["play", "social", "cards", "profile"].includes(tab) && (
        <header className="fantasy-heading">
          <div>
            <p className="eyebrow">
              FANTASY CARDS · {production ? "FREE PLAY" : "PREVIEW V1"}
            </p>
            <h1>{title[tab]}</h1>
          </div>
          <Link className="credit-chip" href="/fantasy/profile">
            {Number(
              production ? (data.rewards?.points ?? 0) : data.credits,
            ).toLocaleString()}{" "}
            <span>{production ? "gameplay points" : "test credits"}</span>
          </Link>
        </header>
      )}
      <p role="status" className={message ? "fantasy-message" : "sr-only"}>
        {busy ? "Saving…" : message}
      </p>
      {pending.current && !busy && (
        <button
          onClick={() => {
            const p = pending.current;
            if (p) void act(p.action, p.payload);
          }}
        >
          Retry pending action
        </button>
      )}
      {tab === "play" && <FantasyPlay data={data} busy={busy} act={act} />}
      {tab === "play" && (
        <button disabled={busy} onClick={() => void refresh()}>
          Refresh team & points
        </button>
      )}
      {tab === "cards" && (
        <div className="collection-heading">
          <div>
            <h1>My collection</h1>
            <p>
              {sportCards.length} cards · {sport.toUpperCase()}
            </p>
          </div>
          <div className="pack-discovery compact-pack-actions">
            <a
              className="pack-discovery-tile"
              href={
                sport === "nfl"
                  ? "/fantasy/test-wallet?view=packs&packs=mine#packs"
                  : data.rewards?.starter_entitled &&
                      !data.rewards.starter_claimed
                    ? "#starter-pack"
                    : "#my-packs"
              }
              onClick={() => setShowPacks(true)}
            >
              Open packs
            </a>
            <Link
              href="/fantasy/test-wallet?view=packs#packs"
              className="pack-discovery-tile buy-packs"
            >
              Buy packs
            </Link>
          </div>
        </div>
      )}
      {production &&
        tab === "cards" &&
        !data.rewards?.starter_claimed &&
        rewardsPanel}
      {production && tab === "market" && (
        <section className="fantasy-panel">
          <h2>Marketplace is not open yet</h2>
          <p>
            Free starter cards are available in Cards. Buying, selling and
            transfers remain disabled while the non-monetary marketplace rules
            are reviewed.
          </p>
          <Link className="button" href="/fantasy/cards">
            Go to my cards
          </Link>
        </section>
      )}
      {production &&
        !data.nfl_beta &&
        tab === "admin" &&
        (data.admin ? (
          <section className="fantasy-panel">
            <h2>Reward policy</h2>
            <p>
              Changes apply to future claims. Earlier awards retain their
              original policy and outcome. Administrator MFA is required.
            </p>
            <form
              className="fantasy-form"
              onSubmit={(e) =>
                form(e, "admin_reward_policy", (f) => ({
                  daily_points: Number(f.get("daily_points")),
                  card_every: Number(f.get("card_every")),
                  daily_card_limit: Number(f.get("daily_card_limit")),
                }))
              }
            >
              <label>
                Daily gameplay points
                <input
                  name="daily_points"
                  type="number"
                  required
                  min={1}
                  max={50}
                  defaultValue={data.rewards?.policy.daily_points ?? 10}
                />
              </label>
              <label>
                Card reward every claimed days
                <input
                  name="card_every"
                  type="number"
                  required
                  min={7}
                  max={365}
                  defaultValue={data.rewards?.policy.card_every ?? 7}
                />
              </label>
              <label>
                Shared daily card limit
                <input
                  name="daily_card_limit"
                  type="number"
                  required
                  min={0}
                  max={100}
                  defaultValue={data.rewards?.policy.daily_card_limit ?? 100}
                />
              </label>
              <button disabled={busy}>Save new policy version</button>
            </form>
            <h2>Starter allocation</h2>
            <p>
              After the current allocation is exhausted, authorize up to 1,000
              further Starter packs from the same limited editions. This never
              increases card supply or grants a second Starter to an account.
            </p>
            <form
              className="fantasy-form"
              onSubmit={(e) =>
                form(e, "admin_starter_stock", (f) => ({
                  quantity: Number(f.get("quantity")),
                }))
              }
            >
              <label>
                Pack allocation
                <input
                  name="quantity"
                  type="number"
                  min={1}
                  max={1000}
                  required
                  defaultValue={1000}
                />
              </label>
              <button disabled={busy}>Authorize next allocation</button>
            </form>
            <h2>Create a free round</h2>
            <form
              className="fantasy-form"
              onSubmit={(e) =>
                form(e, "admin_free_round", (f) => ({
                  name: f.get("name"),
                  season: f.get("season"),
                  round: Number(f.get("round")),
                  locks_at: new Date(String(f.get("locks_at"))).toISOString(),
                }))
              }
            >
              <label>
                Name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  defaultValue="Free football league"
                />
              </label>
              <label>
                Season
                <input
                  name="season"
                  required
                  maxLength={20}
                  defaultValue="2027"
                />
              </label>
              <label>
                Round
                <input name="round" type="number" required min={1} max={1000} />
              </label>
              <label>
                Lineup lock · your local time
                <input name="locks_at" type="datetime-local" required />
              </label>
              <p>
                Legacy football rules: eleven unique players, equal scoring and
                no cash prize. Lock must be within 90 days.
              </p>
              <button disabled={busy}>Create free round</button>
            </form>
            <h2>Score a locked round</h2>
            <form
              className="fantasy-form"
              onSubmit={(e) =>
                form(e, "admin_simulate", (f) => ({
                  competition_id: f.get("competition_id"),
                  seed: Number(f.get("seed")),
                }))
              }
            >
              <label>
                Round
                <select name="competition_id" required>
                  {data.competitions
                    .filter((c) => !c.scored_at)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {competitionLabel(c)}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Simulation seed
                <input
                  name="seed"
                  type="number"
                  required
                  min={0}
                  defaultValue={2027}
                />
              </label>
              <button disabled={busy}>Score and publish</button>
            </form>
          </section>
        ) : (
          <p>Administrator access requires a private role and MFA.</p>
        ))}
      {tab === "cards" && (
        <>
          <details
            id="my-packs"
            className="pack-history"
            open={showPacks || data.packs.some((p) => !p.opened_at)}
          >
            <summary>My packs & history</summary>
            <h2 className="sr-only">My packs</h2>
            {data.rewards?.starter_claimed && rewardsPanel}
            <p>
              {production
                ? "Free starter and earned reward packs. Permanent serials are assigned securely from limited inventory."
                : "Test credits only. Pack outcomes and serials are assigned by the server."}
            </p>
            <div className="pack-grid">
              {data.shop
                .filter(
                  (p) =>
                    p.name !== "Starter" ||
                    !data.packs.some((x) => x.name === "Starter"),
                )
                .map((p) => (
                  <article className="pack-tile" key={p.id}>
                    <span>DOCKED</span>
                    <h3>{p.name}</h3>
                    <p>
                      {p.slots.length} cards ·{" "}
                      {p.price ? `${p.price} test credits` : "Free"}
                    </p>
                    <details>
                      <summary>Pool probabilities & guarantees</summary>
                      <p>
                        {Object.entries(p.weights)
                          .map(
                            ([k, v]) =>
                              `${k}: ${Number(((100 * v) / Object.values(p.weights).reduce((sum, weight) => sum + weight, 0)).toFixed(2))}%`,
                          )
                          .join(" · ")}
                      </p>
                      <p>
                        {Object.keys(p.guarantees).length
                          ? Object.values(p.guarantees).join(", ")
                          : "No minimum tier guarantee"}
                      </p>
                    </details>
                    <button
                      disabled={busy || p.sold >= p.max_quantity}
                      onClick={() =>
                        act(
                          p.name === "Starter" ? "claim_starter" : "buy_pack",
                          p.name === "Starter" ? {} : { definition_id: p.id },
                        )
                      }
                    >
                      {p.name === "Starter" ? "Claim Starter" : "Get pack"}
                    </button>
                  </article>
                ))}
            </div>
            {!data.packs.some((p) => !p.opened_at) && (
              <p>
                No unopened packs.{" "}
                <Link href="/fantasy/test-wallet?view=packs#packs">
                  Browse packs
                </Link>
              </p>
            )}
            {data.packs.map((p) => (
              <div className="fantasy-row" key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <small>
                    {p.opened_at
                      ? `Opened ${stamp(p.opened_at)}`
                      : "Ready to open"}
                  </small>
                </div>
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (packExperience) {
                      // Generic packs also reuse their persisted items. Missing display data
                      // never causes a new award; NFL uses its dedicated original receipt.
                      const cards = (p.cards ?? []).map((id) =>
                        data.cards.find((c) => c.id === id),
                      );
                      if (p.opened_at && cards.some((c) => !c)) {
                        setMessage(
                          "Some cards from this pack are no longer in your collection. Its saved result is unchanged.",
                        );
                        return;
                      }
                      setPack({
                        name: p.name,
                        id: p.id,
                        receipt: p.opened_at
                          ? {
                              id: p.id,
                              name: p.name,
                              opened_at: p.opened_at,
                              cards: cards as FantasyCard[],
                            }
                          : null,
                      });
                      return;
                    }
                    const r = await act("open_pack", { pack_id: p.id });
                    if (r?.cards) {
                      setReveal(r.cards as string[]);
                      setRevealIndex(0);
                    }
                  }}
                >
                  {p.opened_at ? "View result" : "Open pack"}
                </button>
              </div>
            ))}
          </details>
          {reveal.length > 0 && (
            <section className="fantasy-reveal" aria-label="Pack reveal">
              <p className="eyebrow">
                YOUR PACK · {Math.min(revealIndex + 1, reveal.length)} /{" "}
                {reveal.length}
              </p>
              {revealIndex < reveal.length ? (
                data.cards
                  .filter((c) => c.id === reveal[revealIndex])
                  .map((c) => <Card key={c.id} card={c} />)
              ) : (
                <>
                  <h2>Added to your collection</h2>
                  <p>
                    {reveal.length} cards. Your result is permanently recorded.
                  </p>
                </>
              )}
              <button
                className="button"
                onClick={() =>
                  revealIndex < reveal.length
                    ? setRevealIndex(revealIndex + 1)
                    : setReveal([])
                }
              >
                {revealIndex < reveal.length
                  ? "Reveal next"
                  : "Back to collection"}
              </button>
            </section>
          )}
          <section className="collection-workspace" aria-label="My cards">
            <RarityCounts
              cards={data.cards}
              sport={sport}
              selected={tier}
              onSelect={(value) => {
                setTier(value);
                setCollectionPage({ key: "", index: 0 });
              }}
            />
            <div className="collection-toolbar">
              <label className="collection-search">
                <span className="sr-only">Search your cards</span>
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCollectionPage({ key: "", index: 0 });
                  }}
                  placeholder="Search players, teams or serials"
                />
              </label>
              <button
                className="mobile-filter-toggle"
                aria-expanded={filtersOpen}
                aria-controls="collection-filter-fields"
                onClick={() => setFiltersOpen(!filtersOpen)}
              >
                Filters
                {[teamFilter, position, tier].filter(Boolean).length
                  ? " · active"
                  : ""}
              </button>
              <div
                id="collection-filter-fields"
                className={
                  "collection-filter-fields" + (filtersOpen ? " is-open" : "")
                }
              >
                <label>
                  Team
                  <select
                    aria-label="Team"
                    value={teamFilter}
                    onChange={(e) => {
                      setTeamFilter(e.target.value);
                      setCollectionPage({ key: "", index: 0 });
                    }}
                  >
                    <option value="">All teams</option>
                    {[...new Set(sportCards.map((c) => c.team))]
                      .sort()
                      .map((t) => (
                        <option key={t} value={t}>
                          {fullTeamName({ sport, team: t })}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Position
                  <select
                    aria-label="Position"
                    value={position}
                    onChange={(e) => {
                      setPosition(e.target.value);
                      setCollectionPage({ key: "", index: 0 });
                    }}
                  >
                    <option value="">All positions</option>
                    {collectionPositions(sport).map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Rarity
                  <select
                    aria-label="Rarity"
                    value={tier}
                    onChange={(e) => {
                      setTier(e.target.value);
                      setCollectionPage({ key: "", index: 0 });
                    }}
                  >
                    <option value="">All rarities</option>
                    {tiers.map((t) => (
                      <option key={t} value={t}>
                        {rarityRule(t).label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sort
                  <select
                    aria-label="Sort"
                    value={sort}
                    onChange={(e) => {
                      setSort(e.target.value);
                      setCollectionPage({ key: "", index: 0 });
                    }}
                  >
                    {["newest", "rarity", "player", "serial", "season"].map(
                      (t) => (
                        <option key={t}>{t}</option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <div
                className="collection-view"
                role="group"
                aria-label="Collection view"
              >
                <button
                  aria-pressed={collectionView === "grid"}
                  onClick={() => setCollectionView("grid")}
                >
                  Grid
                </button>
                <button
                  aria-pressed={collectionView === "list"}
                  onClick={() => setCollectionView("list")}
                >
                  List
                </button>
              </div>
            </div>
            <h2 className="sr-only">Owned cards</h2>
            <div className={`card-grid collection-${collectionView}`}>
              {visibleCards.map((c) => (
                <Card key={c.id} card={c} onInspect={() => setDetail(c.id)}>
                  <div className="collection-card-footer">
                    <button
                      onClick={() => setDetail(detail === c.id ? null : c.id)}
                      aria-expanded={detail === c.id}
                    >
                      View card →
                    </button>
                  </div>
                  {c.listed && <span className="collection-state">Listed</span>}
                </Card>
              ))}
            </div>
            <nav
              className="collection-pagination"
              aria-label="Collection pages"
            >
              <span>
                {filtered.length
                  ? "Showing " +
                    (pageIndex * 10 + 1) +
                    "–" +
                    Math.min(filtered.length, (pageIndex + 1) * 10) +
                    " of " +
                    filtered.length
                  : "0 matching cards"}
              </span>
              <button
                disabled={pageIndex === 0}
                onClick={() =>
                  setCollectionPage({ key: pageKey, index: pageIndex - 1 })
                }
              >
                Previous
              </button>
              <span>
                Page {pageIndex + 1} of {pageCount}
              </span>
              <button
                disabled={pageIndex + 1 >= pageCount}
                onClick={() =>
                  setCollectionPage({ key: pageKey, index: pageIndex + 1 })
                }
              >
                Next
              </button>
            </nav>
            {!filtered.length && (
              <p className="fantasy-empty">
                No cards match these filters. Try another rarity, team or
                position.
              </p>
            )}
          </section>
        </>
      )}
      {tab === "market" && !production && (
        <>
          <section className="fantasy-panel">
            <h2>List a card</h2>
            <p>
              Seller fee: {data.fee_bps / 100}%. The fee is fixed on each
              listing. No buyer fee. Card-to-card trades are free.
            </p>
            <form
              className="fantasy-form"
              onSubmit={(e) =>
                form(e, "list", (f) => ({
                  card_id: f.get("card_id"),
                  price: Number(f.get("price")),
                }))
              }
            >
              <label>
                Your tradeable card
                <select name="card_id" required>
                  {data.cards
                    .filter((c) => c.tradeable && !c.listed)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.tier} · #{c.serial}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Test credit price
                <input
                  name="price"
                  type="number"
                  min={1}
                  max={1e9}
                  required
                  defaultValue={1000}
                />
              </label>
              <button
                disabled={
                  busy || !data.cards.some((c) => c.tradeable && !c.listed)
                }
              >
                Create listing
              </button>
            </form>
          </section>
          <section>
            <h2>Browse the market</h2>
            <div className="fantasy-filters">
              <label>
                Search player
                <input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCollectionPage({ key: "", index: 0 });
                  }}
                />
              </label>
              <label>
                Tier
                <select
                  value={tier}
                  onChange={(e) => {
                    setTier(e.target.value);
                    setCollectionPage({ key: "", index: 0 });
                  }}
                >
                  <option value="">All tiers</option>
                  {tiers.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="market-grid">
              {data.market
                .filter(
                  (l) =>
                    (!tier || l.tier === tier) &&
                    l.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((l) => (
                  <article className="fantasy-panel" key={l.id}>
                    <p className="eyebrow">
                      {l.tier} · {l.position}
                    </p>
                    <h3>{l.name}</h3>
                    <p>
                      #{l.serial} / {l.max_supply} · {l.season} ·{" "}
                      {l.kind === "first_year" ? "FIRST YEAR" : "SEASON"}
                    </p>
                    <p>
                      Seller: {name(l.seller)} · {l.status}
                    </p>
                    <strong>
                      {Number(l.price).toLocaleString()} test credits
                    </strong>
                    <p>Seller fee {l.fee_bps / 100}%</p>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() =>
                        act(
                          l.seller === data.user_id ? "cancel_listing" : "buy",
                          { listing_id: l.id },
                        )
                      }
                    >
                      {l.seller === data.user_id
                        ? "Cancel my listing"
                        : "Buy now"}
                    </button>
                  </article>
                ))}
            </div>
            {!data.market.length && (
              <p className="fantasy-empty">
                No listings yet. Open a tradeable pack to start the market.
              </p>
            )}
          </section>
          <section className="fantasy-panel">
            <h2>Make a card trade</h2>
            <p>
              Select your cards and the recipient’s listed cards. Both sides
              must still own every card when the trade is accepted.
            </p>
            <label>
              Recipient
              <select
                value={recipient}
                onChange={(e) => {
                  setRecipient(e.target.value);
                  setReceive([]);
                }}
              >
                <option value="">Choose member</option>
                {data.members
                  .filter((m) => m.id !== data.user_id)
                  .map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="trade-columns">
              <fieldset>
                <legend>You give</legend>
                {data.cards
                  .filter((c) => c.tradeable)
                  .map((c) => (
                    <label key={c.id}>
                      <input
                        type="checkbox"
                        checked={give.includes(c.id)}
                        onChange={() => toggle(c.id, give, setGive)}
                      />
                      {c.name} #{c.serial}
                    </label>
                  ))}
              </fieldset>
              <fieldset>
                <legend>You receive</legend>
                {data.market
                  .filter((l) => l.seller === recipient)
                  .map((l) => (
                    <label key={l.card_id}>
                      <input
                        type="checkbox"
                        checked={receive.includes(l.card_id)}
                        onChange={() => toggle(l.card_id, receive, setReceive)}
                      />
                      {l.name} #{l.serial}
                    </label>
                  ))}
              </fieldset>
            </div>
            <button
              disabled={busy || !give.length || !receive.length || !recipient}
              onClick={() => act("offer_trade", { recipient, give, receive })}
            >
              Send trade offer
            </button>
          </section>
          <section className="fantasy-panel">
            <h2>Trade offers</h2>
            {data.trades.map((t) => (
              <div key={t.id} className="trade-offer">
                <p>
                  {name(t.sender)} → {name(t.recipient)} ·{" "}
                  {new Date(t.expires_at).getTime() <= Date.now() &&
                  t.state === "pending"
                    ? "expired"
                    : t.state}
                </p>
                <p>
                  {t.items
                    .map(
                      (i) =>
                        `${i.from_user === t.sender ? "Gives" : "Requests"} ${data.cards.find((c) => c.id === i.card_id)?.name ?? data.market.find((c) => c.card_id === i.card_id)?.name ?? i.card_id}`,
                    )
                    .join(" · ")}
                </p>
                {t.state === "pending" && (
                  <div className="actions">
                    {t.recipient === data.user_id ? (
                      <>
                        <button
                          disabled={busy}
                          onClick={() =>
                            act("accept_trade", { trade_id: t.id })
                          }
                        >
                          Accept
                        </button>
                        <button
                          disabled={busy}
                          onClick={() =>
                            act("decline_trade", { trade_id: t.id })
                          }
                        >
                          Decline
                        </button>
                      </>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => act("cancel_trade", { trade_id: t.id })}
                      >
                        Cancel offer
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {!data.trades.length && <p>No offers yet.</p>}
          </section>
        </>
      )}
      {tab === "profile" && (
        <ProfileOverview data={data} account={account} onRefresh={refresh} />
      )}
      {tab === "admin" &&
        !production &&
        (data.admin ? (
          <>
            <FantasyAdmin catalog={data.catalog} act={act} busy={busy} />
            <section className="fantasy-panel">
              <h2>Allocate test credits</h2>
              <form
                className="fantasy-form"
                onSubmit={(e) =>
                  form(e, "admin_credit", (f) => ({
                    user_id: f.get("user_id"),
                    amount: Number(f.get("amount")),
                  }))
                }
              >
                <label>
                  Member
                  <select name="user_id">
                    {data.members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Credits
                  <input
                    type="number"
                    min={1}
                    max={1e6}
                    name="amount"
                    defaultValue={1000}
                  />
                </label>
                <button disabled={busy}>Allocate credits</button>
              </form>
            </section>
            <section className="fantasy-panel">
              <h2>Create competition</h2>
              <form
                className="fantasy-form"
                onSubmit={(e) =>
                  form(e, "admin_competition", (f) => ({
                    name: f.get("name"),
                    season: "2027",
                    round: Number(f.get("round")),
                    locks_at: new Date(String(f.get("lock"))).toISOString(),
                    rules: {
                      tier_max: { ELITE: 1, LEGENDARY: 0, ICON: 0 },
                      core_min: 5,
                    },
                  }))
                }
              >
                <label>
                  Name
                  <input
                    name="name"
                    required
                    defaultValue="Rookie Test Round"
                  />
                </label>
                <label>
                  Round
                  <input type="number" name="round" defaultValue={2} min={1} />
                </label>
                <label>
                  Lock (local time)
                  <input type="datetime-local" name="lock" required />
                </label>
                <button disabled={busy}>Create round</button>
              </form>
            </section>
            <section className="fantasy-panel">
              <h2>Simulate a locked round</h2>
              <p>
                Deterministic football event adapter. Same seed and player state
                produce the same statistics. Published results cannot be
                rerolled.
              </p>
              <form
                className="fantasy-form"
                onSubmit={(e) =>
                  form(e, "admin_simulate", (f) => ({
                    competition_id: f.get("competition_id"),
                    seed: Number(f.get("seed")),
                  }))
                }
              >
                <label>
                  Round
                  <select name="competition_id">
                    {data.competitions
                      .filter((c) => !c.scored_at)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {competitionLabel(c)} · {stamp(c.locks_at)}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Seed
                  <input
                    name="seed"
                    type="number"
                    defaultValue={2027}
                    min={0}
                  />
                </label>
                <button disabled={busy}>Simulate & publish results</button>
              </form>
            </section>
            <section className="fantasy-panel">
              <h2>Player status</h2>
              <form
                className="fantasy-form"
                onSubmit={(e) =>
                  form(e, "admin_status", (f) => ({
                    player_id: f.get("player_id"),
                    status: f.get("status"),
                  }))
                }
              >
                <label>
                  Player ID
                  <input
                    name="player_id"
                    required
                    placeholder="Player UUID from card record"
                  />
                </label>
                <label>
                  Status
                  <select name="status">
                    {[
                      "active",
                      "injured",
                      "suspended",
                      "unavailable",
                      "dropped",
                      "retired",
                      "delisted",
                    ].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <button disabled={busy}>Update status</button>
              </form>
              <p>Player IDs for your collection:</p>
              <details>
                <summary>Inspect player records</summary>
                {Array.from(
                  new Map(data.cards.map((c) => [c.player_id, c])).values(),
                ).map((c) => (
                  <p key={c.player_id}>
                    {c.name}: <code>{c.player_id}</code>
                  </p>
                ))}
              </details>
            </section>
            <section className="fantasy-panel">
              <h2>Issue replacement pack</h2>
              <form
                className="fantasy-form"
                onSubmit={(e) =>
                  form(e, "admin_replacement", (f) => ({
                    card_id: f.get("card_id"),
                  }))
                }
              >
                <label>
                  Eligible retired card ID
                  <input name="card_id" required />
                </label>
                <button disabled={busy}>Issue one replacement</button>
              </form>
            </section>
          </>
        ) : (
          <p>Administrator access requires a database role and MFA.</p>
        ))}
      {detail && data.cards.find((c) => c.id === detail) && (
        <FantasyPlayerDetails
          roundId={competitionFilter || undefined}
          card={data.cards.find((c) => c.id === detail)!}
          state={data}
          onClose={closeDetail}
        />
      )}
      {pack && packExperience && (
        <PackViewerBoundary onClose={closePack}>
          <Suspense
            fallback={
              <div role="status">
                Loading pack viewer… <button onClick={closePack}>Close</button>
              </div>
            }
          >
            <PackOpening
              userId={data.user_id}
              name={pack.name}
              receipt={pack.receipt}
              onClose={closePack}
              ownedIds={data.cards.map((c) => c.id)}
              openPack={async () => {
                const result = await act(
                  pack.id ? "open_pack" : "open_nfl_starter",
                  pack.id ? { pack_id: pack.id } : {},
                );
                if (!result) throw Error("Pack unconfirmed");
                if (!pack.id) {
                  const receipt = lastState.current.starter_receipt;
                  if (!receipt) throw Error("Receipt not available");
                  return receipt;
                }
                const saved = lastState.current.packs.find(
                  (p) => p.id === pack.id,
                );
                if (!saved?.opened_at || !saved.cards?.length)
                  throw Error("Receipt not available");
                const cards = saved.cards.map((id) =>
                  lastState.current.cards.find((c) => c.id === id),
                );
                if (cards.some((c) => !c))
                  throw Error("Card details not available");
                return {
                  id: saved.id,
                  name: saved.name,
                  opened_at: saved.opened_at,
                  cards: cards as FantasyCard[],
                };
              }}
              onViewCard={(card) => {
                closePack();
                if (data.cards.some((c) => c.id === card.id))
                  setDetail(card.id);
                else setAwardedDetail(card);
              }}
            />
          </Suspense>
        </PackViewerBoundary>
      )}
      {awardedDetail && (
        <FantasySheet title="Original pack card" onClose={closeAwardedDetail}>
          <Card card={awardedDetail} />
          <p>
            This original award is no longer in your collection. Current
            ownership details remain private.
          </p>
        </FantasySheet>
      )}
      {tab === "market" && (
        <>
          <PackProducts />
        </>
      )}
    </div>
  );
}
