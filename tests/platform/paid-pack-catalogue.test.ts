import { test } from "node:test";
import assert from "node:assert/strict";
import {
  paidPackCatalogueUpgrade,
  allocateNine,
  validateCardEconomy,
} from "../../src/core/card-economy";
import {
  paidPackOffers,
  paidPackWeights,
} from "../../src/core/paid-pack-catalogue";
import { executeCredits, wallet } from "../../src/core/credits-sandbox";
import { memberTestView, testReceipt } from "../../src/core/member-test-wallet";
import { packFixture, packMember, packNow } from "../fixtures/pack-economy";

function ready() {
  return packFixture();
}
test("catalogue transition preserves issued packs and supply, verifies existing odds, and is repeatable", () => {
  const s = ready(),
    e = s.economy!;
  allocateNine(
    e,
    e.activeProductVersions![0],
    packMember.id,
    "legacy",
    packNow,
    () => 0,
  );
  const old = structuredClone(e),
    products = paidPackCatalogueUpgrade(e, packNow + 1);
  assert.equal(products.length, 6);
  assert.deepEqual(e.packs, old.packs);
  assert.deepEqual(e.instances, old.instances);
  assert.deepEqual(e.definitions, old.definitions);
  for (const [id, p] of Object.entries(old.products))
    assert.deepEqual(e.products[id], p);
  const transitioned = structuredClone(e);
  paidPackCatalogueUpgrade(e, packNow + 100);
  assert.deepEqual(e, transitioned);
  for (const p of products) {
    assert.deepEqual(p.weights, paidPackWeights[p.type]);
    assert.equal(p.duplicatePlayers, "deny");
    assert.deepEqual(p.positions, ["QB", "RB", "WR", "TE"]);
  }
  const other = ready().economy!;
  other.products[other.activeProductVersions![0]].weights.RARE--;
  other.products[other.activeProductVersions![0]].weights.ELITE++;
  const before = structuredClone(other);
  assert.throws(() => paidPackCatalogueUpgrade(other, packNow), /odds differ/);
  assert.deepEqual(other, before);
});
for (const offer of paidPackOffers)
  test(`${offer.name}: exact charge/count, saved terms, replay, no Core and immutable configuration`, () => {
    let s = ready();
    paidPackCatalogueUpgrade(s.economy!, packNow);
    const command = {
      kind: "buy-pack",
      product: offer.id,
      configuration: offer.id,
      expectedPrice: offer.priceCredits,
      confirmed: true,
      policy: s.policy.version,
    };
    assert.throws(
      () =>
        executeCredits(
          s,
          packMember,
          "stale",
          { ...command, expectedPrice: offer.priceCredits + 1 },
          packNow,
        ),
      /price changed/,
    );
    const before = wallet(s, packMember.id).spendable;
    const bought = executeCredits(s, packMember, "purchase", command, packNow);
    assert.deepEqual(
      executeCredits(
        bought.state,
        packMember,
        "purchase",
        command,
        packNow + 1,
      ),
      bought,
    );
    s = bought.state;
    assert.equal(
      wallet(s, packMember.id).spendable,
      before - offer.priceCredits,
    );
    assert.equal(s.economy!.packs.purchase.cards.length, offer.cards);
    assert.equal(
      s.economy!.packs.purchase.product.priceCredits,
      offer.priceCredits,
    );
    const opened = executeCredits(
      s,
      packMember,
      "open",
      { kind: "open-pack", entitlement: "purchase" },
      packNow + 2,
    );
    assert.deepEqual(
      executeCredits(
        opened.state,
        packMember,
        "open",
        { kind: "open-pack", entitlement: "purchase" },
        packNow + 3,
      ),
      opened,
    );
    const receipt = testReceipt(opened.state, "purchase", packMember.id);
    assert.equal(receipt.cards.length, offer.cards);
    assert.ok(receipt.cards.every((c) => c.tier !== "CORE"));
    assert.equal(
      memberTestView(opened.state, packMember.id, [], false, packNow + 3)
        .packs[0].cardCount,
      offer.cards,
    );
    s.economy!.products[offer.id].priceCredits++;
    assert.throws(() => validateCardEconomy(s.economy!), /immutable/);
  });
test("unfulfillable one/three/nine card packs leave balances and supply unchanged", () => {
  for (const offer of paidPackOffers) {
    const s = ready();
    paidPackCatalogueUpgrade(s.economy!, packNow);
    for (const p of Object.values(s.economy!.players)) p.status = "inactive";
    const before = structuredClone(s);
    assert.throws(
      () =>
        executeCredits(
          s,
          packMember,
          "shortage",
          {
            kind: "buy-pack",
            product: offer.id,
            configuration: offer.id,
            expectedPrice: offer.priceCredits,
            confirmed: true,
            policy: s.policy.version,
          },
          packNow,
        ),
      /insufficient/,
    );
    assert.deepEqual(s, before);
  }
});
