import type { StandingRound, StandingRow } from "@/core/standings";
import {
  currentPoints,
  currentRank,
  gameDayPoints,
  gameDayStatus,
} from "@/core/game-day";
import { LocalDateTime } from "./local-date-time";

export function GameDaySummary({
  round,
  entry,
  title,
}: {
  round: StandingRound;
  entry?: StandingRow | null;
  title?: string;
}) {
  return (
    <section className="game-day-summary" aria-label="Game day summary">
      <div className="game-day-title">
        <h2>{title ?? `Week ${round.week} — Game Day`}</h2>
        <span>{gameDayStatus(round)}</span>
      </div>
      <div className="game-day-numbers">
        <div>
          <span>Team score</span>
          <strong>
            {gameDayPoints(currentPoints(entry))} <small>PTS</small>
          </strong>
        </div>
        <div>
          <span>Players completed</span>
          <strong>
            {entry?.completedPlayers ?? "—"}
            <small>
              /{entry?.totalPlayers ?? entry?.lineup?.length ?? "—"} played
            </small>
          </strong>
        </div>
        <div>
          <span>{round.finalised ? "Final rank" : "Current rank"}</span>
          <strong>
            {currentRank(entry) == null ? "—" : `#${currentRank(entry)}`}
            <small> of {round.rows.length}</small>
          </strong>
        </div>
      </div>
      <p className="game-day-freshness">
        {round.finalised
          ? "Final results"
          : round.feedMode === "live"
            ? "Live source"
            : "Postgame scoring"}
        {!round.finalised && currentPoints(entry) !== null && " · Provisional"}
        {round.dataDelayed && !round.finalised && " · Awaiting source data"}
        {round.updatedAt && (
          <>
            {" "}
            · Updated <LocalDateTime value={round.updatedAt} />
          </>
        )}
      </p>
    </section>
  );
}
