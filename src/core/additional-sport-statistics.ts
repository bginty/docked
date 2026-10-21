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
