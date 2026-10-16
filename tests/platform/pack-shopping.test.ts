import { test } from "node:test";
import assert from "node:assert/strict";
import {
  packBalance,
  packTab,
  newestPacks,
} from "../../src/core/pack-presentation";
import { executeCredits, wallet } from "../../src/core/credits-sandbox";
import { memberTestView } from "../../src/core/member-test-wallet";
import { packFixture, packMember, packNow } from "../fixtures/pack-economy";
test("review arithmetic, safe pack tabs and stable newest-first history", () => {
  assert.equal(packBalance(25000, 1800), 23200);
  assert.throws(() => packBalance(2.5, 1));
  assert.equal(packTab("?packs=mine", ""), "mine");
  assert.equal(packTab("?packs=unknown", "#pack-history"), "history");
  assert.deepEqual(
    newestPacks([
      { id: "b", purchasedAt: null },
      { id: "old", purchasedAt: 10 },
      { id: "new", purchasedAt: 20 },
      { id: "a", purchasedAt: null },
    ]).map((p) => p.id),
    ["new", "old", "a", "b"],
  );
});
test("stale purchase review cannot charge a different price; confirmed retry issues once", () => {
  const state = packFixture(),
    before = structuredClone(state);
  const product = memberTestView(
    state,
    packMember.id,
    [],
    false,
    packNow,
  ).products.find((p) => p.tier === "PREMIUM")!;
  const command = {
    kind: "buy-pack",
    product: product.id,
    configuration: product.version,
    expectedPrice: product.price - 1,
    confirmed: true,
    policy: state.policy.version,
  };
  assert.throws(
    () => executeCredits(state, packMember, "review", command, packNow + 1),
    /price/i,
  );
  assert.deepEqual(state, before);
  command.expectedPrice = product.price;
  const bought = executeCredits(
    state,
    packMember,
    "review",
    command,
    packNow + 1,
  );
  assert.deepEqual(
    executeCredits(bought.state, packMember, "review", command, packNow + 2),
    bought,
  );
  assert.equal(
    wallet(bought.state, packMember.id).spendable,
    25000 - product.price,
  );
  assert.equal(Object.keys(bought.state.economy!.instances).length, 9);
});
