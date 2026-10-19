import { test } from "node:test";
import assert from "node:assert/strict";
import {
  executeCredits,
  wallet,
  financialReport,
  validateCredits,
  type CreditsState,
} from "../../src/core/credits-sandbox";
import {
  newCreditOnly,
  creditsFromAudCents,
  swapFeeQuote,
} from "../../src/core/credit-only";
import {
  creditsFixture,
  alice,
  bob,
  owner,
  provider,
} from "../../scripts/credits-fixture";
import type { Operator } from "../../src/core/commerce-sandbox";
import { sellerQuote } from "../../src/core/credits-policy";
const now = 1791800000000;
function harness() {
  let s = creditsFixture(),
    n = 0;
  s.creditOnly = newCreditOnly();
  const run = (a: Operator, c: unknown, key = `c${++n}`, time = now) => {
    const x = executeCredits(s, a, key, c, time);
    s = x.state;
    return x.result as any;
  };
  const deposit = (a: Operator, amount = 1000, key = `d${++n}`) => {
    run(a, { kind: "credit-deposit", cents: amount }, key);
    run(provider, { kind: "bind", deposit: key, providerOrder: `PP${key}` });
    const capture = {
      kind: "capture",
      deposit: key,
      event: `E${key}`,
      providerOrder: `PP${key}`,
      capture: `C${key}`,
      amount,
      currency: "AUD",
      verified: true,
      merchant: "SYNTHETIC_MERCHANT",
    };
    run(provider, capture);
    run(provider, { kind: "clear", deposit: key });
    return { key, capture };
  };
  const card = (a: Operator, id: string, restricted = false) => {
    s.commerce.cards[id] = {
      owner: a.id,
      reserved: null,
      sport: "nfl",
      tier: "RARE",
    };
    s.cards[id] = {
      version: 1,
      restricted,
      locked: false,
      history: [
        { from: null, to: a.id, reference: "isolated-fixture", at: now },
      ],
    };
  };
  const sell = (
    seller: Operator,
    buyer: Operator,
    id: string,
    price: number,
  ) => {
    const ref = `listing${++n}`;
    run(seller, { kind: "list", card: id, price }, ref);
    return run(buyer, {
      kind: "buy",
      listing: ref,
      expectedPrice: price,
      policy: s.policy.version,
      confirmed: true,
    });
  };
  const verify = (a: Operator) => {
    s.commerce.kyc[a.id] = {
      state: "VERIFIED",
      expires: now + 86400000,
      revision: 1,
      session: "synthetic",
    } as any;
    run(owner, {
      kind: "beneficiary",
      member: a.id,
      beneficiary: a.id,
      verified: true,
      reason: "Synthetic test beneficiary only",
    });
  };
  return {
    run,
    deposit,
    card,
    sell,
    verify,
    get s() {
      return s;
    },
  };
}
test("confirmed funding, not redirects; merchant/amount/reference, exact cents, receivable and settlement fees", () => {
  const h = harness();
  assert.equal(creditsFromAudCents(100), 100);
  assert.throws(() => creditsFromAudCents(1.2));
  h.run(alice, { kind: "credit-deposit", cents: 1000 }, "first");
  assert.throws(
    () => h.run(bob, { kind: "credit-deposit", cents: 1000 }, "first"),
    /already in use/,
  );
  assert.equal(h.s.deposits.first.member, alice.id);
  assert.equal(wallet(h.s, alice.id).total, 0);
  h.run(provider, { kind: "bind", deposit: "first", providerOrder: "PPfirst" });
  const c = {
    kind: "capture",
    deposit: "first",
    providerOrder: "PPfirst",
    capture: "CAP",
    event: "E",
    amount: 1000,
    currency: "AUD",
    verified: true,
    merchant: "SYNTHETIC_MERCHANT",
  };
  assert.throws(() => h.run(alice, c), /payment service/);
  assert.throws(() => h.run(provider, { ...c, merchant: "WRONG" }), /merchant/);
  h.run(provider, c);
  h.run(provider, { ...c, event: "E2" });
  assert.equal(wallet(h.s, alice.id).pending, 1000);
  assert.equal(wallet(h.s, alice.id).spendable, 0);
  assert.equal(financialReport(h.s).providerReceivable, 1000);
  assert.equal(financialReport(h.s).simulatedProviderCash, 0);
  h.run(provider, { kind: "clear", deposit: "first" });
  assert.equal(wallet(h.s, alice.id).available, 1000);
  assert.equal(wallet(h.s, alice.id).withdrawable, 0);
  const settlement = {
    kind: "settlement",
    deposit: "first",
    reference: "BANK1",
    net: 970,
    fees: 30,
    verified: true,
  };
  assert.throws(() => h.run(provider, { ...settlement, net: 999 }), /match/);
  h.run(provider, settlement);
  h.run(provider, settlement);
  assert.equal(financialReport(h.s).providerReceivable, 0);
  assert.equal(financialReport(h.s).settledNetReceipts, 970);
  assert.equal(financialReport(h.s).processingFees, 30);
  assert.equal(wallet(h.s, alice.id).available, 1000);
  assert.equal(Object.keys(h.s.entitlements).length, 0);
});
test("FIFO transfer provenance survives multiple resales; 1000 = 950 seller + 50 fee; no new issuance", () => {
  const h = harness();
  const funding = h.deposit(bob, 1000);
  h.card(alice, "card1");
  h.card(bob, "card2");
  h.sell(alice, bob, "card1", 1000);
  assert.equal(wallet(h.s, alice.id).available, 950);
  assert.equal(wallet(h.s, bob.id).available, 0);
  assert.equal(financialReport(h.s).commission, 50);
  assert.equal(financialReport(h.s).confirmedGrossPayments, 1000);
  h.sell(bob, alice, "card2", 900);
  const roots = Object.values(h.s.lots).filter((l) => l.category === "sale");
  assert.ok(
    roots.every(
      (l) => l.provenance === `payment:C${funding.key}` && l.parentLot,
    ),
  );
  assert.equal(financialReport(h.s).circulation.issued, 1000);
  assert.equal(financialReport(h.s).circulation.difference, 0);
  h.run(provider, {
    kind: "refund-event",
    deposit: funding.key,
    event: "REF",
    cumulativeRefund: 1000,
    dispute: true,
    reason: "Synthetic chargeback after multiple resales",
  });
  assert.equal(wallet(h.s, alice.id).withdrawable, 0);
  assert.equal(wallet(h.s, bob.id).withdrawable, 0);
  assert.equal(h.s.commerce.cards.card1.owner, bob.id);
  assert.equal(h.s.commerce.cards.card2.owner, alice.id);
  assert.equal(financialReport(h.s).eligibleSimulatedBacking, 0);
});
test("withdrawal reserves once, unknown stays reserved, paid extinguishes once; refunds block reserved funding", () => {
  const h = harness();
  const d = h.deposit(bob, 1000);
  h.card(alice, "card");
  h.sell(alice, bob, "card", 1000);
  h.verify(alice);
  h.run(provider, {
    kind: "settlement",
    deposit: d.key,
    reference: "BANK",
    net: 1000,
    fees: 0,
    verified: true,
  });
  const cmd = {
    kind: "withdraw",
    amount: 950,
    beneficiary: alice.id,
    confirmed: true,
    policy: h.s.policy.version,
  };
  h.run(alice, cmd, "W");
  h.run(alice, cmd, "W");
  assert.equal(wallet(h.s, alice.id).reserved, 950);
  assert.equal(wallet(h.s, alice.id).spendable, 0);
  h.run(owner, {
    kind: "withdraw-review",
    withdrawal: "W",
    action: "approve",
    reason: "Synthetic payout review approval",
  });
  h.run(provider, {
    kind: "payout-submit",
    withdrawal: "W",
    provider: "PAYOUT",
  });
  h.run(provider, {
    kind: "payout-result",
    withdrawal: "W",
    provider: "PAYOUT",
    event: "UNKNOWN",
    status: "UNCERTAIN",
    verified: true,
  });
  assert.throws(
    () =>
      h.run(owner, {
        kind: "withdraw-review",
        withdrawal: "W",
        action: "cancel",
        reason: "Do not cancel an unknown payout",
      }),
    /uncertain/,
  );
  h.run(provider, {
    kind: "payout-result",
    withdrawal: "W",
    provider: "PAYOUT",
    event: "PAID",
    status: "PAID",
    verified: true,
  });
  h.run(provider, {
    kind: "payout-result",
    withdrawal: "W",
    provider: "PAYOUT",
    event: "PAID2",
    status: "PAID",
    verified: true,
  });
  assert.equal(wallet(h.s, alice.id).total, 0);
  assert.equal(financialReport(h.s).completedWithdrawals, 950);
  assert.equal(financialReport(h.s).simulatedProviderCash, 50);
  validateCredits(h.s);
  const g = harness();
  const x = g.deposit(bob);
  g.card(alice, "c");
  g.sell(alice, bob, "c", 1000);
  g.verify(alice);
  g.run(alice, cmd, "W");
  g.run(provider, {
    kind: "refund-event",
    deposit: x.key,
    event: "DISPUTE",
    cumulativeRefund: 0,
    dispute: true,
    reason: "Disputed original funding, reserve held",
  });
  assert.throws(
    () =>
      g.run(owner, {
        kind: "withdraw-review",
        withdrawal: "W",
        action: "approve",
        reason: "Must reject disputed source funding",
      }),
    /Funding review/,
  );
  assert.equal(wallet(g.s, alice.id).reserved, 950);
});
test("free window zero-balance atomic swap; expiry cannot increase fee without fresh consent", () => {
  const h = harness();
  h.card(alice, "a");
  h.card(bob, "b");
  const window = {
    kind: "swap-window",
    start: now + 1,
    end: now + 1000,
    reason: "Isolated zero-fee window acceptance",
  };
  assert.throws(() => h.run(alice, window), /MFA/);
  h.run(owner, window);
  const offer = {
    kind: "offer",
    other: bob.id,
    give: ["a"],
    take: ["b"],
    feeEach: 0,
  };
  assert.throws(() => h.run(alice, offer, "early", now), /fee changed/);
  h.run(alice, offer, "O", now + 1);
  assert.throws(
    () => h.run(bob, { kind: "accept", swap: "O" }, "late", now + 1000),
    /fee increased/,
  );
  h.run(bob, { kind: "accept", swap: "O", feeEach: 0 }, "ok", now + 500);
  assert.equal(h.s.swaps.O.completedFeeEach, 0);
  assert.equal(financialReport(h.s).swapFees, 0);
  assert.equal(h.s.commerce.cards.a.owner, bob.id);
  assert.equal(h.s.commerce.cards.b.owner, alice.id);
  assert.equal(swapFeeQuote(h.s.creditOnly, 50, now + 1000).free, false);
});
test("whole-credit half-up conserves value; mismatches and unbacked grants are visible", () => {
  for (let p = 1; p < 10000; p++) {
    const q = sellerQuote(p);
    assert.equal(q.net + q.fee, p);
  }
  assert.equal(sellerQuote(20).fee, 1);
  assert.equal(sellerQuote(1).fee, 0);
  const h = harness();
  h.deposit(alice);
  h.run(owner, {
    kind: "reconcile",
    balance: 123,
    fees: 0,
    reserves: 0,
    reference: "WRONG",
  });
  assert.equal(financialReport(h.s).reconciliationDifference, 123);
  const bad = structuredClone(h.s) as CreditsState;
  bad.journal[0].lines[0].credits++;
  assert.throws(() => validateCredits(bad), /integrity/);
  assert.equal(financialReport(h.s).commercialPayments, 0);
});

