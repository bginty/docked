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
      <span>{gameDayPlayerStatus(player, now)}</span>
    </span>
  );
}
