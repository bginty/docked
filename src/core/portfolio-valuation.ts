import type { CreditsState } from "./credits-sandbox";

/** Estimates only: no wallet, salary, settlement or cash-conversion input. */
export const portfolioValuationPolicy = {
  version: "completed-credit-sales-median-v1",
  days: 30,
  minimumSales: 3,
  minimumBuyers: 2,
  minimumSellers: 2,
} as const;

export function portfolioValuation(
  s: CreditsState,
  member: string,
  now: number,
  hiddenCards: string[] = [],
) {
  const policy = portfolioValuationPolicy;
  const cutoff = now - policy.days * 86400000;
  const hidden = new Set(hiddenCards);
  const key = (id: string) => {
    const c = s.economy?.instances[id];
    return c && c.rarity !== "CORE"
      ? JSON.stringify([c.definition, c.rarityVersion, c.presentation])
      : null;
  };
  type Sale = { price: number; at: number; buyer: string; seller: string };
  // One latest sale per physical card prevents repeated flips inflating coverage.
  const latest = new Map<string, Sale>();
  const journals = new Map(s.journal.map((j) => [j.reason, j]));
  for (const [id, l] of Object.entries(s.listings)) {
    if (
      l.status !== "SOLD" ||
      l.privateOffer ||
      !l.buyer ||
      l.buyer === l.member ||
      hidden.has(l.card) ||
      !key(l.card)
    )
      continue;
    const transfer = s.cards[l.card]?.history.find(
      (h) => h.reference === id && h.from === l.member && h.to === l.buyer,
    );
    const journal = journals.get(`Sale ${id}: 7.5% seller commission`);
    if (
      !transfer ||
      !journal ||
      transfer.at < cutoff ||
      transfer.at > now ||
      journal.at !== transfer.at
    )
      continue;
    const price = -journal.lines
      .filter(
        (line) =>
          line.credits < 0 &&
          s.lots[line.account.split(":")[1]]?.member === l.buyer,
      )
      .reduce((sum, line) => sum + line.credits, 0);
    if (
      !Number.isSafeInteger(price) ||
      price <= 0 ||
      price !== l.price ||
      (l.receipt &&
        (l.receipt.price !== price || l.receipt.reference !== journal.id))
    )
      continue;
    if (!latest.has(l.card) || latest.get(l.card)!.at < transfer.at)
      latest.set(l.card, {
        price,
        at: transfer.at,
        buyer: l.buyer,
        seller: l.member,
      });
  }
  const groups = new Map<string, Sale[]>();
  for (const [id, sale] of latest) {
    const k = key(id)!;
    groups.set(k, [...(groups.get(k) ?? []), sale]);
  }
  const estimates = new Map<
    string,
    { credits: number; sales: number; lastSaleAt: number }
  >();
  for (const [k, sales] of groups) {
    if (
      sales.length < policy.minimumSales ||
      new Set(sales.map((x) => x.buyer)).size < policy.minimumBuyers ||
      new Set(sales.map((x) => x.seller)).size < policy.minimumSellers
    )
      continue;
    const prices = sales.map((x) => x.price).sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    const credits =
      prices.length % 2
        ? prices[mid]
        : Number((BigInt(prices[mid - 1]) + BigInt(prices[mid]) + 1n) / 2n);
    estimates.set(k, {
      credits,
      sales: sales.length,
      lastSaleAt: Math.max(...sales.map((x) => x.at)),
    });
  }
  const cards = Object.keys(s.cards)
    .filter(
      (id) =>
        s.commerce.cards[id]?.owner === member &&
        (!s.economy?.instances[id] ||
          !!s.economy.packs[s.economy.instances[id].source]?.openedAt),
    )
    .map((id) => ({ id, estimate: estimates.get(key(id) ?? "") ?? null }));
  const valuedCards = cards.filter((c) => c.estimate !== null).length;
  const sum = cards.reduce((n, c) => n + BigInt(c.estimate?.credits ?? 0), 0n);
  return {
    policy,
    asOf: now,
    currency: "test Docked Credits" as const,
    estimatedCredits:
      valuedCards && sum <= BigInt(Number.MAX_SAFE_INTEGER)
        ? Number(sum)
        : null,
    totalCards: cards.length,
    valuedCards,
    unvaluedCards: cards.length - valuedCards,
    cards,
  };
}
export type PortfolioValuation = ReturnType<typeof portfolioValuation>;
