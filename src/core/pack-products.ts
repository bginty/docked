export const packProducts = [
  {
    id: "premium-single-v1",
    name: "Premium Single-Card Pack",
    priceCents: 4900,
    currency: "AUD",
    cards: 1,
    advertisedTier: "Premium",
    inventoryTier: "RARE",
    selectionMethod: "random-disclosed-pool",
    rankingBand: { from: 21, through: 170 },
  },
  {
    id: "elite-single-v1",
    name: "Elite Single-Card Pack",
    priceCents: 9900,
    currency: "AUD",
    cards: 1,
    advertisedTier: "Elite",
    inventoryTier: "ELITE",
    selectionMethod: "random-disclosed-pool",
    rankingBand: { from: 1, through: 20 },
  },
] as const;
/** Player eligibility, not card-unit supply or a fantasy-points multiplier. */
export const packRankingPolicy = {
  version: "docked-scoring-pack-pools-v1",
  basis: "docked-total-points",
  scope: "per-league",
  period: "previous-completed-season",
  editionPool: "frozen",
  boundaryTies: "hold-for-review",
  existingEditions: "preserve",
} as const;
export const commerceReadiness = {
  liveCharges: false,
  hostedSandboxCheckout: false,
  withdrawals: false,
  selectionMethod: "random-disclosed-pool",
  taxTreatment: null,
  bankDetails: null,
  playerRightsApproved: false,
  policyApproved: false,
} as const;
