import { z } from "zod";
import { syntheticProvider } from "./scoring-provider";
import { scorePlayer, type Rules } from "./scoring-v1";
import type { AuthorisedScoringSnapshot } from "./authorised-scoring-feed";

const id = z.string().regex(/^[A-Za-z0-9:._-]{1,120}$/);
const sport = z.enum(["afl", "nrl", "basketball", "epl"]);
/** Transport contract for the owner's scraper. It carries events, not trusted
 * fantasy totals, multipliers, wallet values or membership/ownership claims. */
export const ownerSportFeed = z
  .object({
    schemaVersion: z.literal(1),
    sport,
    season: id,
    provider: id,
    providerFixtureId: id,
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
    completionObservedAt: z.iso.datetime().optional(),
    evidence: z
      .object({
        url: z.url().refine((v) => {
          const u = new URL(v);
          return u.protocol === "https:" && !u.username && !u.password;
        }),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    players: z
      .array(
        z
          .object({
            providerPlayerId: id,
            availability: z.enum(["complete", "pending", "confirmed-dnp"]),
            stats: z.unknown(),
          })
          .strict(),
      )
      .max(200),
  })
  .strict();

// Trusted operator configuration is separate from the downloaded payload.
export const ownerSportMapping = z
  .object({
    sport,
    season: id,
    provider: id,
    providerFixtureId: id,
    fixtureId: id,
    scoringVersion: id,
    maxAgeSeconds: z.number().int().min(1).max(86400),
    players: z
      .array(
        z
          .object({
            providerPlayerId: id,
            playerId: id,
            position: id,
          })
          .strict(),
      )
      .min(1)
      .max(200),
  })
  .strict();

/** Offline normalisation/dry run. Reuses the scoring engine's schema boundary.
 * Does not fetch, persist, approve a source, create a round or issue assets.
 * The existing authorised import path must still validate the configured source
 * policy and frozen period before any hosted import. */
export function previewOwnerSportFeed(
  raw: unknown,
  mappingInput: unknown,
  rules: Rules,
  now: string,
) {
  const feed = ownerSportFeed.parse(raw),
    mapping = ownerSportMapping.parse(mappingInput);
  if (
    feed.sport !== mapping.sport ||
    feed.season !== mapping.season ||
    feed.provider !== mapping.provider ||
    feed.providerFixtureId !== mapping.providerFixtureId ||
    rules.sport !== mapping.sport ||
    rules.version !== mapping.scoringVersion
  )
    throw Error("Feed identity, season or frozen scoring version mismatch");
  const age = Date.parse(now) - Date.parse(feed.observedAt);
  if (!Number.isFinite(age) || age < 0 || age > mapping.maxAgeSeconds * 1000)
    throw Error("Feed stale or future-dated");
  if (
    new Set(mapping.players.map((p) => p.playerId)).size !==
      mapping.players.length ||
    new Set(mapping.players.map((p) => p.providerPlayerId)).size !==
      mapping.players.length ||
    mapping.players.some((p) => !rules.positions.includes(p.position))
  )
    throw Error("Ambiguous player mapping or invalid position");
  if (
    new Set(feed.players.map((p) => p.providerPlayerId)).size !==
      feed.players.length ||
    feed.players.some(
      (p) =>
        !mapping.players.some((m) => m.providerPlayerId === p.providerPlayerId),
    )
  )
    throw Error("Duplicate or unmapped source player");
  const missingPlayerIds: string[] = [];
  const players = mapping.players.map((p) => {
    const row = feed.players.find(
      (r) => r.providerPlayerId === p.providerPlayerId,
    );
    if (!row) missingPlayerIds.push(p.playerId);
    return {
      playerId: p.playerId,
      availability: row?.availability ?? ("pending" as const),
      stats: row ? row.stats : null,
    };
  });
  const checked = syntheticProvider.normalize(
    {
      provider: "docked-synthetic-v1",
      simulated: true,
      sport: feed.sport,
      fixtureId: mapping.fixtureId,
      revision: feed.revision,
      observedAt: feed.observedAt,
      status: feed.status,
      endedAt: feed.endedAt,
      ...(feed.completionObservedAt
        ? { completionObservedAt: feed.completionObservedAt }
        : {}),
      players,
    },
    feed.sport,
    mapping.fixtureId,
    mapping.players.map((p) => p.playerId),
    rules.version,
  );
  const snapshot: AuthorisedScoringSnapshot = {
    ...checked,
    provider: feed.provider,
    simulated: false,
    competition: { afl: "AFL", nrl: "NRL", basketball: "NBA", epl: "EPL" }[
      feed.sport
    ] as "AFL" | "NRL" | "NBA" | "EPL",
  };
  return {
    schemaVersion: 1,
    dryRun: true,
    activationAllowed: false,
    persistenceAllowed: false,
    scoringVersion: rules.version,
    sourceEvidence: feed.evidence,
    missingPlayerIds,
    snapshot,
    players: snapshot.players.map((p) => ({
      playerId: p.playerId,
      availability: p.availability,
      baseCentipoints:
        feed.status !== "completed" || p.availability === "pending"
          ? null
          : p.availability === "confirmed-dnp"
            ? 0
            : scorePlayer(
                rules,
                mapping.players.find((m) => m.playerId === p.playerId)!
                  .position,
                p.stats,
              ).centipoints,
    })),
  };
}
