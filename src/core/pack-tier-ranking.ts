import { z } from "zod";
import { packProducts, packRankingPolicy } from "./pack-products";

// Trusted scoring-service preparation only; not a public input/issuance endpoint.
// Caller must reconcile totals to final Docked scoring records for the complete
// league/season and verify it is the previous completed season at edition freeze.
// A complete/final flag is not proof of source rights or source reconciliation.
const snapshotSchema = z
  .object({
    league: z.enum(["EPL", "NFL"]),
    rulesVersion: z.string().min(1),
    sourceSnapshotId: z.string().min(1),
    season: z
      .object({
        label: z.string().min(1),
        start: z.iso.datetime(),
        end: z.iso.datetime(),
      })
      .strict(),
    complete: z.boolean(),
    final: z.boolean(),
    players: z.array(
      z
        .object({
          playerId: z.string().min(1),
          league: z.enum(["EPL", "NFL"]),
          totalPointsHundredths: z
            .number()
            .int()
            .min(Number.MIN_SAFE_INTEGER)
            .max(Number.MAX_SAFE_INTEGER)
            .nullable(),
        })
        .strict(),
    ),
  })
  .strict();

/** Proposed player pool only; never mints/retiers cards or enables sales. */
export function prepareScoringPackPools(input: unknown) {
  const snapshot = snapshotSchema.parse(input);
  if (Date.parse(snapshot.season.start) >= Date.parse(snapshot.season.end))
    throw Error("Valid scoring season required");
  if (
    new Set(snapshot.players.map((p) => p.playerId)).size !==
    snapshot.players.length
  )
    throw Error("Duplicate player identity");
  if (snapshot.players.some((p) => p.league !== snapshot.league))
    throw Error("Rank each league separately");
  const requiredPlayers = Math.max(
    ...packProducts.map((p) => p.rankingBand.through),
  );
  if (
    !snapshot.complete ||
    !snapshot.final ||
    snapshot.players.length < requiredPlayers ||
    snapshot.players.some((p) => p.totalPointsHundredths === null)
  ) {
    return { status: "DATA_REQUIRED" as const, pools: [] };
  }
  const ranked = [...snapshot.players].sort((a, b) => {
    const left = a.totalPointsHundredths!,
      right = b.totalPointsHundredths!;
    return left === right
      ? a.playerId.localeCompare(b.playerId)
      : left > right
        ? -1
        : 1;
  });
  // ID order stabilises display within a tier; it cannot decide cutoff ties.
  const tiedBoundaries = [
    ...new Set(packProducts.map((p) => p.rankingBand.through)),
  ].filter(
    (n) =>
      ranked[n] &&
      ranked[n - 1].totalPointsHundredths === ranked[n].totalPointsHundredths,
  );
  if (tiedBoundaries.length)
    return {
      status: "BOUNDARY_TIE_REVIEW" as const,
      boundaries: tiedBoundaries,
      pools: [],
    };
  return {
    status: "PROPOSED_ONLY" as const,
    policyVersion: packRankingPolicy.version,
    league: snapshot.league,
    rulesVersion: snapshot.rulesVersion,
    sourceSnapshotId: snapshot.sourceSnapshotId,
    season: snapshot.season,
    pools: packProducts.map((product) => ({
      productId: product.id,
      tier: product.inventoryTier,
      players: ranked
        .slice(product.rankingBand.from - 1, product.rankingBand.through)
        .map((player, i) => ({
          ...player,
          rank: product.rankingBand.from + i,
        })),
    })),
  };
}
