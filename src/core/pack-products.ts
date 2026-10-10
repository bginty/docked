export const packProducts = [
  {
    id: "premium-single-v1",
    name: "Premium Single-Card Pack",
    priceCents: 4900,
    currency: "AUD",
    cards: 1,
    advertisedTier: "Premium",
    inventoryTier: null,
  },
  {
    id: "elite-single-v1",
    name: "Elite Single-Card Pack",
    priceCents: 9900,
    currency: "AUD",
    cards: 1,
    advertisedTier: "Elite",
    inventoryTier: "ELITE",
  },
] as const;
export const commerceReadiness = {
  liveCharges: false,
  hostedSandboxCheckout: false,
  withdrawals: false,
  selectionMethod: null,
  taxTreatment: null,
  bankDetails: null,
  playerRightsApproved: false,
  policyApproved: false,
} as const;
