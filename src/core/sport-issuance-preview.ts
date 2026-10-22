import { z } from "zod";
import { rarities, rarityRule } from "./card-rarity";
import { rosterReviewReport } from "./sport-roster-review";
const plan = z
  .object({
    sport: z.enum(["afl", "nrl", "basketball", "football"]),
    season: z.string().min(1),
    // Owner chooses allocations. No default catalogue-wide mint is inferred.
    allocations: z
      .array(
        z
          .object({
            playerId: z.string().min(1),
            rarity: z.enum(
              rarities as [
                (typeof rarities)[number],
                ...(typeof rarities)[number][],
              ],
            ),
            proposedCount: z.number().int().nonnegative().max(100000),
            alreadyIssuedLifetime: z.number().int().nonnegative(),
            pool: z.enum(["weekly-core", "standard", "premium", "none"]),
          })
          .strict(),
      )
      .max(50000),
  })
  .strict();
/** Review only: no card IDs/serials are allocated, no balance/ownership writes. */
export function previewSportIssuance(
  input: unknown,
  rawRoster: unknown[],
  policy: unknown,
  completeTeams: string[],
  now: string,
) {
  const p = plan.parse(input),
    review = rosterReviewReport(rawRoster, policy, now, completeTeams);
  const duplicateKeys = new Map<string, number>();
  p.allocations.forEach((a) => {
    const key = `${a.playerId}:${a.rarity}`;
    duplicateKeys.set(key, (duplicateKeys.get(key) ?? 0) + 1);
  });
  const allocations = p.allocations.map((a) => {
    const reasons: string[] = [],
      rule = rarityRule(a.rarity);
    const player = review.rows.find((r) => r.playerId === a.playerId);
    if (
      !player ||
      player.status !== "ready-for-review" ||
      player.candidate?.sport !== p.sport ||
      player.candidate.season !== p.season
    )
      reasons.push("Current roster/identity review required");
    if (duplicateKeys.get(`${a.playerId}:${a.rarity}`) !== 1)
      reasons.push("Duplicate allocation");
    if (
      rule.lifetimeCap !== null &&
      a.alreadyIssuedLifetime + a.proposedCount > rule.lifetimeCap
    )
      reasons.push("Permanent lifetime supply exceeded");
    if (
      (a.pool === "weekly-core" && a.rarity !== "CORE") ||
      (a.pool === "standard" && a.rarity === "CORE") ||
      (a.pool === "premium" &&
        !["ULTRA_RARE", "LEGENDARY", "ICON"].includes(a.rarity))
    )
      reasons.push("Rarity excluded from this pack pool");
    return {
      ...a,
      lifetimeCap: rule.lifetimeCap,
      label: rule.label,
      remainingLifetime:
        rule.lifetimeCap === null
          ? null
          : Math.max(0, rule.lifetimeCap - a.alreadyIssuedLifetime),
      missingVerifiedNumber:
        player?.candidate?.jerseyNumber == null ||
        !player.candidate.jerseyVerified,
      reasons,
      eligibleForReview: reasons.length === 0,
    };
  });
  return {
    schemaVersion: 1,
    sport: p.sport,
    season: p.season,
    issuanceAllowed: false,
    activationAllowed: false,
    requiresOwnerApproval: true,
    proposedCards: allocations
      .filter((a) => a.eligibleForReview)
      .reduce((n, a) => n + a.proposedCount, 0),
    excludedAllocations: allocations.filter((a) => !a.eligibleForReview).length,
    catalogueReview: {
      ready: review.readyForReview,
      quarantined: review.quarantined,
    },
    allocations,
  };
}
