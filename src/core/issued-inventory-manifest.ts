import { digest } from "./scoring-engine";
import { rarityRule, type Rarity } from "./card-rarity";
export type IssuedAllocation = {
  id: string;
  sport: string;
  playerId: string;
  provider: string;
  providerId: string;
  rarity: Rarity;
  serial: number;
};
/** Read-only accounting proposal. Retirement/refund/custody never free a serial. */
export function issuedInventoryManifest(records: IssuedAllocation[]) {
  const ids = new Set<string>(),
    serials = new Set<string>();
  const groups = new Map<
    string,
    {
      sport: string;
      playerId: string;
      provider: string;
      providerId: string;
      rarity: Rarity;
      cap: number;
      ids: string[];
      serials: number[];
    }
  >();
  for (const r of records) {
    if (
      !["nfl", "afl", "nrl"].includes(r.sport) ||
      !r.id ||
      !r.playerId ||
      !r.provider ||
      !r.providerId
    )
      throw Error("Explicit supported historical identity required");
    const cap = rarityRule(r.rarity).lifetimeCap;
    if (
      cap === null ||
      !Number.isSafeInteger(r.serial) ||
      r.serial < 1 ||
      r.serial > cap
    )
      throw Error("Invalid limited lifetime allocation");
    const key = [r.sport, r.provider, r.providerId, r.rarity].join("|");
    if (ids.has(r.id) || serials.has(key + "|" + r.serial))
      throw Error("Duplicate immutable ID or lifetime serial");
    ids.add(r.id);
    serials.add(key + "|" + r.serial);
    const g = groups.get(key) ?? {
      sport: r.sport,
      playerId: r.playerId,
      provider: r.provider,
      providerId: r.providerId,
      rarity: r.rarity,
      cap,
      ids: [],
      serials: [],
    };
    if (g.playerId !== r.playerId)
      throw Error("Provider identity alias needs explicit mapping review");
    g.ids.push(r.id);
    g.serials.push(r.serial);
    groups.set(key, g);
  }
  const rows = [...groups.values()]
    .map((g) => {
      g.ids.sort();
      g.serials.sort((a, b) => a - b);
      if (g.serials.some((s, i) => s !== i + 1))
        throw Error("Lifetime serial gap requires reconciliation");
      return {
        ...g,
        issued: g.ids.length,
        remainingLifetimeCapacity: g.cap - g.ids.length,
        available: 0,
        reserved: 0,
      };
    })
    .sort((a, b) =>
      [a.sport, a.provider, a.providerId, a.rarity]
        .join("|")
        .localeCompare([b.sport, b.provider, b.providerId, b.rarity].join("|")),
    );
  return { rows, totalIssued: ids.size, digest: digest(rows) };
}
