import type { CreditsState } from "./credits-sandbox";
import type { CatalogCard } from "./scoring-engine";
import { nflRarityRules } from "./scoring-v1";
/** Server/operator adapter only. Core rows must come from the authenticated
 * member inventory, never a browser-supplied ownership claim. No cash assets. */
export function economyScoringCatalogue(
  state: CreditsState,
  freeCore: CatalogCard[],
  now: number,
): CatalogCard[] {
  const e = state.economy;
  if (
    !e?.enabled ||
    e.id !== "invited-nfl-test-v2" ||
    state.policy.liveEnabled ||
    state.policy.purchasedWithdrawable
  )
    throw Error("Isolated test scoring inventory required");
  if (freeCore.some((c) => c.rarity !== "CORE" || c.sport !== "nfl" || !e.players[c.playerId] || e.players[c.playerId].position!==c.position))
    throw Error("Only server-owned free Core inventory with reconciled permanent player identities can be combined");
  return [
    ...freeCore,
    ...Object.values(e.instances).map((c) => {
      const p = e.players[c.playerId],
        owned = state.commerce.cards[c.id],
        opened = e.packs[c.source]?.openedAt;
      return {
        cardId: c.id,
        playerId: c.playerId,
        position: p.position,
        rarity: c.rarity,
        owner: owned.owner!,
        sport: "nfl" as const,
        eligible:
          !!opened &&
          p.status === "active" &&
          p.observedAt <= now &&
          now - p.observedAt <= 72 * 3600000 &&
          nflRarityRules().positions.includes(p.position),
      };
    }),
  ];
}
