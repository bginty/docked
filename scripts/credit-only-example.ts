// Reproducible fictional funding example; never touches hosted state or providers.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { creditsFixture, alice, bob, owner, provider } from "./credits-fixture";
import { newCreditOnly } from "../src/core/credit-only";
import {
  executeCredits,
  financialReport,
  wallet,
} from "../src/core/credits-sandbox";
import type { Operator } from "../src/core/commerce-sandbox";
let s = creditsFixture(),
  n = 0;
s.creditOnly = newCreditOnly();
const at = Date.now();
const run = (a: Operator, c: unknown, id = `example${++n}`) => {
  s = executeCredits(s, a, id, c, at).state;
};
s.commerce.cards.example = {
  owner: alice.id,
  tier: "RARE",
  sport: "nfl",
  reserved: null,
};
s.cards.example = {
  version: 1,
  restricted: false,
  locked: false,
  history: [
    {
      from: null,
      to: alice.id,
      at,
      reference: "synthetic-resale-eligible-fixture",
    },
  ],
};
run(bob, { kind: "credit-deposit", cents: 1000 }, "deposit");
run(provider, { kind: "bind", deposit: "deposit", providerOrder: "PP" });
run(provider, {
  kind: "capture",
  deposit: "deposit",
  providerOrder: "PP",
  capture: "CAP",
  event: "E",
  amount: 1000,
  currency: "AUD",
  verified: true,
  merchant: "SYNTHETIC_MERCHANT",
});
run(provider, { kind: "clear", deposit: "deposit" });
run(provider, {
  kind: "settlement",
  deposit: "deposit",
  reference: "BANK",
  net: 1000,
  fees: 0,
  verified: true,
});
const steps = [
  {
    step: "Simulated buyer deposit A$10, confirmed and settled; no provider fee in this example",
    buyer: wallet(s, bob.id).total,
    seller: wallet(s, alice.id).total,
    fees: 0,
  },
];
run(alice, { kind: "list", card: "example", price: 1000 }, "first");
run(bob, {
  kind: "buy",
  listing: "first",
  expectedPrice: 1000,
  policy: s.policy.version,
  confirmed: true,
});
steps.push({
  step: "Buyer purchases card for 1000; seller gets 925; commission 75",
  buyer: wallet(s, bob.id).total,
  seller: wallet(s, alice.id).total,
  fees: financialReport(s).commission,
});
run(bob, { kind: "list", card: "example", price: 900 }, "resale");
run(alice, {
  kind: "buy",
  listing: "resale",
  expectedPrice: 900,
  policy: s.policy.version,
  confirmed: true,
});
steps.push({
  step: "Buyer resells the same card for 900: receives 832; half-up fee 68. No new funding/issuance",
  buyer: wallet(s, bob.id).total,
  seller: wallet(s, alice.id).total,
  fees: financialReport(s).commission,
});
run(bob, { kind: "kyc-start", session: "K" });
run(
  { id: "synthetic-identity", role: "identity-provider" },
  {
    kind: "kyc-event",
    member: bob.id,
    session: "K",
    event: "KE",
    revision: 1,
    state: "VERIFIED",
    expires: at + 86400000,
  },
);
run(owner, {
  kind: "beneficiary",
  member: bob.id,
  beneficiary: "BEN",
  verified: true,
  reason: "Synthetic beneficiary for worked example",
});
run(
  bob,
  {
    kind: "withdraw",
    amount: 832,
    beneficiary: "BEN",
    policy: s.policy.version,
    confirmed: true,
  },
  "W",
);
run(owner, {
  kind: "withdraw-review",
  withdrawal: "W",
  action: "approve",
  reason: "Simulation only; no actual payout rail",
});
run(provider, { kind: "payout-submit", withdrawal: "W", provider: "OUT" });
run(provider, {
  kind: "payout-result",
  withdrawal: "W",
  provider: "OUT",
  event: "DONE",
  status: "PAID",
  verified: true,
});
const r = financialReport(s);
assert.equal(r.completedWithdrawals, 832);
assert.equal(r.circulation.issued, 1000);
assert.equal(r.circulation.outstanding, 25);
assert.equal(r.commission, 143);
assert.equal(r.simulatedProviderCash, 168);
steps.push({
  step: "Simulated payout 832 (A$8.32) extinguishes reservation once. Remaining 168 = 25 member liability + 143 commission",
  buyer: wallet(s, bob.id).total,
  seller: wallet(s, alice.id).total,
  fees: r.commission,
});
writeFileSync(
  "docs/qa/credit-only/worked-example.json",
  JSON.stringify(
    {
      at: new Date(at).toISOString(),
      scope:
        "Disposable simulation; resale-eligible fixture, not beta card payout eligibility; no real provider/payment",
      steps,
      circulation: r.circulation,
      simulatedPayout: 832,
      simulatedCashRemaining: 168,
      funding: r.fundingLots,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ passed: true, steps, circulation: r.circulation }),
);
