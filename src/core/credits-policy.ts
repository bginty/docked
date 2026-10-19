import { packProducts } from "./pack-products";
export const creditsPolicy = {
  version: "credits-sandbox-2026-10-11-v1",
  approval: "PROPOSED_SANDBOX_ONLY",
  currency: "AUD",
  creditsPerDollar: 100,
  liveEnabled: false,
  commissionBps: 500,
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
export const saleFeePolicy = "credit-sale-5pct-cap2000-v2";
export function sellerQuote(price: number) {
  if (!Number.isSafeInteger(price) || price < 1 || price > 1_000_000_000)
    throw Error("Invalid integer credit price");
  const fee = Math.min(2000, Number((BigInt(price) * 5n + 50n) / 100n));
  return { price, fee, net: price - fee, policy: saleFeePolicy };
}

/** Owner-approved 16 Oct 2026: combined offers charge the higher of the
 * existing credit commission or the applicable per-member swap fee. Cards
 * have no invented valuation. The credit component must cover the fee. */
export function combinedOfferQuote(price: number, swapFeeMinimum: number) {
  if (!Number.isSafeInteger(swapFeeMinimum) || swapFeeMinimum < 0)
    throw Error("Invalid swap fee minimum");
  const quote = sellerQuote(price);
  const fee = Math.max(quote.fee, swapFeeMinimum);
  if (fee > price)
    throw Error(`Offer at least ${fee} credits to cover the combined fee`);
  return {
    ...quote,
    fee,
    net: price - fee,
    minimumFee: swapFeeMinimum,
    feePolicy: "credit-commission-floor-v1" as const,
  };
}
