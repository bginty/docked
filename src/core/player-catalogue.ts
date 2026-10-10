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
    firstEligibleSeason: z.string().min(1),
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
