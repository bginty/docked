import type { StandingRound } from "./standings";
import { isNflAlignedVersion, nflPostgameVersion } from "./nfl-postgame-policy";
export function competitionScoringLabel(
  round: Pick<StandingRound, "receptionCentipoints" | "rarityVersion">,
) {
  const reception =
    round.receptionCentipoints === 100
      ? "Full-PPR"
      : round.receptionCentipoints === 50
        ? "Half-PPR"
        : null;
  return reception
    ? `${reception} · ${round.rarityVersion ? "Locked card multipliers" : "Base points"}`
    : "Saved competition rules";
}
export function historyScoringLabel(version?: string) {
  return version === nflPostgameVersion || isNflAlignedVersion(version)
    ? "Base points · Full-PPR · No card multiplier"
    : "Base player points · No card multiplier";
}
