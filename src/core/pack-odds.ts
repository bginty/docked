import { rarities, rarityRule } from "./card-rarity";
import type { NinePackProduct } from "./card-economy";

/** Disclosure from the purchase configuration, never a second set of odds. */
export function packOdds(p: NinePackProduct) {
  const included = rarities.filter((r) => r !== "CORE" && p.weights[r] > 0);
  const floor = included[0];
  const ultraFloor =
    floor === "ULTRA_RARE" && Object.keys(p.guaranteedSlots).length === 0;
  return {
    headline: ultraFloor
      ? `${p.cards} ${p.cards === 1 ? "card" : "cards"} · ${rarityRule(floor).label} or better on every card`
      : null,
    guarantee: ultraFloor
      ? "Every card is guaranteed Ultra Rare or better. Legendary and Icon cards are not guaranteed."
      : null,
    excluded: rarities
      .filter((r) => r === "CORE" || p.weights[r] === 0)
      .map((r) => rarityRule(r).label),
    rows: included.map((r) => ({
      rarity: r,
      label: rarityRule(r).label,
      percent: p.weights[r] / 100,
    })),
  };
}