test("FIFO uses acquisition order, including grants; disputes do not freeze unrelated funded lots", () => {
  const h = harness();
  h.deposit(alice, 1000, "old");
  h.run(
    owner,
    {
      kind: "promotion",
      member: alice.id,
      amount: 500,
      campaign: "new",
      reason: "Dedicated later test grant for FIFO",
      redeemable: false,
      confirmed: true,
    },
    "grant",
    now + 1,
  );
  h.card(bob, "sale");
  h.sell(bob, alice, "sale", 1000);
  const sold = Object.values(h.s.lots).find((l) => l.category === "sale")!;
  assert.equal(sold.provenance, "payment:Cold");
  assert.equal(wallet(h.s, alice.id).spendable, 500);
  h.run(provider, {
    kind: "refund-event",
    deposit: "old",
    event: "DISPUTE",
    cumulativeRefund: 0,
    dispute: true,
    reason: "Only original funding disputed in test",
  });
  assert.equal(wallet(h.s, alice.id).spendable, 500);
  assert.equal(wallet(h.s, bob.id).withdrawable, 0);
});

test("acceptor's stale free quote cannot incur fee; failed balance check leaves both cards unchanged", () => {
  const h = harness();
  h.deposit(alice);
  h.deposit(bob);
  h.card(alice, "a");
  h.card(bob, "b");
  h.run(
    alice,
    { kind: "offer", other: bob.id, give: ["a"], take: ["b"], feeEach: 50 },
    "O",
  );
  assert.throws(
    () => h.run(bob, { kind: "accept", swap: "O", feeEach: 0 }),
    /fee changed/,
  );
  assert.equal(h.s.commerce.cards.a.owner, alice.id);
  assert.equal(financialReport(h.s).swapFees, 0);
  h.run(bob, { kind: "accept", swap: "O", feeEach: 50 });
  assert.equal(financialReport(h.s).swapFees, 100);
});

