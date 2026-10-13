import { initialCredits } from "../src/core/credits-sandbox";
import type { Operator } from "../src/core/commerce-sandbox";
export const alice: Operator = { id: "synthetic-alice", role: "member" };
export const bob: Operator = { id: "synthetic-bob", role: "member" };
export const owner: Operator = {
  id: "synthetic-owner",
  role: "reviewer",
  aal: "aal2",
};
export const provider: Operator = {
  id: "synthetic-provider",
  role: "payment-provider",
};
export function creditsFixture(units = 20) {
  const s = initialCredits();
  // Existing legacy entitlement acceptance retains its original policy.
  delete s.creditOnly;
  for (const p of s.policy.products) {
    const pool = Array.from({ length: units }, (_, i) => `${p.id}-${i}`);
    s.commerce.products[p.id] = {
      tier: p.inventoryTier,
      cents: p.priceCredits,
      pool,
      method: "random",
      sport: "nfl",
    };
    for (const card of pool)
      s.commerce.cards[card] = {
        tier: p.inventoryTier,
        sport: "nfl",
        owner: null,
        reserved: null,
      };
  }
  // No real member identifiers, documents, cards or provider credentials.
  return s;
}
