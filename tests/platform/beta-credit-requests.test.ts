import { test } from "node:test";
import assert from "node:assert/strict";
import {
  betaCreditRequestMutation,
  betaCreditRequestStatus,
} from "../../src/core/beta-credit-requests";
const valid = {
  action: "request",
  requestId: "11111111-1111-4111-8111-111111111111",
  recipient: "22222222-2222-4222-8222-222222222222",
  amount: 100,
  reason: "Isolated requested test allocation",
  confirmed: true,
};
test("beta credit request is bounded, explicitly confirmed, and cannot contain execution or redeemable fields", () => {
  assert.ok(betaCreditRequestMutation.safeParse(valid).success);
  for (const changed of [
    { amount: 0 },
    { amount: 1.2 },
    { amount: 1000000001 },
    { confirmed: false },
    { reason: "short" },
    { redeemable: true },
    { execute: true },
    { policy: "approved" },
    { recipient: "member" },
  ])
    assert.equal(
      betaCreditRequestMutation.safeParse({ ...valid, ...changed }).success,
      false,
    );
  for (const status of Object.values(betaCreditRequestStatus))
    assert.match(status, /credits not issued/);
});
