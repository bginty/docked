import {
  eligibleCatalogue,
  definitionId,
  type CardEconomy,
  type NinePackProduct,
} from "./card-economy";
import { rarityRule, type Rarity } from "./card-rarity";
export function packAvailability(
  e: CardEconomy,
  p: NinePackProduct,
  now: number,
) {
  const unavailable = (reason: string, retryable = false) => ({
    available: false,
    availabilityReason: reason,
    availabilityRetryable: retryable,
  });
  if (!e.enabled) return unavailable("Pack purchases are paused.");
  if (now < p.effectiveAt) return unavailable("This pack is not on sale yet.");
  if (
    (p.expiresAt !== null && now >= p.expiresAt) ||
    (e.activeProductVersions && !e.activeProductVersions.includes(p.id))
  )
    return unavailable("This pack offer has ended.");
  const pool = eligibleCatalogue(e, p, now),
    needed = p.duplicatePlayers === "deny" ? p.cards : 1;
  if (pool.length < needed) {
    const candidates = Object.values(e.players).filter(
      (x) => x.sport === p.sport && p.positions.includes(x.position),
    );
    const stale = candidates.some(
      (x) =>
        now - x.observedAt > p.freshnessHours * 3600000 ||
        (e.rosterPolicy &&
          (!x.roster || now - x.roster.checkedAt > 72 * 3600000)),
    );
    return unavailable(
      stale
        ? "Purchases are waiting for a verified roster refresh. Your credits are unchanged."
        : "There are not enough eligible players to fulfil this pack.",
      stale,
    );
  }
  const stocked = pool.filter((x) =>
    Object.entries(p.weights).some(
      ([r, weight]) =>
        weight > 0 &&
        (e.definitions[definitionId(x.id, r)]?.issued ?? 0) <
          rarityRule(r as Rarity).lifetimeCap!,
    ),
  );
  if (stocked.length < needed)
    return unavailable("Available card supply cannot fulfil this pack.");
  return {
    available: true,
    availabilityReason: null,
    availabilityRetryable: false,
  };
}
