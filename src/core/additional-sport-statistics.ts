import { z } from "zod";
const count = z.number().int().min(0).max(10000);
/** Normalised event contracts, not provider-specific keys or scoring weights. */
export const nrlStats = z
  .object({
    tries: count,
    tryAssists: count,
    runMetres: count,
    lineBreaks: count,
    tackleBreaks: count,
    tackles: count,
    missedTackles: count,
    offloads: count,
    errors: count,
    goals: count,
  })
  .strict();
export const nbaStats = z
  .object({
    points: count,
    rebounds: count,
    assists: count,
    steals: count,
    blocks: count,
    turnovers: count,
    threePointers: count,
  })
  .strict();

// Versioned separately: never reinterpret historical generic `offloads` or
// per-metre coefficients as the new published event model.
export const nrlEventVersion = "docked-nrl-events-v1";
export const nbaEventVersion = "docked-nba-events-v1";
export const nrlEventStats = z
  .object({
    tries: count,
    goals: count,
    fieldGoals: count,
    tryAssists: count,
    lineBreaks: count,
    lineBreakAssists: count,
    tackles: count,
    tackleBreaks: count,
    missedTackles: count,
    offloadsToHand: count,
    offloadsToGround: count,
    errors: count,
    fortyTwenties: count,
    twentyForties: count,
    runMetres: count,
    kickMetres: count,
    penaltiesConceded: count,
    sixAgainInfringements: count,
    sinBins: count,
    sendOffs: count,
    trySaves: count,
    kicksDefused: count,
    forcedDropouts: count,
    turnovers: count,
    escapesInGoal: count,
  })
  .strict();
export function nrlStatisticsForVersion(version?: string) {
  return version === nrlEventVersion ? nrlEventStats : nrlStats;
}
