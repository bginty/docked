import { test } from "node:test";
import assert from "node:assert/strict";
import {
  executeCredits,
  wallet,
  validateCredits,
  financialReport,
} from "../../src/core/credits-sandbox";
import { sellerQuote, creditsPolicy } from "../../src/core/credits-policy";
import {
  creditsFixture,
  alice,
  bob,
  owner,
  provider,
} from "../../scripts/credits-fixture";
import type { Operator } from "../../src/core/commerce-sandbox";
const now = 1791676800000,
  premium = "premium-single-v1",
  elite = "elite-single-v1";
function harness(units = 20) {
  let state = creditsFixture(units),
    seq = 0;
  const run = (actor: Operator, c: unknown, ref = `r${++seq}`, at = now) => {
    const n = executeCredits(state, actor, ref, c, at);
    state = n.state;
    return n.result as any;
  };
  const deposit = (who = alice, product = premium, ref = `d${++seq}`) => {
    run(who, { kind: "deposit", product }, ref);
    run(provider, { kind: "bind", deposit: ref, providerOrder: `PP${ref}` });
    const amount = product === premium ? 4900 : 9900;
    const capture = {
      kind: "capture",
      deposit: ref,
      event: `EV${ref}`,
      providerOrder: `PP${ref}`,
      capture: `CAP${ref}`,
      amount,
      currency: "AUD",
      verified: true,
    };
    run(provider, capture);
    run(provider, { kind: "clear", deposit: ref });
    return { ref, capture };
  };
  return {
    run,
    deposit,
    get state() {
      return state;
    },
  };
}
test("AUD deposits grant exact credits plus unopened bonus; duplicate captures, clears, openings and pack purchases", () => {
  const h = harness();
  const d = h.deposit();
  h.deposit(alice, elite);
  assert.equal(wallet(h.state, alice.id).available, 14800);
  h.run(provider, { ...d.capture, event: "another-event" });
  h.run(provider, { kind: "clear", deposit: d.ref });
  assert.equal(wallet(h.state, alice.id).total, 14800);
  const opened = h.run(alice, { kind: "open-pack", entitlement: d.ref });
  assert.deepEqual(
    h.run(alice, { kind: "open-pack", entitlement: d.ref }),
    opened,
  );
  assert.equal(h.state.cards[opened.card].history.length, 1);
  const p = h.run(
    alice,
    {
      kind: "buy-pack",
      product: premium,
      confirmed: true,
      policy: creditsPolicy.version,
    },
    "pack1",
  );
  assert.equal(wallet(h.state, alice.id).available, 9900);
  assert.equal(Object.keys(h.state.entitlements).length, 3);
  assert.equal(h.state.entitlements[p.entitlement].status, "SEALED");
  assert.equal(Object.keys(h.state.deposits).length, 2);
  assert.throws(
    () => h.run(alice, { kind: "deposit", product: premium }),
    /promotion limit/,
  );
  validateCredits(h.state);
  assert.equal(financialReport(h.state).packRevenue, 4900);
});
test("inventory exhaustion, late capture and cancellation never silently substitute cards or accept client price", () => {
  const h = harness(1);
  const d = h.deposit();
  assert.throws(
    () => h.run(bob, { kind: "deposit", product: premium }),
    /supply/,
  );
  assert.throws(() =>
    h.run(alice, { kind: "deposit", product: elite, amount: 1 }),
  );
  h.run(bob, { kind: "deposit", product: elite }, "late");
  h.run(provider, { kind: "bind", deposit: "late", providerOrder: "PPlate" });
  h.run(
    provider,
    {
      kind: "capture",
      deposit: "late",
      event: "lateev",
      providerOrder: "PPlate",
      capture: "latecap",
      amount: 9900,
      currency: "AUD",
      verified: true,
    },
    "latecap",
    now + 31 * 60000,
  );
  assert.equal(h.state.deposits.late.status, "REVIEW");
  assert.equal(wallet(h.state, bob.id).total, 0);
  assert.equal(h.state.entitlements[d.ref].status, "SEALED");
});
test("seller commission uses exact integer half-up and sales preserve provenance/restricted resale", () => {
  assert.deepEqual(
    [1, 6, 7, 20, 100, 4900, 9900].map((p) => sellerQuote(p).fee),
    [0, 0, 1, 2, 8, 368, 743],
  );
  const h = harness();
  const a = h.deposit();
  h.deposit(bob, elite);
  const card = h.run(alice, { kind: "open-pack", entitlement: a.ref }).card;
  h.run(alice, { kind: "list", card, price: 100 }, "listing");
  assert.throws(() =>
    h.run(alice, {
      kind: "buy",
      listing: "listing",
      expectedPrice: 100,
      confirmed: true,
      policy: creditsPolicy.version,
    }),
  );
  h.run(bob, {
    kind: "buy",
    listing: "listing",
    expectedPrice: 100,
    confirmed: true,
    policy: creditsPolicy.version,
  });
  assert.equal(wallet(h.state, alice.id).available, 4992);
  assert.equal(wallet(h.state, alice.id).withdrawable, 4900);
  assert.equal(financialReport(h.state).commission, 8);
  assert.equal(h.state.commerce.cards[card].owner, bob.id);
  assert.throws(() =>
    h.run(bob, {
      kind: "buy",
      listing: "listing",
      expectedPrice: 100,
      confirmed: true,
      policy: creditsPolicy.version,
    }),
  );
});
test("swaps reject/cancel free, accept debits 50 each exactly once; stale ownership and locks deny", () => {
  const h = harness();
  const a = h.deposit(),
    b = h.deposit(bob);
  const ca = h.run(alice, { kind: "open-pack", entitlement: a.ref }).card,
    cb = h.run(bob, { kind: "open-pack", entitlement: b.ref }).card;
  const offer = {
    kind: "offer",
    other: bob.id,
    give: [ca],
    take: [cb],
    feeEach: 50,
  };
  h.run(alice, offer, "swap1");
  h.run(bob, { kind: "reject", swap: "swap1" });
  h.run(alice, offer, "swap2");
  h.run(alice, { kind: "cancel-swap", swap: "swap2" });
  assert.equal(wallet(h.state, alice.id).available, 4900);
  h.run(alice, offer, "swap3");
  h.run(alice, offer, "swap4");
  h.run(bob, { kind: "accept", swap: "swap3" }, "accept");
  h.run(bob, { kind: "accept", swap: "swap3" }, "accept");
  assert.equal(wallet(h.state, alice.id).available, 4850);
  assert.equal(wallet(h.state, bob.id).available, 4850);
  assert.equal(financialReport(h.state).swapFees, 100);
  assert.throws(
    () => h.run(bob, { kind: "accept", swap: "swap4" }),
    /Ownership/,
  );
  h.state.cards[cb].locked = true;
  assert.throws(
    () => h.run(alice, { ...offer, give: [cb], take: [ca] }),
    /lineup/,
  );
});
test("insufficient counterparty swap fee rolls back both owners and all fees", () => {
  const h = harness();
  const a = h.deposit(),
    b = h.deposit(bob);
  const ca = h.run(alice, { kind: "open-pack", entitlement: a.ref }).card,
    cb = h.run(bob, { kind: "open-pack", entitlement: b.ref }).card;
  h.run(
    alice,
    { kind: "offer", other: bob.id, give: [ca], take: [cb], feeEach: 50 },
    "swap",
  );
  h.run(bob, {
    kind: "buy-pack",
    product: premium,
    policy: creditsPolicy.version,
    confirmed: true,
  });
  const before = JSON.stringify(h.state);
  assert.throws(
    () => h.run(bob, { kind: "accept", swap: "swap" }),
    /Insufficient/,
  );
  assert.equal(JSON.stringify(h.state), before);
});
test("promotions are restricted, limited, MFA protected; spent reversal becomes review, not negative balance", () => {
  const h = harness();
  const promo = {
    kind: "promotion",
    member: alice.id,
    amount: 4900,
    campaign: "sample",
    reason: "Synthetic marketing campaign",
    confirmed: true,
    redeemable: false,
  };
  assert.throws(() => h.run(alice, promo), /MFA/);
  assert.throws(() => h.run({ ...owner, aal: "aal1" }, promo), /MFA/);
  const p = h.run(owner, promo, "promo");
  assert.equal(wallet(h.state, alice.id).withdrawable, 0);
  h.run(
    alice,
    {
      kind: "buy-pack",
      product: premium,
      policy: creditsPolicy.version,
      confirmed: true,
    },
    "pack",
  );
  const card = h.run(alice, { kind: "open-pack", entitlement: "pack" }).card;
  assert.equal(h.state.cards[card].restricted, true);
  h.run(owner, {
    kind: "reverse",
    journal: p.journal,
    reason: "Correct synthetic promotion award",
  });
  assert.equal(Object.keys(h.state.cases).length, 1);
  assert.equal(wallet(h.state, alice.id).total, 0);
  assert.throws(() => h.run(owner, { ...promo, amount: 6000 }), /limit/);
});
test("funded awards use approved sample schedule, final results, ties and duplicate/correction controls", () => {
  const h = harness();
  const award = {
    kind: "award",
    competition: "sample",
    round: "one",
    sport: "nfl",
    member: alice.id,
    amount: 200,
    revision: 1,
    final: true,
    eligible: true,
    tied: false,
    tiePolicy: "hold",
    schedule: "sample-only-v1",
    approved: true,
    redeemable: true,
    funding: "fund1",
    reason: "Synthetic final competition award",
  };
  assert.throws(() => h.run(owner, award), /backing/);
  h.run(owner, {
    kind: "fund",
    source: "fund1",
    amount: 500,
    approval: "Sandbox backing approved for fixture",
    bankReference: "SYNTHETIC",
  });
  const a = h.run(owner, award);
  h.run(owner, award);
  assert.equal(wallet(h.state, alice.id).available, 200);
  assert.equal(h.state.funding.fund1.remaining, 300);
  assert.throws(
    () => h.run(owner, { ...award, member: bob.id, tied: true }),
    /Tied/,
  );
  h.run(owner, {
    kind: "award-correction",
    award: a.award,
    revision: 2,
    reason: "Official fixture correction example",
  });
  assert.equal(h.state.awards[a.award].status, "REVIEW");
  assert.equal(wallet(h.state, alice.id).available, 200);
});
test("withdrawal KYC, reservation and uncertain payout cannot duplicate, cancel or auto-retry", () => {
  const h = harness();
  h.deposit();
  const w = {
    kind: "withdraw",
    amount: 1000,
    beneficiary: "beneficiary",
    policy: creditsPolicy.version,
    confirmed: true,
  };
  assert.throws(() => h.run(alice, w), /KYC/);
  h.run(alice, { kind: "kyc-start", session: "synthetic-identity" });
  h.run(owner, {
    kind: "kyc-event",
    member: alice.id,
    session: "synthetic-identity",
    event: "identity1",
    revision: 1,
    state: "VERIFIED",
    expires: now + 86400000,
    reason: "Synthetic identity provider fixture",
  });
  h.run(owner, {
    kind: "beneficiary",
    member: alice.id,
    beneficiary: "beneficiary",
    verified: true,
    reason: "Synthetic beneficiary verification",
  });
  h.run(alice, w, "withdrawal");
  assert.equal(wallet(h.state, alice.id).available, 3900);
  assert.equal(wallet(h.state, alice.id).reserved, 1000);
  assert.equal(wallet(h.state, alice.id).total, 4900);
  h.run(owner, {
    kind: "withdraw-review",
    withdrawal: "withdrawal",
    action: "approve",
    reason: "Review synthetic withdrawal",
  });
  h.run(provider, {
    kind: "payout-submit",
    withdrawal: "withdrawal",
    provider: "pay1",
  });
  h.run(provider, {
    kind: "payout-result",
    withdrawal: "withdrawal",
    provider: "pay1",
    event: "payevt1",
    status: "UNCERTAIN",
    verified: true,
  });
  assert.throws(
    () =>
      h.run(provider, {
        kind: "payout-submit",
        withdrawal: "withdrawal",
        provider: "pay2",
      }),
    /reconcile/,
  );
  assert.throws(
    () =>
      h.run(alice, {
        kind: "withdraw-review",
        withdrawal: "withdrawal",
        action: "cancel",
        reason: "Cancel synthetic withdrawal",
      }),
    /Cannot/,
  );
  const paid = {
    kind: "payout-result",
    withdrawal: "withdrawal",
    provider: "pay1",
    event: "payevt2",
    status: "PAID",
    verified: true,
  };
  h.run(provider, paid);
  h.run(provider, paid);
  assert.equal(wallet(h.state, alice.id).reserved, 0);
  assert.equal(wallet(h.state, alice.id).total, 3900);
  assert.equal(financialReport(h.state).simulatedProviderCash, 3900);
});
test("refund after bonus transfer keeps ownership and records recovery; partial refund compensates once", () => {
  const h = harness();
  const a = h.deposit();
  h.run(provider, {
    kind: "refund-event",
    deposit: a.ref,
    event: "refund1",
    cumulativeRefund: 1000,
    dispute: false,
    reason: "Verified synthetic partial refund",
  });
  assert.equal(wallet(h.state, alice.id).total, 3900);
  h.run(provider, {
    kind: "refund-event",
    deposit: a.ref,
    event: "refund2",
    cumulativeRefund: 500,
    dispute: false,
    reason: "Older synthetic refund event",
  });
  assert.equal(wallet(h.state, alice.id).total, 3900);
  assert.throws(
    () => h.run(alice, { kind: "open-pack", entitlement: a.ref }),
    /review/,
  );
  const g = harness();
  const d = g.deposit();
  g.deposit(bob);
  const card = g.run(alice, { kind: "open-pack", entitlement: d.ref }).card;
  g.run(alice, { kind: "list", card, price: 100 }, "list");
  g.run(bob, {
    kind: "buy",
    listing: "list",
    expectedPrice: 100,
    policy: creditsPolicy.version,
    confirmed: true,
  });
  g.run(provider, {
    kind: "refund-event",
    deposit: d.ref,
    event: "refundx",
    cumulativeRefund: 4900,
    dispute: true,
    reason: "Transferred bonus requires recovery review",
  });
  assert.equal(g.state.commerce.cards[card].owner, bob.id);
  assert.equal(Object.keys(g.state.cases).length, 1);
  assert.equal(financialReport(g.state).backingShortfall > 0, true);
});
test("reserved keys, client-supplied prices, fake providers and live mode fail closed", () => {
  const h = harness();
  assert.throws(() =>
    h.run(alice, { kind: "deposit", product: "constructor" }),
  );
  assert.throws(
    () =>
      h.run(alice, {
        kind: "reconcile",
        balance: 1,
        fees: 0,
        reserves: 0,
        reference: "fake",
      }),
    /MFA/,
  );
  assert.throws(
    () =>
      h.run(alice, {
        kind: "capture",
        deposit: "fake",
        event: "fake",
        providerOrder: "fake",
        capture: "fake",
        amount: 4900,
        currency: "AUD",
        verified: true,
      }),
    /service/,
  );
  (h.state as any).mode = "real";
  assert.throws(
    () => h.run(alice, { kind: "deposit", product: premium }),
    /boundary/,
  );
});

