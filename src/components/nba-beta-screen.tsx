"use client";
import { useEffect, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import type { SandboxState } from "@/core/sport-sandbox";
import { SportSandbox } from "./sport-sandbox";
import { CollectibleFace } from "./collectible-face";
import { fitsSlot } from "@/core/nfl-seven";
import { sportConfigurations } from "@/core/sport-configuration";
import type { BetaSport } from "@/core/sports-private-beta";
import { MarketListingDialog } from "./market-listing-dialog";
import type { ViewerCard } from "./collectible-viewer";
export function NbaBetaScreen({
  cards = false,
  sport = "basketball",
}: {
  cards?: boolean;
  sport?: BetaSport;
}) {
  const config = sportConfigurations[sport],
    label = config.label;
  const apiPath =
    sport === "basketball"
      ? "/api/nba-beta"
      : `/api/sports-beta?sport=${sport}`;
  const [state, setState] = useState<SandboxState | null>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  const [selling, setSelling] = useState<ViewerCard | null>(null);
  const [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    setError(false);
    setState(null);
    void boundedFetch(
      `${apiPath}${apiPath.includes("?") ? "&" : "?"}view=state`,
      { cache: "no-store" },
    )
      .then(async (r) => {
        if (!r.ok) throw Error("Unavailable");
        const data = await r.json();
        if (!disposed) setState(data.state);
      })
      .catch(() => {
        if (!disposed) setError(true);
      });
    return () => {
      disposed = true;
    };
  }, [attempt, apiPath]);
  if (error)
    return (
      <section className="fantasy-panel">
        <h1>{label} private beta</h1>
        <p role="alert">
          {label} testing is unavailable. Check your beta access and required
          account verification, then retry.
        </p>
        <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
      </section>
    );
  if (!state) return <p role="status">Loading {label} testing…</p>;
  if (!cards)
    return <SportSandbox initial={state} privateBeta apiPath={apiPath} />;
  const visible = state.cards.filter(
    (card) =>
      (!position || fitsSlot(card, [position])) &&
      `${card.name} ${card.team ?? ""}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <section>
      <h1>{label} test cards</h1>
      <p className="sport-sandbox-notice">
        Fictional testing fixtures only. Free lineup cards stay in this test
        collection. Cards opened from test packs can be traded when the test
        economy is enabled.
      </p>
      <nav className="fantasy-actions" aria-label={`${label} collection links`}>
        <a className="button" href={`/fantasy/packs?sport=${sport}`}>
          Buy packs
        </a>
        <a className="button" href={`/fantasy/packs?sport=${sport}&tab=mine`}>
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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Player or city"
          />
        </label>
        <label>
          Position
          <select
            aria-label="Position"
            value={position}
            onChange={(event) => setPosition(event.target.value)}
          >
            <option value="">All positions</option>
            {[...new Set(config.slots.flatMap((s) => s.positions))].map((p) => (
              <option key={p} value={p}>
                {p}
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
            }}
          >
            Clear filters
          </button>
        </p>
      )}
      <div
        className="sport-review-grid"
        role="list"
        aria-label={`${label} test collection`}
      >
        {visible.map((c) => (
          <div key={c.id} role="listitem">
            <CollectibleFace card={c} appliedMultiplier={1} variant="compact" />
            <p>
              {c.name} · {c.position}
            </p>
            {c.inventory_source === "credits-fixture-v1" &&
              (c.listed ? (
                <a href={`/fantasy/market?sport=${sport}&tab=listings`}>
                  Manage listing
                </a>
              ) : (
                <button
                  onClick={() =>
                    setSelling({
                      id: c.id,
                      edition_id: `fixture:${c.player_id}:${c.tier}`,
                      player_id: c.player_id,
                      name: c.name,
                      position: c.position,
                      tier: c.tier,
                      season: "SYNTHETIC TEST",
                      kind: "regular",
                      max_supply: c.max_supply ?? 0,
                      serial: c.serial ?? 0,
                      team: c.team ?? "Fictional testing",
                      colour: c.colour ?? "#1759a3",
                      shirt: 0,
                      status: c.status,
                      sport,
                      tradeable: true,
                      multiplier: 1,
                      verifiedJerseyNumber: null,
                    })
                  }
                >
                  Sell test card
                </button>
              ))}
          </div>
        ))}
      </div>
      <a className="button" href={`/fantasy/play?sport=${sport}`}>
        Build {label} team
      </a>
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
