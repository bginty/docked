import { digest } from "./scoring-engine";
import type { DormantPoolDefinition } from "./commercial-pool-plan";
export type IssuedSupply = {
  sport: string;
  player_id: string;
  provider: string | null;
  provider_id: string | null;
  rarity: string;
  issued: number;
  max_serial: number;
};
/** Counts never subtract listings, transfers, locks, retired players or refunds. */
export function reconcileLifetimePool(
  rows: DormantPoolDefinition[],
  issued: IssuedSupply[],
) {
  const used = new Set<number>();
  const reconciled = rows.map((row) => {
    const matching = issued.flatMap((old, index) =>
      old.sport === row.sport &&
      old.rarity === row.rarity &&
      (old.player_id === row.player_id ||
        (old.provider === row.snapshot.provider &&
          old.provider_id === row.snapshot.providerId))
        ? [{ old, index }]
        : [],
    );
    if (matching.length > 1)
      throw Error("Ambiguous canonical lifetime identity");
    const match = matching[0];
    const count = match?.old.issued ?? 0;
    if (
      !Number.isSafeInteger(count) ||
      count < 0 ||
      (match && match.old.max_serial !== count)
    )
      throw Error("Lifetime serial history requires explicit reconciliation");
    if (count > row.lifetime_cap)
      throw Error("Existing issuance exceeds lifetime cap");
    if (match) {
      if (used.has(match.index)) throw Error("Legacy identity mapped twice");
      used.add(match.index);
    }
    return { ...row, issued: count, legacy_issued: count };
  });
  const unmatched = issued.filter(
    (r, i) => ["nfl", "afl", "nrl"].includes(r.sport) && !used.has(i),
  );
  return {
    rows: reconciled,
    unmatched,
    digest: digest({ rows: reconciled, issued }),
    legacyIssued: reconciled.reduce((n, r) => n + r.legacy_issued, 0),
    importReady: unmatched.length === 0,
  };
}