test("unused purchased withdrawals remain disabled; legacy entitlements survive policy activation", () => {
  const h = harness();
  h.deposit(alice);
  h.verify(alice);
  assert.throws(
    () =>
      h.run(alice, {
        kind: "withdraw",
        amount: 1,
        beneficiary: alice.id,
        confirmed: true,
        policy: h.s.policy.version,
      }),
    /Insufficient/,
  );
  let legacy = creditsFixture();
  legacy = executeCredits(
    legacy,
    alice,
    "old",
    { kind: "deposit", product: "premium-single-v1" },
    now,
  ).state;
  const originalOrder = structuredClone(legacy.commerce.orders.old);
  legacy = executeCredits(
    legacy,
    owner,
    "upgrade",
    {
      kind: "credit-only-policy",
      reason: "Add policy; preserve all original entitlements",
    },
    now,
  ).state;
  assert.deepEqual(legacy.commerce.orders.old, originalOrder);
  legacy = executeCredits(
    legacy,
    provider,
    "bind",
    { kind: "bind", deposit: "old", providerOrder: "PPold" },
    now,
  ).state;
  legacy = executeCredits(
    legacy,
    provider,
    "cap",
    {
      kind: "capture",
      deposit: "old",
      providerOrder: "PPold",
      capture: "CAPold",
      event: "Eold",
      amount: 4900,
      currency: "AUD",
      verified: true,
    },
    now,
  ).state;
  legacy = executeCredits(
    legacy,
    provider,
    "clear",
    { kind: "clear", deposit: "old" },
    now,
  ).state;
  legacy = executeCredits(
    legacy,
    alice,
    "open",
    { kind: "open-pack", entitlement: "old" },
    now,
  ).state;
  assert.equal(legacy.entitlements.old.status, "OPENED");
  assert.throws(
    () =>
      executeCredits(
        legacy,
        alice,
        "new",
        { kind: "deposit", product: "elite-single-v1" },
        now,
      ),
    /retired/,
  );
});
