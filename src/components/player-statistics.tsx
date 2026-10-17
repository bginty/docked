"use client";
import type {
  PlayerHistory,
  PlayerGameHistory,
} from "@/core/player-card-history";
import { formatBasePoints } from "@/core/card-score-display";

const labels: Record<string, string> = {
  receptions: "REC",
  receiving_yards: "REC YDS",
  receiving_touchdowns: "REC TD",
  rushing_yards: "RUSH YDS",
  rushing_touchdowns: "RUSH TD",
  rushing_attempts: "CARRIES",
  passing_yards: "PASS YDS",
  passing_touchdowns: "PASS TD",
  interceptions_thrown: "INT",
};
export function relevantStats(
  position: string,
  values: Record<string, number | null>,
) {
  const keys =
    position === "QB"
      ? ["passing_yards", "passing_touchdowns", "interceptions_thrown"]
      : position === "RB"
        ? ["rushing_yards", "rushing_touchdowns", "receptions"]
        : ["receptions", "receiving_yards", "receiving_touchdowns"];
  for (const k of ["rushing_yards", "rushing_touchdowns", "receiving_yards"])
    if (
      !keys.includes(k) &&
      values[k] !== null &&
      values[k] !== undefined &&
      values[k] !== 0
    )
      keys.push(k);
  return keys.map((k) => ({
    key: k,
    label: labels[k],
    value: values[k] ?? null,
  }));
}
export function HistorySummary({
  history,
  position,
}: {
  history: PlayerHistory;
  position: string;
}) {
  const latest = history.games?.[0];
  const score = latest ? latest.base : (history.rows[0]?.base ?? null);
  const total =
    history.feed?.seasonBase ??
    (history.rows.some((r) => r.base !== null)
      ? history.rows.reduce((n, r) => n + (r.base ?? 0), 0)
      : null);
  return (
    <>
      <div className="card-score-hero">
        <span>Fantasy Points</span>
        <strong>{formatBasePoints(score)}</strong>
        <small>
          {latest
            ? `Latest game · Week ${latest.week}`
            : "Latest published round"}
        </small>
      </div>
      <dl className="card-base-stats">
        <div>
          <dt>Season total</dt>
          <dd>{formatBasePoints(total)}</dd>
        </div>
        <div>
          <dt>Average</dt>
          <dd>{formatBasePoints(history.averageBase)}</dd>
        </div>
        <div>
          <dt>Games played</dt>
          <dd>{history.played}</dd>
        </div>
      </dl>
      {latest && (
        <dl className="card-relevant-stats">
          {relevantStats(position, latest.values)
            .slice(0, 5)
            .map((s) => (
              <div key={s.key}>
                <dt>{s.label}</dt>
                <dd>{s.value ?? "—"}</dd>
              </div>
            ))}
        </dl>
      )}
      <p className="card-score-note">
        {score === null
          ? "Awaiting verified statistics"
          : "Player performance · no rarity adjustment"}
      </p>
      <p className="card-score-note">
        {history.feed
          ? "Full-PPR history reference"
          : "Published competition rules"}
        {history.feed?.stale ? " · Update overdue" : ""}
      </p>
    </>
  );
}
function GameRow({
  game,
  position,
}: {
  game: PlayerGameHistory;
  position: string;
}) {
  return (
    <article className="player-game-row">
      <header>
        <div>
          <span>
            Week {game.week} ·{" "}
            {game.kickoff
              ? new Date(game.kickoff).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              : "Date unavailable"}
          </span>
          <h4>
            {game.opponent
              ? `${game.venue === "away" ? "@" : "vs"} ${game.opponent}`
              : "Opponent unavailable"}
          </h4>
        </div>
        <div className="player-game-points">
          <strong>{formatBasePoints(game.base)}</strong>
          <small>Fantasy points</small>
        </div>
      </header>
      <dl className="player-game-stats">
        {relevantStats(position, game.values).map((s) => (
          <div key={s.key}>
            <dt>{s.label}</dt>
            <dd>{s.value ?? "—"}</dd>
          </div>
        ))}
      </dl>
      <p className="small-note">
        Game: {game.gameStatus} · {game.scoringStatus}
        {game.incomplete ? " · Game coverage incomplete" : ""}
      </p>
      <details>
        <summary>Score breakdown & full statistics</summary>
        {game.missing.length > 0 && (
          <p>
            Unconfirmed required fields:{" "}
            {game.missing.map((k) => k.replaceAll("_", " ")).join(", ")}. No
            zeroes inferred.
          </p>
        )}
        {game.parts.length > 0 && (
          <dl className="player-score-breakdown">
            {game.parts
              .filter((s) => s.quantity !== 0)
              .map((s) => (
                <div key={s.statistic}>
                  <dt>
                    {s.statistic.replaceAll("_", " ")} × {s.quantity}
                  </dt>
                  <dd>{formatBasePoints(s.centipoints)}</dd>
                </div>
              ))}
          </dl>
        )}
        <dl className="player-raw-statistics">
          {Object.entries(game.values).map(([k, v]) => (
            <div key={k}>
              <dt>{k.replaceAll("_", " ")}</dt>
              <dd>{v ?? "Unconfirmed"}</dd>
            </div>
          ))}
        </dl>
        <p className="small-note">
          Revision {game.revision} · Source updated{" "}
          {new Date(game.updatedAt).toLocaleString()}. Dataset publication time;
          corrections replace previous values. Game ID: {game.id}.
        </p>
      </details>
    </article>
  );
}
export function PlayerStatistics({
  history,
  name,
  position,
  seasonChange,
}: {
  history: PlayerHistory;
  name: string;
  position: string;
  seasonChange: (season: string) => void;
}) {
  return (
    <section
      className="player-statistics"
      aria-label={`${name} player statistics`}
    >
      <h3>Player statistics</h3>
      <label>
        Season{" "}
        <select
          value={history.season ?? ""}
          onChange={(e) => seasonChange(e.target.value)}
        >
          {!history.seasons.length && <option value="">Unavailable</option>}
          {history.seasons.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>
      <p className="small-note">
        {history.feed
          ? "Full-PPR reference history. Member competitions retain their own frozen rules; these are not awarded lineup points."
          : "Base player points under the published competition rules."}{" "}
        No card rarity adjustment.
      </p>
      <p className="small-note">
        Rules:{" "}
        {history.scoringVersion ??
          history.feed?.version ??
          "See published competition"}
        . Totals include valid completed player-games only; missing appearances
        are not zero or DNP.
        {history.feed?.complete === false && " Observed history is partial."}
      </p>
      {history.feed?.stale && (
        <p role="status">
          Update overdue · showing retained completed statistics.
        </p>
      )}
      <h3>{history.season ?? "Season"} game log</h3>
      {history.games?.length ? (
        history.games.map((g) => (
          <GameRow key={g.id} game={g} position={position} />
        ))
      ) : history.rows.length ? (
        history.rows.map((r) => (
          <article className="player-game-row" key={r.week}>
            <h4>Week {r.week}</h4>
            <strong>{formatBasePoints(r.base)} fantasy points</strong>
            <p>{r.status}</p>
          </article>
        ))
      ) : (
        <p>No published player scores yet.</p>
      )}
      {history.feed && (
        <p className="small-note">
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
    </section>
  );
}
