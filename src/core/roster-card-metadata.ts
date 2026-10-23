import numbers from "../../config/roster-jersey-presentation-v1.json";
import { teamColours } from "./sport-team-colours";
/** Read projection only. Never changes collectible identity or historical team. */
export function rosterCardMetadata(
  playerId: string,
  sport: string,
  team: string,
) {
  const record = (
    numbers as Record<string, { sport: string; team: string; number: string }>
  )[playerId];
  if (
    !record ||
    record.sport !== sport ||
    teamColours(sport, team)?.id !== teamColours(sport, record.team)?.id ||
    !teamColours(sport, team)
  )
    return {};
  return {
    verifiedJerseyNumber: Number(record.number),
    jerseyNumberText: record.number,
  };
}
