"use client";
import { useEffect, useState } from "react";
import { boundedFetch } from "@/core/bounded-request";
import type { SandboxState } from "@/core/sport-sandbox";
import { SportSandbox } from "./sport-sandbox";
import { CollectibleFace } from "./collectible-face";
import { fitsSlot } from "@/core/nfl-seven";
export function NbaBetaScreen({ cards = false }: { cards?: boolean }) {
  const [state, setState] = useState<SandboxState | null>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState("");
  const [error, setError] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    setError(false);
    void boundedFetch("/api/nba-beta?view=state", { cache: "no-store" })
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
  }, [attempt]);
  if (error)
    return (
      <section className="fantasy-panel">
        <h1>NBA private beta</h1>
        <p role="alert">
          NBA testing is unavailable. Check your beta access and required
          account verification, then retry.
        </p>
        <button onClick={() => setAttempt((n) => n + 1)}>Retry</button>
      </section>
    );
  if (!state) return <p role="status">Loading NBA testing…</p>;
  if (!cards)
    return <SportSandbox initial={state} privateBeta apiPath="/api/nba-beta" />;
  const visible = state.cards.filter(
    (card) =>
      (!position || fitsSlot(card, [position])) &&
      `${card.name} ${card.team ?? ""}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <section>
      <h1>NBA test cards</h1>
      <p className="sport-sandbox-notice">
        Fictional testing fixtures only. These are not permanent collectibles
        and cannot be sold, transferred or purchased.
      </p>
      <div className="nba-collection-filters">
        <label>
          Search your NBA cards
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
            {["PG", "SG", "SF", "PF", "C"].map((p) => (
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
        aria-label="NBA test collection"
      >
        {visible.map((c) => (
          <div key={c.id} role="listitem">
            <CollectibleFace card={c} appliedMultiplier={1} variant="compact" />
            <p>
              {c.name} · {c.position}
            </p>
          </div>
        ))}
      </div>
      <a className="button" href="/fantasy/play?sport=basketball">
        Build NBA team
      </a>
    </section>
  );
}
