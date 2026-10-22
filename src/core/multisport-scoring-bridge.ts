import { z } from "zod";
import { digest } from "./scoring-engine";
import { ownerSportFeed, ownerSportMapping } from "./owner-sport-feed";
import { mapRawScoringInput } from "./multisport-ingestion";
import { feedSport, scoringSport } from "./multisport-delivery";
const rawRecord = z.object({
  sport: feedSport,
  fixture_id: z.string(),
  player_id: z.string(),
  provider_player_id: z.string(),
  provider: z.string(),
  season: z.string(),
  revision: z.number().int().positive(),
  synthetic: z.boolean(),
  participation: z.enum(["played", "stat_recorded", "unknown", "dnp"]),
  removed: z.boolean(),
  complete: z.boolean(),
  stats: z.record(z.string(), z.number().nullable()),
  current_fields: z.record(z.string(), z.boolean()),
  scoring_evidence: z.unknown().optional(),
});
const fixtureRecord = z.object({
  id: z.string(),
  sport: feedSport,
  season: z.string(),
  provider: z.string(),
  provider_id: z.string(),
  synthetic: z.boolean(),
  status: z.string(),
  complete: z.boolean(),
  last_success: z.number(),
  last_error: z.string().nullable(),
  completion_observed_at: z.number().nullable(),
});
/** Converts the current raw projection, never change deltas or frontend totals.
 * Trusted mapping/rights and the existing frozen scorer still validate imports. */
export function serviceScoringPreview(input: {
  fixture: unknown;
  records: unknown[];
  fixtureRevision: number;
  mapping: unknown;
  sourceEvidence: string;
  now: string;
}) {
  const f = fixtureRecord.parse(input.fixture),
    mapping = ownerSportMapping.parse(input.mapping),
    now = Date.parse(input.now);
  if (f.synthetic)
    throw Error("Synthetic feed cannot enter authorised scoring");
  if (
    f.season !== mapping.season ||
    f.provider !== mapping.provider ||
    f.provider_id !== mapping.providerFixtureId ||
    scoringSport[f.sport] !== mapping.sport
  )
    throw Error("Frozen fixture context mismatch");
  if (f.status !== "final" || f.completion_observed_at === null)
    throw Error("Authoritative completion observation required");
  const usable =
    f.complete &&
    !f.last_error &&
    Number.isFinite(now) &&
    now >= f.last_success * 1000 &&
    now - f.last_success * 1000 <= mapping.maxAgeSeconds * 1000;
  const parsed = input.records.map((r) => rawRecord.parse(r));
  if (
    new Set(parsed.map((r) => r.player_id)).size !== parsed.length ||
    new Set(parsed.map((r) => r.provider_player_id)).size !== parsed.length
  )
    throw Error("Duplicate player identity");
  if (
    parsed.some(
      (r) =>
        r.fixture_id !== f.id ||
        r.provider !== f.provider ||
        r.sport !== f.sport ||
        r.season !== f.season ||
        r.synthetic,
    )
  )
    throw Error("Cross-fixture record");
  const issues: string[] = [];
  const players = mapping.players.map((m) => {
    const r = parsed.find((r) => r.provider_player_id === m.providerPlayerId);
    const result = r
      ? mapRawScoringInput(
          {
            ...r,
            usable: usable && r.complete && r.participation !== "unknown",
          },
          m.playerId,
        )
      : {
          availability: "pending" as const,
          stats: null,
          reason: "Mapped player absent",
        };
    if (result.reason) issues.push(`${m.playerId}: ${result.reason}`);
    return {
      providerPlayerId: m.providerPlayerId,
      availability: result.availability,
      stats: result.stats,
    };
  });
  return {
    issues,
    feed: ownerSportFeed.parse({
      schemaVersion: 1,
      sport: mapping.sport,
      season: f.season,
      provider: f.provider,
      providerFixtureId: f.provider_id,
      revision: input.fixtureRevision,
      observedAt: new Date(f.last_success * 1000).toISOString(),
      status: "completed",
      endedAt: null,
      completionObservedAt: new Date(
        f.completion_observed_at * 1000,
      ).toISOString(),
      evidence: {
        url: input.sourceEvidence,
        sha256: digest({ fixture: f, records: parsed }),
      },
      players,
    }),
  };
}