test("Pending cumulative full refund compensates all credits; expired reservations release finite supply", () => {
  const h = harness(1);
  h.run(alice, { kind: "deposit", product: premium }, "pending");
  h.run(provider, {
    kind: "bind",
    deposit: "pending",
    providerOrder: "PPpending",
  });
  h.run(provider, {
    kind: "capture",
    deposit: "pending",
    event: "EVpending",
    providerOrder: "PPpending",
    capture: "CAPpending",
    amount: 4900,
    currency: "AUD",
    verified: true,
  });
  h.run(provider, {
    kind: "refund-event",
    deposit: "pending",
    event: "partial",
    cumulativeRefund: 1000,
    dispute: false,
    reason: "Synthetic partial refund before clearing",
  });
  h.run(provider, {
    kind: "refund-event",
    deposit: "pending",
    event: "full",
    cumulativeRefund: 4900,
    dispute: false,
    reason: "Synthetic full refund before clearing",
  });
  assert.equal(wallet(h.state, alice.id).total, 0);
  assert.equal(financialReport(h.state).simulatedProviderCash, 0);
  const g = harness(1);
  g.run(alice, { kind: "deposit", product: premium }, "expire");
  g.run(owner, { kind: "expire-deposits" }, "expirejob", now + 31 * 60000);
  g.run(
    bob,
    { kind: "deposit", product: premium },
    "neworder",
    now + 32 * 60000,
  );
  assert.equal(
    Object.values(g.state.commerce.cards).filter((c) => c.reserved).length,
    1,
  );
});

