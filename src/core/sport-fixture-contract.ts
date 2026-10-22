import { z } from "zod";
const id = z.string().regex(/^[A-Za-z0-9:._-]{1,160}$/);
export const canonicalFixtureBatch = z
  .object({
    schemaVersion: z.literal(1),
    sport: z.enum(["afl", "nrl", "basketball", "epl"]),
    season: id,
    provider: id,
    revision: z.number().int().positive(),
    observedAt: z.iso.datetime(),
    sourceUpdatedAt: z.iso.datetime().nullable(),
    source: z.url(),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    completePeriod: z.boolean(),
    fixtures: z
      .array(
        z
          .object({
            providerFixtureId: id,
            homeTeamId: id,
            awayTeamId: id,
            scheduledAt: z.iso.datetime(),
            status: z.enum([
              "scheduled",
              "live",
              "completed",
              "postponed",
              "abandoned",
              "rescheduled",
              "cancelled",
            ]),
            // A final team score does not prove any player's statistics or DNP.
            playerStatistics: z.enum(["unavailable", "partial", "complete"]),
          })
          .strict(),
      )
      .max(1000),
  })
  .strict();
export type CanonicalFixtureBatch = z.infer<typeof canonicalFixtureBatch>;
/** Separate trusted identity mapping. No names, array indices or team order can
 * supply a player identity. An incomplete round cannot open entries. */
export function mapScoringFixtures(
  input: unknown,
  mapping: {
    sport: CanonicalFixtureBatch["sport"];
    season: string;
    provider: string;
    fixtures: {
      providerFixtureId: string;
      fixtureId: string;
      playerIds: string[];
    }[];
  },
  now: string,
  maxAgeSeconds: number,
) {
  const batch = canonicalFixtureBatch.parse(input),
    age = Date.parse(now) - Date.parse(batch.observedAt);
  if (
    !Number.isFinite(age) ||
    age < 0 ||
    !Number.isInteger(maxAgeSeconds) ||
    maxAgeSeconds < 1 ||
    maxAgeSeconds > 86400 ||
    age > maxAgeSeconds * 1000
  )
    throw Error("Fixture evidence stale or invalid");
  if (
    batch.sourceUpdatedAt &&
    Date.parse(batch.sourceUpdatedAt) > Date.parse(batch.observedAt)
  )
    throw Error("Future provider timestamp");
  if (
    !batch.completePeriod ||
    !batch.fixtures.length ||
    batch.sport !== mapping.sport ||
    batch.season !== mapping.season ||
    batch.provider !== mapping.provider
  )
    throw Error("Complete matching period required");
  if (
    new Set(batch.fixtures.map((f) => f.providerFixtureId)).size !==
      batch.fixtures.length ||
    new Set(mapping.fixtures.map((f) => f.fixtureId)).size !==
      mapping.fixtures.length ||
    new Set(mapping.fixtures.map((f) => f.providerFixtureId)).size !==
      mapping.fixtures.length ||
    mapping.fixtures.length !== batch.fixtures.length
  )
    throw Error("Duplicate or incomplete fixture mapping");
  return batch.fixtures.map((f) => {
    const mapped = mapping.fixtures.find(
      (m) => m.providerFixtureId === f.providerFixtureId,
    );
    if (
      !mapped ||
      !mapped.fixtureId ||
      !mapped.playerIds.length ||
      new Set(mapped.playerIds).size !== mapped.playerIds.length ||
      f.homeTeamId === f.awayTeamId
    )
      throw Error("Verified fixture/player mapping required");
    if (
      ["postponed", "abandoned", "rescheduled", "cancelled"].includes(f.status)
    )
      throw Error("Exceptional fixture needs an explicit period policy review");
    return {
      id: mapped.fixtureId,
      scheduledAt: f.scheduledAt,
      playerIds: [...mapped.playerIds],
    };
  });
}
