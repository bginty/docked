import { z } from "zod";
import { eplStats, nflStats, aflStats, type Sport } from "./scoring-v1";

const identifier = z.string().regex(/^[A-Za-z0-9:._-]{1,120}$/);
export const sourceSnapshot = z
  .object({
    provider: z.literal("docked-synthetic-v1"),
    simulated: z.literal(true),
    sport: z.enum(["epl", "nfl", "afl"]),
    fixtureId: identifier,
    revision: z.number().int().positive(),
    observedAt: z.iso.datetime(),
    status: z.enum([
      "scheduled",
      "live",
      "completed",
      "postponed",
      "abandoned",
      "rescheduled",
      "cancelled",
    ]),
    endedAt: z.iso.datetime().nullable(),
    players: z
      .array(
        z
          .object({
            playerId: identifier,
            availability: z.enum([
              "complete",
              "pending",
              "confirmed-dnp",
              "bye",
            ]),
            stats: z.unknown(),
          })
          .strict(),
      )
      .max(200),
  })
  .strict();
export type SourceSnapshot = z.infer<typeof sourceSnapshot>;
export interface ScoringProvider {
  id: string;
  liveReady: boolean;
  normalize(
    raw: unknown,
    sport: Sport,
    fixtureId: string,
    playerIds: string[],
  ): SourceSnapshot;
}
export const syntheticProvider: ScoringProvider = {
  id: "docked-synthetic-v1",
  liveReady: false,
  normalize(raw, sport, fixtureId, playerIds) {
    const data = sourceSnapshot.parse(raw);
    if (data.sport !== sport || data.fixtureId !== fixtureId)
      throw Error("Provider identity mismatch");
    if (
      new Set(data.players.map((p) => p.playerId)).size !== data.players.length
    )
      throw Error("Duplicate source player");
    for (const row of data.players) {
      if (!playerIds.includes(row.playerId)) throw Error("Unmapped player");
      if (row.availability === "complete")
        (sport === "epl"
          ? eplStats
          : sport === "nfl"
            ? nflStats
            : aflStats
        ).parse(row.stats);
      else if (row.stats !== null)
        throw Error("Unavailable player must not carry guessed statistics");
    }
    if (data.status === "completed" && !data.endedAt)
      throw Error("Completion timestamp required");
    if (data.endedAt && Date.parse(data.endedAt) > Date.parse(data.observedAt))
      throw Error("Invalid source time order");
    return data;
  },
};

/** Provider adapter building block. Ordered event numbers disambiguate equal-minute
 * substitutions/goals. Regulation seconds exclude added time; event membership does
 * not. A dismissed player leaves at the dismissal sequence. No inferred team total. */
export function eplOnPitchEvidence(input: unknown) {
  const v = z
    .object({
      intervals: z
        .array(
          z
            .object({
              enterOrder: z.number().int().nonnegative(),
              leaveOrder: z.number().int().positive(),
              regulationSeconds: z.number().int().min(0).max(5400),
              playedSeconds: z.number().int().min(0).max(8000),
            })
            .strict(),
        )
        .max(2),
      concededGoalOrders: z.array(z.number().int().nonnegative()).max(100),
    })
    .strict()
    .parse(input);
  if (new Set(v.concededGoalOrders).size !== v.concededGoalOrders.length)
    throw Error("Duplicate goal event");
  let end = -1;
  for (const i of v.intervals) {
    if (
      i.enterOrder <= end ||
      i.leaveOrder <= i.enterOrder ||
      i.playedSeconds < i.regulationSeconds
    )
      throw Error("Invalid on-pitch interval order");
    end = i.leaveOrder;
  }
  const regulationSeconds = v.intervals.reduce(
    (sum, i) => sum + i.regulationSeconds,
    0,
  );
  if (regulationSeconds > 5400) throw Error("Invalid regulation time");
  return {
    regulationSeconds,
    playedSeconds: v.intervals.reduce((sum, i) => sum + i.playedSeconds, 0),
    concededOnPitch: v.concededGoalOrders.filter((order) =>
      v.intervals.some((i) => order > i.enterOrder && order < i.leaveOrder),
    ).length,
    onPitchEvidence: "ordered-events-verified" as const,
  };
}
