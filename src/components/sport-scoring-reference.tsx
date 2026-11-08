"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSport } from "./sport-context";
import { boundedFetch } from "@/core/bounded-request";
import { isCustomerSport, type CustomerSport } from "@/core/customer-sports";
import { scoringRows } from "@/core/scoring-release";
import { rarities, rarityRule } from "@/core/card-rarity";
import { formatBasePoints } from "@/core/card-score-display";
import { points } from "@/core/scoring-v1";
import {
  sportReferenceRules,
  type SportScoringHistory as SportScoringHistoryData,
} from "@/core/sport-scoring-history";

export function SportScoringReference() {
  const { sport, ready } = useSport();
  const selected = isCustomerSport(sport) ? sport : "nfl";
  return (
    <section className="sport-scoring-reference">
      {ready ? (
        <SportScoringHistory key={selected} sport={selected} />
      ) : (
        <p role="status">Loading scoring…</p>
      )}
    </section>
  );
}

export function SportScoringHistory({ sport }: { sport: CustomerSport }) {
  const [data, setData] = useState<SportScoringHistoryData | null>(null);
  const [filters, setFilters] = useState({
    season: "",
    round: "",
    search: "",
    page: 0,
  });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      sport,
      search: filters.search,
      page: String(filters.page),
    });
    if (filters.season) params.set("season", filters.season);
    if (filters.round) params.set("round", filters.round);
    void boundedFetch(`/api/fantasy/scoring-history?${params}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok)
          throw Error("Player statistics could not be loaded. Please retry.");
        const next = (await response.json()) as SportScoringHistoryData;
        if (next.sport !== sport) throw Error("Sport changed. Please retry.");
        if (!controller.signal.aborted) setData(next);
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(reason.message);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [sport, filters, attempt]);
  const reset = (next: Partial<typeof filters>) =>
    setFilters((old) => ({ ...old, ...next, page: 0 }));
  const rules = data?.rules ?? sportReferenceRules(sport);
  return (
    <>
      <header className="sport-scoring-header">
        <div>
          <h1>{sport.toUpperCase()} Scoring</h1>
          <p>{sport === "nfl" ? "Full PPR" : "Event scoring"}</p>
        </div>
        <Link
          className="button button-secondary"
          href={`/fantasy/play?sport=${sport}`}
        >
          Back to Play
        </Link>
      </header>
      <p className="form-help">
        Player statistics are base points. Your card’s rarity multiplier is
        applied once in the competition.
      </p>
      {
        <section className="sport-scoring-panel">
          <h2>Scoring breakdown</h2>
          <table className="rules-rarity-table">
            <thead>
              <tr>
                <th scope="col">Statistic</th>
                <th scope="col">Base points</th>
              </tr>
            </thead>
            <tbody>
              {scoringRows(rules).map((row) => (
                <tr key={row.action}>
                  <td>{row.action}</td>
                  <td>{row.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <details>
            <summary>Rarity and historical rules</summary>
            <table className="rules-rarity-table">
              <thead>
                <tr>
                  <th scope="col">Rarity</th>
                  <th scope="col">Multiplier</th>
                </tr>
              </thead>
              <tbody>
                {rarities.map((rarity) => (
                  <tr key={rarity}>
                    <td>{rarityRule(rarity).label}</td>
                    <td>
                      {(rarityRule(rarity).multiplierTenths / 10).toFixed(1)}×
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Calculate base player points, apply the locked card multiplier
              once, then round each contribution to two decimal places. A
              Legendary card with 20.90 base points contributes 29.26 points.
            </p>
            <p>
              Historical competitions retain their saved scoring version and
              multipliers. Open Rules from the relevant lineup to inspect that
              competition’s original rules.
            </p>
            <small>Reference version: {rules.version}</small>
          </details>
        </section>
      }
      <section className="sport-scoring-panel" aria-busy={loading}>
        <h2>Player statistics by round</h2>
        <p className="form-help">
          Imported player game logs are independent of Docked competition entry
          and publication.
        </p>
        <p className="form-help">
          Base points use the displayed sport reference version. Historical
          fantasy-entry scores keep their saved competition rules.
        </p>
        {error && (
          <p role="alert">
            {error}{" "}
            <button type="button" onClick={() => setAttempt((x) => x + 1)}>
              Retry
            </button>
          </p>
        )}
        {loading && <p role="status">Loading player statistics…</p>}
        {data?.unavailable && <p>{data.unavailable}</p>}
        {data && sport !== "nfl" && (
          <Link href={`/fantasy/history?sport=${sport}`}>
            View match results
          </Link>
        )}
        {data && data.rounds.length > 0 && (
          <>
            <div className="sport-scoring-filters">
              {[...new Set(data.rounds.map((r) => r.season))].length > 1 && (
                <label>
                  Archive season
                  <select
                    value={filters.season || data.season || ""}
                    disabled={loading}
                    onChange={(e) =>
                      reset({ season: e.target.value, round: "" })
                    }
                  >
                    {[...new Set(data.rounds.map((r) => r.season))].map(
                      (season) => (
                        <option key={season}>{season}</option>
                      ),
                    )}
                  </select>
                </label>
              )}
              <label>
                Round
                <select
                  value={filters.round || data.round || ""}
                  disabled={loading}
                  onChange={(e) => reset({ round: e.target.value })}
                >
                  {data.rounds
                    .filter((r) => r.season === (filters.season || data.season))
                    .map((r) => (
                      <option value={r.round} key={r.round}>
                        Round {r.round}
                      </option>
                    ))}
                </select>
              </label>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  reset({ search });
                }}
              >
                <label>
                  Player
                  <input
                    type="search"
                    maxLength={80}
                    placeholder="Find a player"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <button type="submit" disabled={loading}>
                  Search
                </button>
              </form>
            </div>
            <p className="form-help">
              Round {data.round} · {data.total} player results · Base points
              only. Post-game statistics can be corrected.
            </p>
            {!loading && !error && data.rows.length === 0 && (
              <p>No matching player results.</p>
            )}
            <div className="sport-scoring-players">
              {data.rows.map((row) => (
                <article
                  key={`${row.player}:${row.game.id}`}
                  className="sport-scoring-player"
                >
                  <header>
                    <div>
                      <h3>{row.name}</h3>
                      <p>
                        {row.position}
                        {row.game.opponent
                          ? ` · ${row.game.venue === "away" ? "at" : "vs"} ${row.game.opponent}`
                          : ""}
                      </p>
                    </div>
                    <strong>
                      {formatBasePoints(row.game.base)}
                      <small>BASE PTS</small>
                    </strong>
                  </header>
                  <p className="form-help">
                    {row.game.scoringStatus}
                    {row.game.incomplete ? " · Partial game coverage" : ""}
                  </p>
                  <details>
                    <summary>Scoring details</summary>
                    {row.game.parts.some((part) => part.quantity !== 0) ? (
                      <dl>
                        {row.game.parts
                          .filter((part) => part.quantity !== 0)
                          .map((part) => (
                            <div key={part.statistic}>
                              <dt>
                                {part.statistic.replaceAll("_", " ")} ×{" "}
                                {part.quantity}
                              </dt>
                              <dd>{points(part.centipoints)}</dd>
                            </div>
                          ))}
                      </dl>
                    ) : (
                      <p>
                        {row.game.base === 0
                          ? "Confirmed zero contribution."
                          : "Statistics awaiting reconciliation; missing data is not zero."}
                      </p>
                    )}
                    <small>
                      Revision {row.game.revision} · {row.scoringVersion}
                    </small>
                    {row.game.updatedAt && (
                      <p className="form-help">
                        Updated{" "}
                        {new Date(row.game.updatedAt).toLocaleString("en-AU")}
                      </p>
                    )}
                  </details>
                </article>
              ))}
            </div>
            {(data.page > 0 || data.hasMore) && (
              <nav
                className="sport-scoring-pagination"
                aria-label="Player results pages"
              >
                <button
                  disabled={loading || data.page === 0}
                  onClick={() =>
                    setFilters((old) => ({
                      ...old,
                      page: Math.max(0, old.page - 1),
                    }))
                  }
                >
                  Previous
                </button>
                <span>Page {data.page + 1}</span>
                <button
                  disabled={loading || !data.hasMore}
                  onClick={() =>
                    setFilters((old) => ({ ...old, page: old.page + 1 }))
                  }
                >
                  Next
                </button>
              </nav>
            )}
            {data.lastSuccess && (
              <p className="form-help">
                Last published{" "}
                {new Date(data.lastSuccess).toLocaleString("en-AU")}. Historical
                statistics remain available between updates; this does not
                finalise a fantasy round.
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}
