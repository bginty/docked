import { z } from "zod";
import { serviceRosterCandidate } from "./multisport-roster-bridge";
import { rosterReviewPolicy, rosterReviewReport } from "./sport-roster-review";
import { digest } from "./scoring-engine";

const id = z.string().trim().min(1).max(160);
const binding = z
  .object({
    sport: z.literal("nba"),
    season: id,
    provider: id,
    canonicalPlayerId: id,
    providerPlayerId: id,
    playerId: id,
    canonicalTeamId: id,
    teamId: id,
    teamName: id,
    evidenceUrl: z.url().refine((s) => s.startsWith("https://")),
  })
  .strict();
const bundle = z
  .object({
    rows: z.array(z.unknown()).min(1).max(10000),
    bindings: z.array(binding).min(1).max(10000),
    policy: rosterReviewPolicy,
    completeTeamIds: z.array(id).length(30),
  })
  .strict();

/** Uses the shared ingestion contract and roster review. Produces no player IDs,
 * cards, grants or activation. Existing canonical bindings must be supplied. */
export function reviewNbaCatalogue(input: unknown, now: string) {
  const b = bundle.parse(input);
  if (b.policy.sport !== "basketball")
    throw Error("NBA roster policy required");
  if (new Set(b.completeTeamIds).size !== 30)
    throw Error("Thirty distinct NBA teams required");
  const identities = new Set<string>(),
    canonical = new Set<string>(),
    docked = new Set<string>();
  for (const item of b.bindings) {
    if (item.provider !== b.policy.provider || item.season !== b.policy.season)
      throw Error("Binding provider or season mismatch");
    if (
      identities.has(item.providerPlayerId) ||
      canonical.has(item.canonicalPlayerId) ||
      docked.has(item.playerId)
    )
      throw Error("Conflicting player identity bindings");
    identities.add(item.providerPlayerId);
    canonical.add(item.canonicalPlayerId);
    docked.add(item.playerId);
  }
  const candidates = b.rows.map((row) => {
    const r = z.object({ provider_id: id }).parse(row);
    const match = b.bindings.find(
      (entry) => entry.providerPlayerId === r.provider_id,
    );
    if (!match)
      throw Error(
        "Unmapped NBA player; review identity before catalogue import",
      );
    return serviceRosterCandidate(row, match);
  });
  const report = rosterReviewReport(
    candidates,
    b.policy,
    now,
    b.completeTeamIds,
  );
  const coverage = Object.fromEntries(
    b.completeTeamIds.map((team) => [
      team,
      report.rows.filter(
        (r) => r.status === "ready-for-review" && r.candidate?.teamId === team,
      ).length,
    ]),
  );
  return {
    ...report,
    sourceHash: digest(input),
    sport: "basketball" as const,
    season: b.policy.season,
    teamCoverage: coverage,
    completeEligibleCoverage: Object.values(coverage).every((n) => n > 0),
    positionCounts: Object.fromEntries(
      ["PG", "SG", "SF", "PF", "C"].map((position) => [
        position,
        report.rows.filter(
          (r) =>
            r.status === "ready-for-review" &&
            r.candidate?.positions.includes(position),
        ).length,
      ]),
    ),
    note: "Review only. Position counts overlap for multi-position players. No records or inventory modified.",
  };
}
