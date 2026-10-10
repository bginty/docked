import { z } from "zod";
import { sourceSnapshot, syntheticProvider } from "./scoring-provider";
import type { Sport } from "./scoring-v1";
const rights = z
  .object({
    provider: z.string().min(1),
    competition: z.enum(["EPL", "NFL", "AFL"]),
    commercialFantasy: z.literal(true),
    storage: z.literal(true),
    evidence: z.string().url(),
    reviewExpires: z.iso.datetime(),
    maxAgeSeconds: z.number().int().positive().max(86400),
  })
  .strict();
const envelope = sourceSnapshot
  .omit({ provider: true, simulated: true })
  .extend({
    provider: z.string().min(1),
    simulated: z.literal(false),
    competition: z.enum(["EPL", "NFL", "AFL"]),
  })
  .strict();
export type AuthorisedScoringSnapshot = z.infer<typeof envelope>;
/** Pure validation boundary for a future authorised provider adapter. No fetching,
 * credentials, ingestion endpoint or live-scoring activation is provided here. */
export function validateAuthorisedScoring(
  raw: unknown,
  approval: unknown,
  mapping: { sport: Sport; fixtureId: string; playerIds: string[] },
  now: string,
): AuthorisedScoringSnapshot {
  const permit = rights.parse(approval),
    data = envelope.parse(raw),
    n = Date.parse(now);
  if (!Number.isFinite(n) || Date.parse(permit.reviewExpires) <= n)
    throw Error("Source rights review expired");
  if (
    data.provider !== permit.provider ||
    data.competition !== permit.competition ||
    data.competition !==
      ({ epl: "EPL", nfl: "NFL", afl: "AFL" } as const)[mapping.sport]
  )
    throw Error("Provider/competition mismatch");
  const age = n - Date.parse(data.observedAt);
  if (age < 0 || age > permit.maxAgeSeconds * 1000)
    throw Error("Source stale or future-dated");
  // Reuse strict sport statistics/time-order checks without writing synthetic data.
  const { competition: _, ...statistics } = data;
  void _;
  syntheticProvider.normalize(
    { ...statistics, provider: "docked-synthetic-v1", simulated: true },
    mapping.sport,
    mapping.fixtureId,
    mapping.playerIds,
  );
  if (
    mapping.playerIds.some((id) => !data.players.some((p) => p.playerId === id))
  )
    throw Error("Required player coverage missing; keep pending");
  return data;
}
