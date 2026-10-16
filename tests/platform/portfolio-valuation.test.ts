import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  marketplaceFixture,
  marketActors,
} from "../fixtures/marketplace-state";
import { executeCredits } from "../../src/core/credits-sandbox";
import { portfolioValuation } from "../../src/core/portfolio-valuation";
const now = 1792065600000;
function salesFixture() {
  let s = marketplaceFixture(now);
  const ids: string[] = [];
  for (const [i, price] of [100, 201, 999, 200].entries()) {
    const seller = marketActors[i % 2],
      buyer = marketActors[(i % 2) + 1];
    const card = Object.keys(s.cards).find(
      (id) => s.commerce.cards[id].owner === seller.id && !ids.includes(id),
    )!;
    ids.push(card);
    const listing = randomUUID();
    s = executeCredits(
      s,
      seller,
      listing,
      { kind: "list", card, price },
      now,
    ).state;
    s = executeCredits(
      s,
      buyer,
      randomUUID(),
      {
        kind: "buy",
        listing,
        expectedPrice: s.listings[listing].price,
        policy: s.policy.version,
        confirmed: true,
      },
      now,
    ).state;
  }
  // Isolated comparable-series fixture. Ownership/receipts above use the real settlement engine.
  const first = s.economy!.instances[ids[0]];
  for (const id of ids)
    Object.assign(s.economy!.instances[id], {
      definition: first.definition,
      rarity: first.rarity,
      rarityVersion: first.rarityVersion,
      presentation: first.presentation,
    });
  return { s, ids };
}
test("portfolio uses completed comparable sales, integer median and owner-only coverage", () => {
  const { s, ids } = salesFixture();
  const p = portfolioValuation(s, marketActors[1].id, now);
  for (const c of p.cards)
    assert.equal(s.commerce.cards[c.id].owner, marketActors[1].id);
  const estimate = p.cards.find((c) => c.id === ids[0])!.estimate!;
  assert.equal(estimate.credits, 201); // half-up median of 200 and 201; outlier restrained
  assert.equal(estimate.sales, 4);
  assert.ok(p.unvaluedCards > 0);
  assert.equal(
    p.estimatedCredits,
    p.cards.reduce((n, c) => n + (c.estimate?.credits ?? 0), 0),
  );
});
test("insufficient, hidden, stale, future, private and incomplete sales remain unvalued", () => {
  for (const reason of [
    "hidden",
    "old",
    "future",
    "private",
    "transfer",
    "journal",
    "buyer",
    "edition",
  ]) {
    const { s, ids } = salesFixture();
    for (const l of Object.values(s.listings)) {
      if (reason === "private") l.privateOffer = "private-fixture";
      if (reason === "buyer") l.buyer = l.member;
    }
    if (reason === "transfer") for (const id of ids) s.cards[id].history = [];
    if (reason === "journal") s.journal = [];
    if (reason === "edition")
      ids.forEach(
        (id, i) => (s.economy!.instances[id].presentation = `different-${i}`),
      );
    const p = portfolioValuation(
      s,
      marketActors[1].id,
      reason === "old"
        ? now + 31 * 86400000
        : reason === "future"
          ? now - 1
          : now,
      reason === "hidden" ? ids : [],
    );
    assert.equal(p.estimatedCredits, null, reason);
    assert.equal(p.valuedCards, 0, reason);
  }
});
test("asking prices and unopened packs do not create values or reveal contents", () => {
  const s = marketplaceFixture(now),
    member = marketActors[0].id;
  assert.equal(portfolioValuation(s, member, now).estimatedCredits, null);
  for (const p of Object.values(s.economy!.packs))
    if (p.member === member) p.openedAt = null;
  assert.equal(portfolioValuation(s, member, now).cards.length, 0);
});
