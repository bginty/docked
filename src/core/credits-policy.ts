import { packProducts } from "./pack-products";
export const creditsPolicy = {
  version: "credits-sandbox-2026-10-11-v1",
  approval: "PROPOSED_SANDBOX_ONLY",
  currency: "AUD",
  creditsPerDollar: 100,
  liveEnabled: false,
  commissionBps: 750,
  rounding: "half-up-whole-credit",
  swapFeeEach: 50,
  // Examples, not owner-approved eligibility, limits or withdrawal conditions.
  spendingOrder: ["promotional", "competition", "sale", "purchased"],
  purchasedWithdrawable: true,
  promotionalWithdrawable: false,
  resale: "preserve-funding-restriction-and-propagate-through-swaps",
  minimumWithdrawal: 100,
  payoutFee: 0,
  clearingMs: 0,
  bonus: { version: "example-one-per-product-v1", maxPerMemberProduct: 1 },
  campaignLimit: 10000,
  products: packProducts.map((p) => ({
    ...p,
    priceCredits: p.priceCents,
    supplyApproved: false,
  })),
} as const;
export function sellerQuote(price: number) {
  if (!Number.isSafeInteger(price) || price < 1 || price > 1_000_000_000)
    throw Error("Invalid integer credit price");
  const fee = Number((BigInt(price) * 750n + 5000n) / 10000n);
  return { price, fee, net: price - fee, policy: creditsPolicy.version };
}
