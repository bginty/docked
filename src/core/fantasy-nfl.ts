import { z } from "zod";

// Preparation only: no API route, database command or live feed enables NFL.
// Explicit versioned coefficients are required; no Docked scoring policy is assumed.
export const nflOffensivePosition = z.enum(["QB", "RB", "WR", "TE"]);
const count = z.number().int().min(0).max(100);
const yards = z.number().int().min(-1000).max(3000);
export const nflOffensiveStats = z
  .object({
    passing_yards: yards,
    passing_touchdowns: count,
    interceptions_thrown: count,
    rushing_yards: yards,
    rushing_touchdowns: count,
    receptions: count,
    receiving_yards: yards,
    receiving_touchdowns: count,
    fumbles_lost: count,
    passing_two_point_conversions: count,
    rushing_two_point_conversions: count,
    receiving_two_point_conversions: count,
    kickoff_return_touchdowns: count,
    punt_return_touchdowns: count,
  })
  .strict();
export type NflOffensiveStats = z.infer<typeof nflOffensiveStats>;
const statisticNames = Object.keys(
  nflOffensiveStats.shape,
) as (keyof NflOffensiveStats)[];
const coefficients = Object.fromEntries(
  statisticNames.map((name) => [name, z.number().int().min(-10000).max(10000)]),
) as Record<keyof NflOffensiveStats, z.ZodNumber>;
export const nflOffensiveScoringRules = z
  .object({
    sport: z.literal("nfl"),
    version: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,79}$/),
    centipoints_per_unit: z.object(coefficients).strict(),
  })
  .strict();

/** Pure calculation only. Provider approval, player/game identity and immutable
 * rule/result persistence must be enforced by the future server integration. */
export function scoreNflOffense(input: unknown, configuration: unknown) {
  const stats = nflOffensiveStats.parse(input);
  const rules = nflOffensiveScoringRules.parse(configuration);
  const breakdown = statisticNames.map((statistic) => ({
    statistic,
    quantity: stats[statistic],
    centipoints: stats[statistic] * rules.centipoints_per_unit[statistic],
  }));
  const centipoints = breakdown.reduce(
    (sum, part) => sum + part.centipoints,
    0,
  );
  if (!Number.isSafeInteger(centipoints)) throw Error("Unsafe NFL score");
  const absolute = Math.abs(centipoints);
  return {
    sport: "nfl" as const,
    scoringVersion: rules.version,
    centipoints,
    points: `${centipoints < 0 ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`,
    breakdown,
  };
}

const lineupCard = z
  .object({
    cardId: z.uuid(),
    playerId: z.uuid(),
    sport: z.literal("nfl"),
    position: nflOffensivePosition,
  })
  .strict();
export const nflLineupRules = z
  .object({
    sport: z.literal("nfl"),
    version: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,79}$/),
    slots: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/),
            positions: z
              .array(nflOffensivePosition)
              .min(1)
              .max(4)
              .refine((p) => new Set(p).size === p.length),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict()
  .refine(
    (r) => new Set(r.slots.map((s) => s.id)).size === r.slots.length,
    "Duplicate lineup slot",
  );

/** Assigns configured slots without a greedy FLEX trap. It proves position fit
 * only, never ownership, lock status, player availability or account eligibility.
 * No bench/substitution or rarity multiplier is introduced. */
export function assignNflLineup(input: unknown, configuration: unknown) {
  const cards = z.array(lineupCard).min(1).max(30).parse(input);
  const rules = nflLineupRules.parse(configuration);
  if (cards.length !== rules.slots.length)
    throw Error("NFL lineup size mismatch");
  if (
    new Set(cards.map((c) => c.cardId)).size !== cards.length ||
    new Set(cards.map((c) => c.playerId)).size !== cards.length
  )
    throw Error("Duplicate NFL card or player");
  const matched = new Map<number, number>();
  function place(card: number, visited: Set<number>): boolean {
    for (let slot = 0; slot < rules.slots.length; slot++) {
      if (
        visited.has(slot) ||
        !rules.slots[slot].positions.includes(cards[card].position)
      )
        continue;
      visited.add(slot);
      const previous = matched.get(slot);
      if (previous === undefined || place(previous, visited)) {
        matched.set(slot, card);
        return true;
      }
    }
    return false;
  }
  for (let card = 0; card < cards.length; card++)
    if (!place(card, new Set()))
      throw Error("NFL positions do not fill the configured lineup");
  return rules.slots.map((slot, index) => ({
    slot: slot.id,
    cardId: cards[matched.get(index)!].cardId,
  }));
}
