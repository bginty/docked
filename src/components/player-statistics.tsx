"use client";
import { useId, useState } from "react";
import type {
  PlayerHistory,
  PlayerGameHistory,
} from "@/core/player-card-history";
import { formatBasePoints } from "@/core/card-score-display";
import {
  compactColumns,
  historyGameRows,
  historyTotal,
  statCategories,
  gameScoreStatus,
  type StatCategory,
} from "@/core/player-statistics";

export function HistorySummary({ history }: { history: PlayerHistory }) {
  return (
    <dl className="statistics-summary">
      <div>
        <dt>Season FPTS</dt>
        <dd>{formatBasePoints(historyTotal(history))}</dd>
      </div>
      <div>
        <dt>Avg FPTS</dt>
        <dd>{formatBasePoints(history.averageBase)}</dd>
      </div>
      <div>
        <dt>Games played</dt>
        <dd>{history.played}</dd>
      </div>
    </dl>
  );
}
function CategoryTabs({
  categories,
  selected,
  onChange,
  panel,
}: {
  categories: StatCategory[];
  selected: string;
  onChange: (id: string) => void;
  panel: string;
}) {
  return (
    <div
      className="statistics-tabs"
      role="tablist"
      aria-label="Statistic category"
    >
      {categories.map((c, i) => (
        <button
          type="button"
          role="tab"
          key={c.id}
          id={`${panel}-${c.id}`}
          aria-selected={selected === c.id}
          aria-controls={panel}
          tabIndex={selected === c.id ? 0 : -1}
          onClick={() => onChange(c.id)}
          onKeyDown={(e) => {
            const next =
              e.key === "ArrowRight"
                ? (i + 1) % categories.length
                : e.key === "ArrowLeft"
                  ? (i + categories.length - 1) % categories.length
                  : e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? categories.length - 1
                      : -1;
            if (next < 0) return;
            e.preventDefault();
            onChange(categories[next].id);
            document.getElementById(`${panel}-${categories[next].id}`)?.focus();
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
function GameTable({
  history,
  category,
  compact,
  onGame,
}: {
  history: PlayerHistory;
  category: StatCategory;
  compact: boolean;
  onGame: (game: PlayerGameHistory) => void;
}) {
  const rows = historyGameRows(history),
    shown = compact ? rows.slice(0, 3) : rows;
  const columns = compact ? compactColumns(category) : category.columns;
  return (
    <div className="statistics-table-wrap">
      <table className="statistics-table">
        <caption className="sr-only">
          {category.label} game log. FPTS are base player points without rarity
          adjustment. A dash means unavailable, not zero.
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <abbr title="Week or round">WK</abbr>
            </th>
            <th scope="col">
              <abbr title="Opponent">OPP</abbr>
            </th>
            <th scope="col" className="statistics-fpts">
              <abbr title="Fantasy points">FPTS</abbr>
            </th>
            {columns.map((c) => (
              <th scope="col" key={c.key}>
                <abbr title={c.title}>{c.label}</abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((game) => (
            <tr key={game.id}>
              <th scope="row">
                {compact ? (
                  game.week
                ) : (
                  <button
                    type="button"
                    className="statistics-game-link"
                    onClick={() => onGame(game)}
                    aria-label={`View week ${game.week} game details`}
                  >
                    {game.week}
                  </button>
                )}
              </th>
              <td>
                <span
                  className="statistics-opponent"
                  title={
                    game.opponent
                      ? `${game.venue === "away" ? "Away at" : "Against"} ${game.opponent}`
                      : "Opponent unavailable"
                  }
                >
                  {game.venue === "away" ? "@" : ""}
                  {game.opponent ?? "—"}
                </span>
              </td>
              <td
                className="statistics-fpts"
                title={`${game.scoringStatus}${game.incomplete ? " · Coverage incomplete" : ""}`}
              >
                <strong>
                  {formatBasePoints(game.base)}
                  {compact &&
                    ["Calculated", "Provisional"].includes(
                      gameScoreStatus(game),
                    ) && <sup aria-label="Corrections possible">*</sup>}
                </strong>
                {!compact && (
                  <small>
                    {gameScoreStatus(game)}
                    {game.incomplete ? " · Partial" : ""}
                  </small>
                )}
              </td>
              {columns.map((c) => (
                <td key={c.key}>{game.values[c.key] ?? "—"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="statistics-empty">No published games yet.</p>
      )}
    </div>
  );
}
/** Shared card and full-sheet renderer. Scores are supplied by the server. */
export function PlayerStatistics({
  history,
  name,
  position,
  sport,
  compact = false,
  category: requested,
  categoryChange,
  seasonChange,
  onExpand,
}: {
  history: PlayerHistory;
  name: string;
  position: string;
  sport: string;
  compact?: boolean;
  category: string;
  categoryChange: (id: string) => void;
  seasonChange: (season: string) => void;
  onExpand?: () => void;
}) {
  const categories = statCategories(sport, position),
    category = categories.find((c) => c.id === requested) ?? categories[0];
  const panel = useId();
  const [gameId, setGameId] = useState<string | null>(null);
  const game = historyGameRows(history).find((g) => g.id === gameId);
  const partial = (history.feed?.complete ?? history.complete) === false;
  const coverageIncomplete = history.games?.some((g) => g.incomplete);
  const provisional = historyGameRows(history)
    .slice(0, 3)
    .some((g) => ["Calculated", "Provisional"].includes(gameScoreStatus(g)));
  return (
    <section
      className={`player-statistics ${compact ? "statistics-compact" : "statistics-expanded"}`}
      aria-label={`${name} player statistics`}
    >
      <div className="statistics-season">
        <span>
          {sport === "football" ? "EPL" : sport.toUpperCase()} · {position}
        </span>
        <label>
          <span className="sr-only">Season</span>
          <select
            aria-label="Season"
            value={history.season ?? ""}
            disabled={history.seasons.length < 2}
            onChange={(e) => {
              setGameId(null);
              seasonChange(e.target.value);
            }}
          >
            {!history.seasons.length && <option value="">No season</option>}
            {history.seasons.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <HistorySummary history={history} />
      <p className="statistics-context">
        {history.feed ? "Full-PPR reference" : "Published rules"} · Base points
        {partial ? " · Partial season" : ""}
        {!partial && coverageIncomplete ? " · Partial coverage" : ""}
      </p>
      {category ? (
        <>
          <CategoryTabs
            categories={categories}
            selected={category.id}
            onChange={categoryChange}
            panel={panel}
          />
          <div
            id={panel}
            role="tabpanel"
            aria-labelledby={`${panel}-${category.id}`}
          >
            <GameTable
              history={history}
              category={category}
              compact={compact}
              onGame={(g) => setGameId(g.id)}
            />
          </div>
        </>
      ) : (
        <p className="statistics-empty">
          Statistics for this sport are not available.
        </p>
      )}
      {compact ? (
        <>
          <p className="statistics-key">
            Latest 3 · {provisional ? "* May change · " : ""}— Unavailable
          </p>
          <button
            type="button"
            className="statistics-expand"
            onClick={onExpand}
          >
            View Full Game Log <span aria-hidden="true">↗</span>
          </button>
        </>
      ) : (
        <>
          <p className="statistics-key">
            — Unavailable, never a guessed zero. Select a week for game details.{" "}
            Swipe the table for additional columns on smaller screens.
          </p>
          {game && (
            <section
              className="statistics-game-detail"
              aria-label={`Week ${game.week} details`}
            >
              <div>
                <h3>
                  Week {game.week}
                  {game.opponent ? ` · ${game.opponent}` : ""}
                </h3>
                <button type="button" onClick={() => setGameId(null)}>
                  Close game details
                </button>
              </div>
              <p>
                {game.kickoff
                  ? new Date(game.kickoff).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Date unavailable"}{" "}
                · {game.gameStatus} · {game.scoringStatus}
              </p>
              <p>
                <strong>{formatBasePoints(game.base)} FPTS</strong>
                {game.incomplete ? " · Game coverage incomplete" : ""}
              </p>
              {game.missing.length > 0 && (
                <p>
                  Unconfirmed:{" "}
                  {game.missing.map((k) => k.replaceAll("_", " ")).join(", ")}.
                  No zeroes inferred.
                </p>
              )}
              {game.parts.length > 0 && (
                <dl className="statistics-breakdown">
                  {game.parts
                    .filter((p) => p.quantity !== 0)
                    .map((p) => (
                      <div key={p.statistic}>
                        <dt>
                          {p.statistic.replaceAll("_", " ")} × {p.quantity}
                        </dt>
                        <dd>{formatBasePoints(p.centipoints)} FPTS</dd>
                      </div>
                    ))}
                </dl>
              )}
              <p>
                Revision {game.revision}
                {game.updatedAt
                  ? ` · Updated ${new Date(game.updatedAt).toLocaleString()}`
                  : ""}
              </p>
            </section>
          )}
          <footer className="statistics-disclosure">
            <p>
              {history.feed
                ? "Full-PPR player history is a reference. Competition results, standings and lineup awards retain their frozen rules and any explicitly approved card multiplier."
                : "Player points use the published competition scoring engine. Saved competition results are unchanged."}{" "}
              No rarity adjustment is applied here.
            </p>
            <p>
              Rules:{" "}
              {history.scoringVersion ??
                history.feed?.version ??
                "Not available"}
              . Totals and averages cover scored appearances only; missing
              appearances are not DNP.
            </p>
            {["epl", "football"].includes(sport.toLowerCase()) && (
              <p>
                Pass counts are not supplied by the approved feed. Only
                supported EPL statistics are shown.
              </p>
            )}
            {history.feed?.stale && (
              <p role="status">Update overdue · retained statistics shown.</p>
            )}
            {history.feed && (
              <p>
                Last import:{" "}
                {history.feed.lastSuccess
                  ? new Date(history.feed.lastSuccess).toLocaleString()
                  : "Unavailable"}
                . Statistics:{" "}
                <a
                  href="https://github.com/nflverse/nflverse-data"
                  target="_blank"
                  rel="noreferrer"
                >
                  nflverse
                </a>
                ,{" "}
                <a
                  href="https://creativecommons.org/licenses/by/4.0/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CC BY 4.0
                </a>
                . Fantasy points calculated by Docked.
              </p>
            )}
          </footer>
        </>
      )}
    </section>
  );
}