test("Unspent funded promotion reverses with compensating entries and restores its approved budget", () => {
  const h = harness();
  h.run(owner, {
    kind: "fund",
    source: "fund",
    amount: 1000,
    approval: "Synthetic funding approval",
    bankReference: "TEST",
  });
  const p = h.run(owner, {
    kind: "promotion",
    member: alice.id,
    amount: 500,
    campaign: "test",
    reason: "Synthetic funded promotion",
    confirmed: true,
    redeemable: true,
    funding: "fund",
  });
  h.run(owner, {
    kind: "reverse",
    journal: p.journal,
    reason: "Reverse synthetic funded promotion",
  });
  assert.equal(wallet(h.state, alice.id).total, 0);
  assert.equal(h.state.funding.fund.remaining, 1000);
  assert.throws(
    () =>
      h.run(owner, {
        kind: "reverse",
        journal: p.journal,
        reason: "Repeat compensating reversal",
      }),
    /Already/,
  );
  assert.equal(h.state.journal.length, 3);
});

test("Restricted card value cannot become redeemable through an intermediate pure swap", () => {
  const h = harness();
  const a = h.deposit();
  h.deposit(bob, elite);
  const ca = h.run(alice, { kind: "open-pack", entitlement: a.ref }).card;
  h.run(
    bob,
    {
      kind: "buy-pack",
      product: premium,
      policy: creditsPolicy.version,
      confirmed: true,
    },
    "bought",
  );
  const cb = h.run(bob, { kind: "open-pack", entitlement: "bought" }).card;
  assert.equal(h.state.cards[cb].restricted, false);
  h.run(
    alice,
    { kind: "offer", other: bob.id, give: [ca], take: [cb], feeEach: 50 },
    "offer",
  );
  h.run(bob, { kind: "accept", swap: "offer" });
  assert.equal(h.state.cards[cb].restricted, true);
  h.run(alice, { kind: "list", card: cb, price: 100 }, "list");
  h.run(bob, {
    kind: "buy",
    listing: "list",
    expectedPrice: 100,
    policy: creditsPolicy.version,
    confirmed: true,
  });
  assert.equal(wallet(h.state, alice.id).available, 4942);
  assert.equal(wallet(h.state, alice.id).withdrawable, 4850);
});
