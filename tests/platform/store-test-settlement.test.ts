import test from "node:test";
import assert from "node:assert/strict";
import { creditsFixture, alice } from "../../scripts/credits-fixture";
import { newCreditOnly } from "../../src/core/credit-only";
import { wallet, validateCredits } from "../../src/core/credits-sandbox";
import { settleStoreTestReceipt } from "../../src/server/store-test-settlement";
import type { StoreReceipt } from "../../src/server/store-purchase-verification";
test("store test settlement reuses one wallet; pending, retries, refunds and stale notifications cannot duplicate credits", () => {
  let state = creditsFixture();
  state.creditOnly = newCreditOnly();
  const receipt: StoreReceipt = {
    provider: "google",
    key: "synthetic-only",
    account: "bound-fixture",
    environment: "test",
    state: "PENDING",
    product: {
      id: "isolated-credit-test",
      scope: "account",
      credits: 100,
      version: "fixture",
    },
  };
  const apply = (r: StoreReceipt) =>
    settleStoreTestReceipt(state, r, alice.id, receipt.account, 1793400000000);
  assert.equal(apply(receipt).state, state);
  const balance = wallet(state, alice.id);
  receipt.state = "PURCHASED";
  state = apply(receipt).state;
  validateCredits(state);
  const after = JSON.stringify(state);
  state = apply(receipt).state;
  assert.equal(JSON.stringify(state), after);
  assert.notDeepEqual(wallet(state, alice.id), balance);
  assert.throws(() =>
    settleStoreTestReceipt(
      state,
      receipt,
      "other",
      receipt.account,
      1793400000000,
    ),
  );
  receipt.state = "REVOKED";
  state = apply(receipt).state;
  validateCredits(state);
  const refunded = JSON.stringify(state);
  state = apply(receipt).state;
  assert.equal(JSON.stringify(state), refunded);
  receipt.state = "PURCHASED";
  assert.equal(apply(receipt).finish, false);
  assert.equal(JSON.stringify(apply(receipt).state), refunded);
});
