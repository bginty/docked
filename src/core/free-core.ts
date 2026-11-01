/** Eligibility is projected by the server for one saved round rule. It never
 * establishes collectible ownership and never grants marketplace permissions. */
export type FreeCoreEligibility = {
  inventory_source?: string;
  collectible_owned?: boolean;
  eligible_competition_ids?: string[];
};
export function isFreeCore(card: FreeCoreEligibility) {
  return card.inventory_source === "public-free-core-v1";
}
export function eligibleInRound(
  card: FreeCoreEligibility,
  competition?: string,
) {
  return (
    (!isFreeCore(card) && card.eligible_competition_ids === undefined) ||
    (!!competition &&
      card.eligible_competition_ids?.includes(competition) === true)
  );
}
export function collectibleInventory<T extends FreeCoreEligibility>(
  cards: T[],
): T[] {
  return cards.filter(
    (card) => !isFreeCore(card) && card.collectible_owned !== false,
  );
}
