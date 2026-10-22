import { nflSeven } from "./nfl-seven";
import { nbaWeeklyLineup } from "./nba-weekly";
import {
  aflConfiguration,
  type SportConfiguration,
} from "./sport-configuration";

/** Artificial units already used by isolated acceptance. These are not commercial salaries. */
export function sandboxLineupConfiguration(
  sport: SportConfiguration = aflConfiguration,
) {
  if (sport.formatVersion === "docked-nba-weekly-lineup-proposal-v1")
    return nbaWeeklyLineup();
  return {
    ...nflSeven,
    version: `${sport.formatVersion}-qa`,
    sport: sport.id,
    inventoryScope: "isolated-multi-sport-v1",
    slots: sport.slots,
    salaryCap: sport.slots.length * 120,
    salaries: {
      CORE: 100,
      RARE: 110,
      ELITE: 120,
      ULTRA_RARE: 130,
      LEGENDARY: 140,
      ICON: 150,
    },
    lockPolicy: "round-wide-v1",
    commerciallyApproved: false,
  };
}
