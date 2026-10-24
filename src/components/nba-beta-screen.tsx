"use client";
import { australianSalaryLabel } from "@/core/approved-australian-rules";
import { useEffect, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import type { SandboxState } from "@/core/sport-sandbox";
import { SportSandbox } from "./sport-sandbox";
import { FantasyCardArtwork } from "./fantasy-card-artwork";
import { sandboxCardView } from "@/core/sandbox-card-view";
import { fitsSlot } from "@/core/nfl-seven";
import { sportConfigurations } from "@/core/sport-configuration";
import type { BetaSport } from "@/core/sports-private-beta";
import { MarketListingDialog } from "./market-listing-dialog";
import { CollectibleViewer, type ViewerCard } from "./collectible-viewer";
import { rarityRule, rarities } from "@/core/card-rarity";
import { packShopHref } from "@/core/pack-presentation";
import { CompetitionResults } from "./competition-results";
import { PrizesPage } from "./prizes-page";
import { sportStandingRounds } from "@/core/sport-standings";
import type { PrizeSchedule } from "@/core/prize-schedules";
export function NbaBetaScreen({
  cards = false,
  sport = "basketball",
  surface = "play",
}: {
  cards?: boolean;
  sport?: BetaSport;
  surface?: "play" | "results" | "prizes";
}) {
  const config = sportConfigurations[sport],
    label = config.label;
  const apiPath =
    sport === "basketball"
      ? "/api/nba-beta"
      : `/api/sports-beta?sport=${sport}`;
  const [state, setState] = useState<SandboxState | null>(null);
  const [prizes, setPrizes] = useState<PrizeSchedule[]>([]);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  const [rarity, setRarity] = useState("");
  const [legacy, setLegacy] = useState(false);
  const [limit, setLimit] = useState(36);
  const [inspecting, setInspecting] = useState<ViewerCard | null>(null);
  const [selling, setSelling] = useState<ViewerCard | null>(null);
  const [error, setError] = useState<string | null>(null),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    let failureMessage = "Your lineup could not load. Please retry shortly.";
    const controller = new AbortController();
    setError(null);
    setState(null);
    void boundedFetch(
      `${apiPath}${apiPath.includes("?") ? "&" : "?"}view=${surface === "prizes" ? "prizes" : "state"}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (r) => {
        if (!r.ok) {
          failureMessage =
            r.status === 401
              ? "Please sign in again to load your lineup."
              : r.status === 403
                ? "Check your beta access and required account verification, then retry."
                : failureMessage;
          throw Error("Sport request failed");
        }
        const data = await r.json();
        if (data.state?.sport !== sport) throw Error("Sport response mismatch");
        if (!disposed) {
          setState(data.state);
          setPrizes(data.prizes ?? []);
        }
      })
      .catch(() => {
        if (!disposed) setError(failureMessage);
      });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [attempt, apiPath, surface]);
  if (error)
    return (
      <section className="fantasy-panel">
        <h1>{label} lineup</h1>
        <p role="alert">{error}</p>
        <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
      </section>
    );
  if (!state || state.sport !== sport)
    return <p role="status">Loading {label} testing…</p>;
  if (surface === "results")
    return (
      <CompetitionResults
        key={`${sport}:results`}
        sport={sport}
        seasonAggregationEnabled={false}
        rounds={[]}
        standings={[]}
        records={[]}
        weekly={sportStandingRounds(state)}
      />
    );
  if (surface === "prizes")
    return (
      <PrizesPage
        competitions={state.competitions.map((c) => ({
          id: c.id,
          name: c.name,
          sport: c.sport,
          mode: c.rules.mode,
          season: c.season,
          week: c.round,
          salaryLabel: australianSalaryLabel(
            state.configurations[c.rules.lineup_version],
          ),
        }))}
        schedules={prizes}
      />
    );
  if (!cards)
    return <SportSandbox initial={state} privateBeta apiPath={apiPath} />;
  const realRoster = state.cards.some(
    (c) => c.inventory_class === "real-roster-beta-v1",
  );
  const visible = state.cards.filter(
    (card) =>
      (!realRoster ||
        legacy ||
        card.inventory_class === "real-roster-beta-v1") &&
      (!rarity || card.tier === rarity) &&
      (!position || fitsSlot(card, [position])) &&
      `${card.name} ${card.team ?? ""}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <section className="sport-card-collection">
      <h1>{label} cards</h1>
      <details className="collection-beta-disclosure">
        <summary>Private beta · Test inventory</summary>
        <p>
          {realRoster
            ? "Real-player roster cards. Core cards are free; pack cards use test credits. Inventory is not permanent."
            : "Fictional testing cards."}{" "}
          <a href="/roster-sources">Sources and verification</a>
        </p>
        {realRoster && (
          <label>
            <input
              type="checkbox"
              checked={legacy}
              onChange={(e) => {
                setLegacy(e.target.checked);
                setLimit(36);
              }}
            />{" "}
            Include earlier fictional test cards
          </label>
        )}
      </details>
      <nav
        className="fantasy-actions collection-actions"
        aria-label={`${label} collection links`}
      >
        <a className="button" href={packShopHref(sport)}>
          Buy packs
        </a>
        <a className="button" href={packShopHref(sport, "mine")}>
          My packs
        </a>
        <a className="button" href={`/fantasy/market?sport=${sport}`}>
          Browse market
        </a>
      </nav>
      <div className="nba-collection-filters">
        <label>
          Search your {label} cards
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(36);
            }}
            placeholder="Player or city"
          />
        </label>
        <label>
          Position
          <select
            aria-label="Position"
            value={position}
            onChange={(event) => {
              setPosition(event.target.value);
              setLimit(36);
            }}
          >
            <option value="">All positions</option>
            {[...new Set(config.slots.flatMap((s) => s.positions))].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rarity
          <select
            value={rarity}
            onChange={(e) => {
              setRarity(e.target.value);
              setLimit(36);
            }}
          >
            <option value="">All rarities</option>
            {rarities.map((r) => (
              <option key={r} value={r}>
                {rarityRule(r).label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status">
        {visible.length} of {state.cards.length} cards
      </p>
      {!visible.length && (
        <p>
          No cards match these filters.{" "}
          <button
            onClick={() => {
              setQuery("");
              setPosition("");
              setRarity("");
            }}
          >
            Clear filters
          </button>
        </p>
      )}
      <div
        className="sport-review-grid roster-beta-collection"
        role="list"
        aria-label={`${label} test collection`}
      >
        {visible.slice(0, limit).map((c) => (
          <div key={c.id} role="listitem">
            <FantasyCardArtwork
              card={sandboxCardView(c)}
              faceOnly
              variant="compact"
              onInspect={() => setInspecting(sandboxCardView(c))}
            />
            <p>
              {c.name} · {c.position}
            </p>
            {c.roster_source && (
              <a
                href={c.roster_source.profileSource}
                target="_blank"
                rel="noreferrer"
              >
                Player source
              </a>
            )}
            {c.inventory_source === "credits-fixture-v1" &&
              (c.listed ? (
                <a href={`/fantasy/market?sport=${sport}&tab=listings`}>
                  Manage listing
                </a>
              ) : (
                <button onClick={() => setSelling(sandboxCardView(c))}>
                  Sell test card
                </button>
              ))}
          </div>
        ))}
      </div>
      {visible.length > limit && (
        <button onClick={() => setLimit((n) => n + 36)}>
          Show more cards ({visible.length - limit} remaining)
        </button>
      )}
      <a className="button" href={`/fantasy/play?sport=${sport}`}>
        Build {label} team
      </a>
      {inspecting && (
        <CollectibleViewer
          card={inspecting}
          onClose={() => setInspecting(null)}
        />
      )}
      {selling && (
        <MarketListingDialog
          card={selling}
          onClose={() => setSelling(null)}
          onSaved={() => {
            setSelling(null);
            setAttempt((n) => n + 1);
          }}
        />
      )}
    </section>
  );
}
