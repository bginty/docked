type SupplyProduct = {
  cards: number;
  weights: Readonly<Record<string, number>>;
};

/** Matches the existing shop rule: every non-zero rarity must be able to fill
 * every slot with distinct players. Repeat under issuance locks so a direct or
 * stale request cannot buy a product the shop must mark unavailable. No odds are
 * changed or renormalised, and no other rarity substitutes for exhausted supply.
 */
export function hasRequiredPackSupply(
  product: SupplyProduct,
  supply: readonly { rarity: string; players: number }[],
) {
  return Object.entries(product.weights)
    .filter(([, weight]) => weight > 0)
    .every(([rarity]) =>
      supply.some(
        (row) =>
          row.rarity === rarity &&
          Number.isSafeInteger(row.players) &&
          row.players >= product.cards,
      ),
    );
}
