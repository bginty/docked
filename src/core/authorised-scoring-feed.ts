import { z } from "zod";
import { sourceSnapshot, syntheticProvider } from "./scoring-provider";
import type { ScoringSport } from "./scoring-v1";
const rightsBase = z
  .object({
    provider: z.string().min(1),
    competition: z.enum(["EPL", "NFL", "AFL", "NRL", "NBA"]),
    storage: z.literal(true),
    evidence: z.string().url(),
    reviewExpires: z.iso.datetime(),
    maxAgeSeconds: z.number().int().positive().max(86400),
  })
  .strict();
// Published open licences can authorise free-beta use; buying a commercial API
// is not a prerequisite. Keep prior approvals compatible without broadening them.
const rights = z.union([
  rightsBase.extend({ commercialFantasy: z.literal(true) }).strict(),
  rightsBase
    .extend({
      intendedUse: z.literal("isolated-free-beta"),
      fantasyUse: z.literal(true),
    })
    .strict(),
]);
const envelope = sourceSnapshot
  .omit({ provider: true, simulated: true })
  .extend({
    provider: z.string().min(1),
    simulated: z.literal(false),
    competition: z.enum(["EPL", "NFL", "AFL", "NRL", "NBA"]),
  })
  .strict();
export type AuthorisedScoringSnapshot = z.infer<typeof envelope>;
/** Pure validation boundary for a future authorised provider adapter. No fetching,
 * credentials, ingestion endpoint or live-scoring activation is provided here. */
export function validateAuthorisedScoring(
  raw: unknown,
  approval: unknown,
  mapping: {
    sport: ScoringSport;
    fixtureId: string;
    playerIds: string[];
    scoringVersion?: string;
  },
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
      (
        {
          epl: "EPL",
          nfl: "NFL",
          afl: "AFL",
          nrl: "NRL",
          basketball: "NBA",
        } as const
      )[mapping.sport]
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
    mapping.scoringVersion,
  );
  if (
    mapping.playerIds.some((id) => !data.players.some((p) => p.playerId === id))
  )
    throw Error("Required player coverage missing; keep pending");
  return data;
}
