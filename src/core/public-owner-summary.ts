import type { Operations } from "./owner-operations";

export type PublicOwnerSummary = {
  days: { day: string; customers: number; sales: number; refunds: number }[];
  verified: number;
  outstanding: number;
  chargeTax: number | null;
  pending: number;
  packs: { sport: string; type: string; total: number }[];
  support: number;
  moderation: number;
  sms: { budget: number; reserved: number; expires: string } | null;
};
export function raritySupply(inventory: Operations["inventory"]) {
  const totals = new Map<
    string,
    { tier: string; issued: number; cards: number; remaining: number }
  >();
  for (const row of inventory) {
    const group = totals.get(row.tier) ?? {
      tier: row.tier,
      issued: 0,
      cards: 0,
      remaining: 0,
    };
    group.issued += Number(row.issued);
    group.cards += Number(row.cards);
    group.remaining += Number(row.available_lifetime_supply);
    totals.set(row.tier, group);
  }
  return Array.from(totals.values());
}
