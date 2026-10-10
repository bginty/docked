import { z } from "zod";
import { validateLineup, type Rules } from "./scoring-v1";
const player = z
  .object({
    id: z.string().uuid(),
    provider: z.string().min(1),
    providerId: z.string().min(1),
    name: z.string().min(2).max(100),
    sport: z.enum(["epl", "nfl", "afl"]),
    competition: z.string().min(1),
    currentClubId: z.string().min(1),
    currentClub: z.string().min(1),
    position: z.string().min(1),
    firstEligibleSeason: z.string().min(1).nullable(),
    observedAt: z.iso.datetime(),
    evidence: z.url(),
  })
  .strict();
const manifest = z
  .object({
    provider: z.string().min(1),
    version: z.string().min(1),
    reviewedAt: z.iso.datetime(),
    reviewExpiresAt: z.iso.datetime(),
    evidence: z.url(),
    fantasyUse: z.literal(true),
    storage: z.literal(true),
    collectibleSales: z.boolean(),
    playerLikeness: z.boolean(),
    clubLogos: z.boolean(),
    players: z.array(player).min(1),
  })
  .strict();
export function validateCatalogue(
  input: unknown,
  now: string,
  maxAgeHours = 72,
) {
  const m = manifest.parse(input),
    at = Date.parse(now);
  if (
    !Number.isFinite(at) ||
    !Number.isFinite(maxAgeHours) ||
    maxAgeHours <= 0 ||
    Date.parse(m.reviewedAt) > at ||
    Date.parse(m.reviewExpiresAt) <= at
  )
    throw Error("Current rights review required");
  const ids = new Set<string>(),
    providerIds = new Set<string>();
  for (const p of m.players) {
    if (
      p.provider !== m.provider ||
      ids.has(p.id) ||
      providerIds.has(`${p.sport}:${p.providerId}`)
    )
      throw Error("Duplicate or mismatched provider identity");
    if (p.sport === "epl" && p.competition !== "EPL")
      throw Error("Association football is EPL only");
    const age = at - Date.parse(p.observedAt);
    if (age < 0 || age > maxAgeHours * 3600000)
      throw Error("Catalogue observation stale or future dated");
    ids.add(p.id);
    providerIds.add(`${p.sport}:${p.providerId}`);
  }
  return m;
}
/** Preparation only: never rename, burn, mint or reassign an owned card. */
export function inventoryReplacementPlan(
  oldCards: { id: string; owner: string }[],
  assignments: { oldCardId: string; newEditionId: string }[],
  reason: string,
) {
  if (reason.trim().length < 20)
    throw Error("Auditable replacement reason required");
  if (new Set(assignments.map((a) => a.oldCardId)).size !== assignments.length)
    throw Error("Duplicate replacement");
  return assignments.map((a) => {
    const old = oldCards.find((c) => c.id === a.oldCardId);
    if (!old || !z.string().uuid().safeParse(a.newEditionId).success)
      throw Error("Unknown inventory or edition");
    return {
      ...a,
      owner: old.owner,
      preserveOriginal: true,
      action: "PROPOSE_SEPARATE_BETA_GRANT",
      reason,
    };
  });
}
export function verifyStarterEligibility(
  rules: Rules,
  players: z.infer<typeof player>[],
  season: string,
  firstYearMinimum: number,
) {
  validateLineup(
    rules,
    players.map((p) => ({
      cardId: p.id,
      playerId: p.id,
      position: p.position,
    })),
  );
  if (
    players.some((p) => p.sport !== rules.sport) ||
    players.filter((p) => p.firstEligibleSeason === season).length <
      firstYearMinimum
  )
    throw Error("Sport or approved First Year minimum cannot be met");
}

/** Owner approved 11 October 2026. Applies only to NEW isolated free-beta grants.
 * Existing editions, locked rules, ownership history and commercial eligibility stay intact. */
export const friendsCataloguePolicy = {
  version: "friends-current-players-2026-10-11",
  scope: "isolated-free-beta",
  sports: ["epl", "nfl"],
  firstYearMinimum: 0,
  scoringTierMultiplier: 1,
} as const;

export function friendsStarterPlan(input: unknown, rules: Rules, now: string) {
  const catalogue = validateCatalogue(input, now);
  if (rules.sport !== "epl" && rules.sport !== "nfl")
    throw Error("Friends real catalogue scope is EPL and NFL");
  const pool = catalogue.players
    .filter(
      (p) =>
        p.sport === rules.sport && p.competition === rules.sport.toUpperCase(),
    )
    .sort((a, b) => a.providerId.localeCompare(b.providerId));
  // Maximum bipartite matching, including NFL FLEX. No random purchase selection.
  const assigned = new Map<number, number>();
  const place = (slot: number, seen: Set<number>): boolean => {
    for (let i = 0; i < pool.length; i++) {
      if (
        seen.has(i) ||
        !rules.slots[slot].positions.includes(pool[i].position)
      )
        continue;
      seen.add(i);
      const previous = assigned.get(i);
      if (previous === undefined || place(previous, seen)) {
        assigned.set(i, slot);
        return true;
      }
    }
    return false;
  };
  if (rules.slots.some((_, i) => !place(i, new Set())))
    throw Error(
      "Verified catalogue cannot supply a complete eligible starting team",
    );
  const selected = [...assigned]
    .sort((a, b) => a[1] - b[1])
    .map(([i]) => pool[i]);
  verifyStarterEligibility(rules, selected, "not-required-for-free-beta", 0);
  return {
    policy: friendsCataloguePolicy,
    catalogueVersion: catalogue.version,
    sport: rules.sport,
    rulesVersion: rules.version,
    firstYearMinimum: 0,
    selected,
    grantsPerMember: selected.length,
    preserveOriginalCards: true,
    commercialSupplyChanges: false,
    artwork: "approved-docked-only",
  };
}
