"use client";
import Link from "next/link";
import { useState, useRef, type CSSProperties, type FormEvent } from "react";
import {
  fantasyRetry,
  type PendingFantasyRequest,
} from "@/core/fantasy-request";
import { FantasyHero } from "./fantasy-brand";
import { FantasyAdmin } from "./fantasy-admin";
import type { FantasyCard, FantasyState } from "@/core/fantasy";
const tiers = ["CORE", "RARE", "ELITE", "LEGENDARY", "ICON"];
const stamp = (s: string) =>
  new Date(s).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Sydney",
  });
function Card({
  card,
  children,
}: {
  card: FantasyCard;
  children?: React.ReactNode;
}) {
  return (
    <article
      className={`fantasy-card tier-${card.tier.toLowerCase()}`}
      style={{ "--shirt": card.colour } as CSSProperties}
    >
      <div className="card-top">
        <span>{card.tier}</span>
        <span>{card.position}</span>
      </div>
      <div className="card-shirt" aria-hidden="true">
        <svg viewBox="0 0 160 150">
          <path
            d="M49 10 12 31 29 65 44 57 44 138 116 138 116 57 131 65 148 31 111 10 97 20 63 20Z"
            fill="var(--shirt)"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M63 20Q80 43 97 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
        </svg>
        <b>{card.shirt}</b>
      </div>
      <p className="card-team">{card.team}</p>
      <h3>{card.name}</h3>
      <p>
        {card.season} · {card.kind === "first_year" ? "FIRST YEAR" : "SEASON"}
      </p>
      <div className="card-serial">
        #{String(card.serial).padStart(3, "0")}{" "}
        <span>/ {card.max_supply.toLocaleString()}</span>
      </div>
      <p className="card-status">
        {["retired", "delisted"].includes(card.status)
          ? "RETIRED / COLLECTIBLE ONLY"
          : card.status.toUpperCase()}
      </p>
      {!card.tradeable && (
        <p className="starter-label">STARTER CARD · Not tradeable</p>
      )}
      {children}
    </article>
  );
}
export function FantasyScreen({
  tab,
  initial,
}: {
  tab: string;
  initial: FantasyState;
}) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [search, setSearch] = useState(""),
    [tier, setTier] = useState(""),
    [position, setPosition] = useState(""),
    [subset, setSubset] = useState("all"),
    [sort, setSort] = useState("newest");
  const [detail, setDetail] = useState<string | null>(null),
    [reveal, setReveal] = useState<string[]>([]),
    [revealIndex, setRevealIndex] = useState(0);
  const [competition, setCompetition] = useState(
      data.competitions[0]?.id ?? "",
    ),
    [selected, setSelected] = useState<string[]>(
      data.entries.find((e) => e.competition_id === data.competitions[0]?.id)
        ?.cards ?? [],
    );
  const [recipient, setRecipient] = useState(""),
    [give, setGive] = useState<string[]>([]),
    [receive, setReceive] = useState<string[]>([]);
  const pending = useRef<PendingFantasyRequest | null>(null);
  const inFlight = useRef(false);
  async function act(action: string, payload: Record<string, unknown> = {}) {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setMessage("");
    try {
      pending.current = fantasyRetry(pending.current, action, payload, () =>
        crypto.randomUUID(),
      );
      const response = await fetch("/api/fantasy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending.current),
      });
      const result = await response.json();
      if (!response.ok) {
        pending.current = null;
        throw Error(result.error);
      }
      pending.current = null;
      setData(result.state);
      setMessage("Saved securely.");
      return result.result as Record<string, unknown>;
    } catch (e) {
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
  const points = data.results
    .filter((r) => r.user_id === data.user_id)
    .reduce((n, r) => n + r.championship_points, 0);
  const standings = data.members
    .map((m) => ({
      ...m,
      points: data.results
        .filter((r) => r.user_id === m.id)
        .reduce((n, r) => n + r.championship_points, 0),
    }))
    .sort((a, b) => b.points - a.points);
  const comp = data.competitions.find((c) => c.id === competition);
  const formation = (comp?.rules.positions ?? {
    GK: 1,
    DEF: 4,
    MID: 4,
    FWD: 2,
  }) as Record<string, number>;
  const filtered = data.cards
    .filter(
      (c) =>
        (!search ||
          `${c.name} ${c.team} ${c.serial} ${c.season}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
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
  const picked = selected
    .map((id) => data.cards.find((c) => c.id === id))
    .filter((c): c is FantasyCard => !!c);
  const toggle = (id: string, list: string[], setter: (v: string[]) => void) =>
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const title: Record<string, string> = {
    play: "Your next match starts here.",
    cards: "Build a collection that lasts.",
    market: "Find your next first-team player.",
    social: "The game is better together.",
    profile: "Your Docked record.",
    admin: "Preview control room.",
  };
  return (
    <div className="fantasy-screen" aria-busy={busy}>
      <header className="fantasy-heading">
        <div>
          <p className="eyebrow">FANTASY CARDS · PREVIEW V1</p>
          <h1>{title[tab]}</h1>
        </div>
        <Link className="credit-chip" href="/fantasy/profile">
          {Number(data.credits).toLocaleString()} <span>test credits</span>
        </Link>
      </header>
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
      {tab === "play" && (
        <>
          <div className="fantasy-welcome">
            <FantasyHero />
            <div>
              <p className="eyebrow">YOUR CLUB. YOUR CALL.</p>
              <h2>
                Collect talent.
                <br />
                Build your XI.
                <br />
                Compete every round.
              </h2>
              <p>
                36 fictional players. Five collectible tiers. Every tier scores
                the same fantasy points.
              </p>
              <Link className="button" href="/fantasy/cards">
                Explore my cards →
              </Link>
            </div>
          </div>
          <div className="fantasy-stats">
            <div>
              <strong>{data.cards.length}</strong>
              <span>Cards collected</span>
            </div>
            <div>
              <strong>{data.entries.length}</strong>
              <span>Competition entries</span>
            </div>
            <div>
              <strong>{points}</strong>
              <span>Championship points</span>
            </div>
          </div>
          <section className="fantasy-panel">
            <p className="eyebrow">BUILD · FOOTBALL</p>
            <h2>Your starting eleven</h2>
            <p>
              {Object.entries(formation)
                .map(([position, count]) => `${count} ${position}`)
                .join(" · ")}
              . No bench. Unavailable players may score zero.
            </p>
            <label>
              Competition
              <select
                aria-label="Competition"
                value={competition}
                onChange={(e) => {
                  setCompetition(e.target.value);
                  setSelected(
                    data.entries.find(
                      (x) => x.competition_id === e.target.value,
                    )?.cards ?? [],
                  );
                }}
              >
                {data.competitions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · Round {c.round}
                  </option>
                ))}
              </select>
            </label>
            {comp && (
              <>
                <p>
                  Lock:{" "}
                  <time dateTime={comp.locks_at}>{stamp(comp.locks_at)}</time> ·{" "}
                  {comp.scored_at
                    ? "Scored"
                    : new Date(comp.locks_at).getTime() <= Date.now()
                      ? "Locked"
                      : "Open for entries"}
                </p>
                <details>
                  <summary>Competition eligibility</summary>
                  <p>
                    {comp.rules.duplicates
                      ? "Multiple cards of the same player are allowed."
                      : "One card per player."}{" "}
                    Minimum CORE: {Number(comp.rules.core_min ?? 0)}. Minimum
                    First Year: {Number(comp.rules.first_year_min ?? 0)}.
                  </p>
                  {Object.entries(
                    (comp.rules.tier_max ?? {}) as Record<string, number>,
                  ).map(([tier, max]) => (
                    <p key={tier}>
                      {tier}: maximum {max}
                    </p>
                  ))}
                </details>
              </>
            )}
            <div className="formation-status">
              {["GK", "DEF", "MID", "FWD"].map((p) => (
                <span key={p}>
                  {p} {picked.filter((c) => c.position === p).length}/
                  {formation[p]}
                </span>
              ))}
              <strong>{selected.length}/11 selected</strong>
            </div>
            <div className="lineup-options">
              {data.cards
                .filter((c) => !["retired", "delisted"].includes(c.status))
                .map((c) => (
                  <label key={c.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(c.id)}
                      disabled={
                        busy ||
                        !!comp?.scored_at ||
                        (!!comp &&
                          new Date(comp.locks_at).getTime() <= Date.now())
                      }
                      onChange={() => toggle(c.id, selected, setSelected)}
                    />
                    <span>
                      <b>{c.name}</b>
                      <small>
                        {c.position} · {c.tier} · #{c.serial} · {c.status}
                        {c.listed ? " · Listed" : ""}
                      </small>
                    </span>
                  </label>
                ))}
            </div>
            {!data.cards.length && (
              <p>
                Claim and open your free Starter pack in Cards to field your
                first team.
              </p>
            )}
            <button
              className="button"
              disabled={
                busy ||
                selected.length !== 11 ||
                !comp ||
                !!comp.scored_at ||
                new Date(comp.locks_at).getTime() <= Date.now()
              }
              onClick={() =>
                act("save_lineup", {
                  competition_id: competition,
                  cards: selected,
                })
              }
            >
              Save team & enter
            </button>
            <p className="muted">
              The server checks ownership, formation and eligibility. Remove
              cards from open lineups before listing or trading them.
            </p>
          </section>
          <section className="fantasy-panel">
            <h2>Championship standings</h2>
            {standings.map((m, i) => (
              <div className="fantasy-row" key={m.id}>
                <span>
                  {i + 1}. {m.name}
                </span>
                <strong>{m.points} pts</strong>
              </div>
            ))}
            <p>Preview/Test Prize · No cash payout</p>
          </section>
          <section className="fantasy-panel">
            <h2>Recent results</h2>
            {data.results.length ? (
              data.results.map((r) => (
                <div
                  className="fantasy-row"
                  key={`${r.competition_id}${r.user_id}`}
                >
                  <span>
                    {name(r.user_id)} ·{" "}
                    {
                      data.competitions.find((c) => c.id === r.competition_id)
                        ?.name
                    }
                  </span>
                  <strong>
                    #{r.rank} · {r.score} FP · +{r.championship_points} pts
                  </strong>
                </div>
              ))
            ) : (
              <p>
                Results appear after the administrator simulates a locked round.
              </p>
            )}
          </section>
        </>
      )}
      {tab === "cards" && (
        <>
          <section className="fantasy-panel">
            <h2>My packs</h2>
            <p>
              Test credits only. Pack outcomes and serials are assigned by the
              server.
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
          </section>
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
          <section>
            <h2>
              My collection <span className="muted">{data.cards.length}</span>
            </h2>
            <div className="fantasy-filters">
              <label>
                Player, team, serial or season
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search your cards"
                />
              </label>
              <label>
                Tier
                <select value={tier} onChange={(e) => setTier(e.target.value)}>
                  <option value="">All tiers</option>
                  {tiers.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Position
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                >
                  <option value="">All positions</option>
                  {["GK", "DEF", "MID", "FWD"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Collection
                <select
                  value={subset}
                  onChange={(e) => setSubset(e.target.value)}
                >
                  {[
                    ["all", "All owned"],
                    ["first", "First Year"],
                    ["listed", "Listed"],
                    ["tradeable", "Tradeable"],
                    ["retired", "Retired"],
                  ].map(([v, l]) => (
                    <option value={v} key={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  {["newest", "rarity", "player", "serial", "season"].map(
                    (t) => (
                      <option key={t}>{t}</option>
                    ),
                  )}
                </select>
              </label>
            </div>
            <div className="card-grid">
              {filtered.map((c) => (
                <Card key={c.id} card={c}>
                  <button
                    onClick={() => setDetail(detail === c.id ? null : c.id)}
                    aria-expanded={detail === c.id}
                  >
                    Card details
                  </button>
                  {detail === c.id && (
                    <div className="card-details">
                      <p>
                        Permanent ID: <code>{c.id}</code>
                      </p>
                      <p>Owner: {name(c.owner_id)}</p>
                      <p>Acquired {stamp(c.acquired_at)}</p>
                      <p>
                        {c.listed ? "Listed" : "Unlisted"} ·{" "}
                        {data.entries.some((e) => e.cards.includes(c.id))
                          ? "In a lineup"
                          : "Not in a lineup"}
                      </p>
                      <h4>Provenance</h4>
                      {data.provenance
                        .filter((e) => e.card_id === c.id)
                        .map((e) => (
                          <p key={e.id}>
                            {e.reason} · {stamp(e.created_at)}
                            <br />
                            {e.from_user ? name(e.from_user) : "Issued"} →{" "}
                            {name(e.to_user)}
                          </p>
                        ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
            {!filtered.length && (
              <p className="fantasy-empty">
                No cards match these filters. Your free Starter pack is above.
              </p>
            )}
          </section>
        </>
      )}
      {tab === "market" && (
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
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                Tier
                <select value={tier} onChange={(e) => setTier(e.target.value)}>
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
      {tab === "social" && (
        <p className="fantasy-intro">
          Pack openings, marketplace activity and competition wins appear
          alongside your community. Existing privacy, moderation, likes and
          comments apply.
        </p>
      )}
      {tab === "profile" && (
        <>
          <section className="fantasy-panel">
            <p className="eyebrow">{name(data.user_id)}</p>
            <h2>Your collection. Your record.</h2>
            <div className="fantasy-stats">
              <div>
                <strong>{data.cards.length}</strong>
                <span>Cards</span>
              </div>
              <div>
                <strong>
                  {data.cards.filter((c) => c.kind === "first_year").length}
                </strong>
                <span>First Year</span>
              </div>
              <div>
                <strong>{points}</strong>
                <span>Championship points</span>
              </div>
            </div>
            <p>
              Competition wins:{" "}
              {
                data.results.filter(
                  (r) => r.user_id === data.user_id && r.rank === 1,
                ).length
              }{" "}
              · Completed trades:{" "}
              {data.trades.filter((t) => t.state === "accepted").length}
            </p>
            <p>
              {tiers
                .map(
                  (t) =>
                    `${t}: ${data.cards.filter((c) => c.tier === t).length}`,
                )
                .join(" · ")}
            </p>
            <div className="actions">
              <Link href="/profile">Social profile, followers & following</Link>
              <Link href="/dashboard">Settings & privacy</Link>
              {data.admin && <Link href="/fantasy/admin">Preview admin</Link>}
            </div>
          </section>
          <section className="fantasy-panel">
            <h2>Test wallet</h2>
            <strong className="wallet-balance">
              {Number(data.credits).toLocaleString()}
            </strong>
            <p>Available Credits</p>
            <button disabled>Withdraw</button>
            <small>Not available in Preview</small>
            <h3>Transaction history</h3>
            {data.ledger.map((l) => (
              <div className="fantasy-row" key={l.id}>
                <span>
                  {l.reason}
                  <small>{stamp(l.created_at)}</small>
                </span>
                <strong>
                  {Number(l.amount) > 0 ? "+" : ""}
                  {l.amount}
                </strong>
              </div>
            ))}
            {!data.ledger.length && <p>No test credit transactions yet.</p>}
          </section>
          <section className="fantasy-panel">
            <h2>Replacement eligibility</h2>
            {data.replacements.map((r) => (
              <p key={r.card_id}>
                {data.cards.find((c) => c.id === r.card_id)?.name ??
                  "Retired card"}{" "}
                ·{" "}
                {r.pack_id
                  ? "Replacement pack issued"
                  : "Eligible — awaiting admin issue"}
              </p>
            ))}
            <p>Retired cards stay in your collection permanently.</p>
          </section>
        </>
      )}
      {tab === "admin" &&
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
                          {c.name} · {stamp(c.locks_at)}
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
    </div>
  );
}
