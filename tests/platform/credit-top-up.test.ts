import test from "node:test";
import assert from "node:assert/strict";
import {
  creditTopUpPlan,
  selectedCreditPack,
} from "../../src/core/credit-top-up";
test("minimum Play outlay uses only available products and the spendable wallet", () => {
  const tiers = [700, 1900, 4900, 9900];
  assert.deepEqual(creditTopUpPlan(700, 0, tiers), {
    amounts: [700],
    remaining: 0,
  });
  assert.deepEqual(creditTopUpPlan(1900, 0, tiers), {
    amounts: [1900],
    remaining: 0,
  });
  assert.deepEqual(creditTopUpPlan(700, 800, tiers), {
    amounts: [],
    remaining: 100,
  });
  assert.deepEqual(creditTopUpPlan(5000, 4900, tiers), {
    amounts: [700],
    remaining: 600,
  });
  const minimum = creditTopUpPlan(5000, 0, tiers)!;
  assert.equal(minimum.remaining, 200);
  assert.equal(minimum.amounts.length, 4);
  assert.deepEqual(creditTopUpPlan(700, 0, [4900, 9900]), {
    amounts: [4900],
    remaining: 4200,
  });
  assert.equal(creditTopUpPlan(700, 0, []), null);
  assert.equal(creditTopUpPlan(700, -1, tiers), null);
  assert.equal(selectedCreditPack("STANDARD-9")?.priceCredits, 700);
  assert.equal(selectedCreditPack("10000"), undefined);
});
