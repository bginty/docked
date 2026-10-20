import type { StandingPlayer } from "@/core/standings";
import { gameDayPlayerStatus, gameDayPoints } from "@/core/game-day";
export function GameDayPlayerScore({
  player,
  now,
}: {
  player: StandingPlayer;
  now: number;
}) {
  return (
    <span className="game-day-player-score">
      <strong>
        {gameDayPoints(player.centipoints)} <small>PTS</small>
      </strong>
      {player.baseCentipoints != null && player.multiplier != null && (
        <span
          className="game-day-score-basis"
          title={
            player.scoreUpdatedAt
              ? `Statistics updated ${player.scoreUpdatedAt}`
              : undefined
          }
        >
          Base {gameDayPoints(player.baseCentipoints)} ×{" "}
          {player.multiplier.toFixed(1)}
        </span>
      )}
      <span>{gameDayPlayerStatus(player, now)}</span>
    </span>
  );
}
