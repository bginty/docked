/** Immutable offers. New prices/odds require a new version, never an edit. */
export const paidCatalogueVersion = "nfl-paid-sizes-v4";
export const paidPackWeights = {
  PREMIUM: { RARE: 0, ELITE: 0, ULTRA_RARE: 9000, LEGENDARY: 990, ICON: 10 },
  STANDARD: {
    RARE: 8500,
    ELITE: 1200,
    ULTRA_RARE: 250,
    LEGENDARY: 49,
    ICON: 1,
  },
} as const;
export const paidPackOffers = (
  [
    ["PREMIUM", 9, 5000],
    ["PREMIUM", 3, 1900],
    ["PREMIUM", 1, 700],
    ["STANDARD", 9, 700],
    ["STANDARD", 3, 300],
    ["STANDARD", 1, 100],
  ] as const
).map(([type, cards, priceCredits]) => ({
  id: `${type.toLowerCase()}-${cards}-${paidCatalogueVersion}`,
  type,
  cards,
  priceCredits,
  name: `${type === "PREMIUM" ? "Premium" : "Standard"} ${cards} Pack`,
}));

export function prizePackProduct(mode: "SALARY_CAP" | "OPEN") {
  return paidPackOffers.find(
    (p) =>
      p.cards === 9 && p.type === (mode === "OPEN" ? "PREMIUM" : "STANDARD"),
  )!.id;
}
