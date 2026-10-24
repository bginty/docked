import test from "node:test";
import assert from "node:assert/strict";
import { assertCreditSalesOnly } from "../../src/core/credit-sales-only";
import { memberTestCommand } from "../../src/core/member-test-wallet";
test("Customer API policies reject stale trade requests independent of sport or feature flags", () => {
  for (const kind of [
    "offer",
    "accept",
    "private-offer",
    "private-accept",
    "replace-listing",
  ])
    assert.throws(() => assertCreditSalesOnly({ kind }), /fixed-price/);
  for (const preference of ["swap", "both"])
    assert.throws(
      () =>
        memberTestCommand({
          kind: "list",
          card: "card",
          price: 100,
          preference,
        }),
      /fixed-price/,
    );
  assert.doesNotThrow(() =>
    memberTestCommand({
      kind: "list",
      card: "card",
      price: 100,
      preference: "sell",
    }),
  );
  for (const kind of [
    "buy",
    "review-buy",
    "reprice-listing",
    "cancel-listing",
    "reject",
    "cancel-swap",
    "private-reject",
    "private-cancel",
  ])
    assert.doesNotThrow(() => assertCreditSalesOnly({ kind }));
});
