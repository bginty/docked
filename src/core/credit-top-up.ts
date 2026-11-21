import { paidPackOffers } from "./paid-pack-catalogue";

export function selectedCreditPack(key?: string) {
  return paidPackOffers.find((p) => p.type + "-" + p.cards === key);
}

// All approved products cost one AUD cent per credit. Minimise paid credits,
// breaking ties by the number of separate, customer-confirmed checkouts.
export function creditTopUpPlan(
  cost: number,
  balance: number,
  available: number[],
) {
  if (
    !Number.isSafeInteger(balance) ||
    balance < 0 ||
    !paidPackOffers.some((p) => p.priceCredits === cost)
  )
    return null;
  const need = Math.max(0, cost - balance);
  if (!need) return { amounts: [] as number[], remaining: balance - cost };
  const sizes = [...new Set(available)].filter(
    (n) => Number.isSafeInteger(n) && n > 0 && n <= 9900,
  );
  if (!sizes.length) return null;
  const plans = new Map<number, number[]>([[0, []]]);
  const max = need + Math.max(...sizes) - 1;
  for (let total = 0; total <= max; total++) {
    const plan = plans.get(total);
    if (!plan) continue;
    if (total >= need) return { amounts: plan, remaining: total - need };
    for (const size of sizes) {
      const next = total + size;
      const existing = plans.get(next);
      if (!existing || existing.length > plan.length + 1)
        plans.set(next, [...plan, size]);
    }
  }
  return null;
}
