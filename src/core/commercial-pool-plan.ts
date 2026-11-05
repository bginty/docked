import { createHash } from "node:crypto";
import { z } from "zod";
import { limitedRarities, rarityRule } from "./card-rarity";
import { commercialCardSnapshot } from "./commercial-presentation";

export const poolRosterCandidate = z.object({
  id: z.string().uuid(),
  sport: z.enum(["nfl", "afl", "nrl"]),
  provider: z.string().min(1),
  providerId: z.string().min(1),
  snapshot: commercialCardSnapshot.extend({ synthetic: z.literal(false) }),
  eligiblePositions: z.array(z.string().min(1)).min(1),
  source: z.object({
    url: z.string().url(),
    hash: z.string().regex(/^[a-f0-9]{64}$/),
    checkedAt: z.string().datetime(),
    license: z.string().min(1),
    verification: z.string().min(1),
    // A verified factual identity is not an issuance approval.
    permanentIssuanceEligible: z.literal(false),
  }),
});
export type PoolRosterCandidate = z.infer<typeof poolRosterCandidate>;
export type DormantPoolDefinition = {
  id: string;
  player_id: string;
  sport: PoolRosterCandidate["sport"];
  rarity: string;
  lifetime_cap: number;
  issued: 0;
  legacy_issued: 0;
  approved: false;
  rights_reference: string;
  snapshot: PoolRosterCandidate["snapshot"] & {
    eligiblePositions: string[];
    provider: string;
    providerId: string;
    source: PoolRosterCandidate["source"];
  };
};
export const poolPlanVersion = "dormant-real-player-pool-2026-11-05-v1";
function definitionUuid(sport: string, player: string, rarity: string) {
  const h = createHash("sha256")
    .update(`${poolPlanVersion}:${sport}:${player}:${rarity}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function dormantCommercialPool(input: unknown[]) {
  const players = input.map((p) => poolRosterCandidate.parse(p));
  const ids = new Set<string>(),
    providers = new Set<string>();
  for (const p of players) {
    const id = `${p.sport}:${p.id}`;
    const provider = `${p.sport}:${p.provider}:${p.providerId}`;
    if (ids.has(id) || providers.has(provider))
      throw Error("Duplicate roster identity or provider alias");
    if (!p.eligiblePositions.includes(p.snapshot.position))
      throw Error("Primary position must retain authoritative eligibility");
    ids.add(id);
    providers.add(provider);
  }
  return players
    .sort((a, b) => `${a.sport}:${a.id}`.localeCompare(`${b.sport}:${b.id}`))
    .flatMap((p) =>
      limitedRarities.map((rarity): DormantPoolDefinition => ({
        id: definitionUuid(p.sport, p.id, rarity),
        player_id: p.id,
        sport: p.sport,
        rarity,
        lifetime_cap: rarityRule(rarity).lifetimeCap!,
        issued: 0,
        legacy_issued: 0,
        approved: false,
        rights_reference: `owner-confirmed-player-names-20261102; factual-source:${p.source.license}:${p.source.hash}; permanent-issuance-pending`,
        snapshot: {
          ...p.snapshot,
          eligiblePositions: p.eligiblePositions,
          provider: p.provider,
          providerId: p.providerId,
          source: p.source,
        },
      })),
    );
}

/** Evidence check only: immutable invited TEST allocations are excluded from the
 * commercial baseline by the existing economy specification, never erased or
 * silently converted. Unknown/non-TEST issuance must block automatic preparation. */
export function reconcileExcludedTestSupply(
  rows: {
    sport: string;
    rarity: string;
    instances: number;
    matchedTestReceipts: number;
  }[],
) {
  for (const row of rows) {
    if (
      !Number.isSafeInteger(row.instances) ||
      row.instances < 0 ||
      row.instances !== row.matchedTestReceipts
    )
      throw Error(
        "Unclassified existing issuance requires explicit reconciliation",
      );
  }
  return {
    version: "existing-test-allocation-exclusion-v1",
    commercialBaseline: 0,
    excludedInstances: rows.reduce((n, r) => n + r.instances, 0),
    authority:
      "docs/NFL_CARD_ECONOMY_DELIVERY.md; docs/NFL_CARD_ECONOMY_V2.md; TEST_ONLY saved pack receipts",
    recordsPreserved: true,
    rows,
  };
}
