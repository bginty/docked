import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialMemberTestCredits,
  memberTestView,
  memberTestCommand,
  assertMemberTestEconomy,
  barryGrantReference,
  testReceipt,
} from "../../src/core/member-test-wallet";
import { executeCredits, wallet } from "../../src/core/credits-sandbox";
const owner = { id: "owner", role: "reviewer", aal: "aal2" } as const;
const barry = { id: "barry", role: "member" } as const;
test("one-time 100000 test grant, purchases, replay, private projection and non-redemption", () => {
  let s = initialMemberTestCredits();
  const grant = {
    kind: "promotion",
    member: barry.id,
    amount: 100000,
    campaign: "owner-barry-100000-v1",
    reason:
      "Owner explicitly authorised one-time 100000 TEST Docked Credits; no cash value",
    confirmed: true,
    redeemable: false,
  };
  s = executeCredits(s, owner, barryGrantReference, grant, 1000).state;
  s = executeCredits(s, owner, barryGrantReference, grant, 1001).state;
  assert.equal(wallet(s, barry.id).available, 100000);
  assert.equal(wallet(s, barry.id).withdrawable, 0);
  for (const [kind, extra] of [
    [
      "promotion",
      {
        member: "barry",
        amount: 1,
        campaign: "bad",
        reason: "Malicious attempt",
        confirmed: true,
        redeemable: false,
      },
    ],
    [
      "withdraw",
      {
        amount: 100,
        beneficiary: "bank",
        policy: s.policy.version,
        confirmed: true,
      },
    ],
    ["deposit", { product: "premium-single-v1" }],
  ] as const)
    assert.throws(() => memberTestCommand({ kind, ...extra }));
  const buy = memberTestCommand({
    kind: "buy-pack",
    product: "premium-single-v1",
    policy: s.policy.version,
    confirmed: true,
  });
  s = executeCredits(s, barry, "purchase", buy, 2000).state;
  s = executeCredits(s, barry, "purchase", buy, 2001).state;
  assert.equal(wallet(s, barry.id).available, 95100);
  const pack = Object.keys(s.entitlements)[0];
  s = executeCredits(
    s,
    barry,
    "open",
    { kind: "open-pack", entitlement: pack },
    3000,
  ).state;
  const r = testReceipt(s, pack, barry.id);
  assert.equal(r.cards.length, 1);
  s = executeCredits(
    s,
    barry,
    "reopen",
    { kind: "open-pack", entitlement: pack },
    4000,
  ).state;
  assert.deepEqual(testReceipt(s, pack, barry.id), r);
  assert.throws(() => testReceipt(s, pack, "stranger"));
  const outsider = memberTestView(s, "stranger", []);
  assert.equal(outsider.wallet.available, 0);
  assert.deepEqual(outsider.packs, []);
  assert.deepEqual(outsider.cards, []);
  assert.deepEqual(outsider.history, []);
  assert.equal(outsider.ownerReport, null);
  assertMemberTestEconomy(s);
  s.lots[Object.keys(s.lots)[0]].redeemable = true;
  assert.throws(() => assertMemberTestEconomy(s));
});
test("test-card resale and swaps cannot create redeemable balances", () => {
  let s = initialMemberTestCredits();
  for (const id of ["alice", "bob"]) {
    s = executeCredits(
      s,
      owner,
      "grant-" + id,
      {
        kind: "promotion",
        member: id,
        amount: 50000,
        campaign: "campaign-" + id,
        reason: "Isolated test allocation only",
        confirmed: true,
        redeemable: false,
      },
      1000,
    ).state;
    const m = { id, role: "member" } as const;
    s = executeCredits(
      s,
      m,
      "buy-" + id,
      {
        kind: "buy-pack",
        product: "premium-single-v1",
        policy: s.policy.version,
        confirmed: true,
      },
      2000,
    ).state;
    s = executeCredits(
      s,
      m,
      "open-" + id,
      { kind: "open-pack", entitlement: "buy-" + id },
      3000,
    ).state;
  }
  const a = { id: "alice", role: "member" } as const,
    b = { id: "bob", role: "member" } as const;
  const cards = Object.keys(s.cards);
  s = executeCredits(
    s,
    a,
    "offer",
    {
      kind: "offer",
      other: "bob",
      give: [cards[0]],
      take: [cards[1]],
      feeEach: 50,
    },
    4000,
  ).state;
  s = executeCredits(
    s,
    b,
    "accept",
    { kind: "accept", swap: "offer" },
    4500,
  ).state;
  s = executeCredits(
    s,
    b,
    "list",
    { kind: "list", card: cards[0], price: 1000 },
    5000,
  ).state;
  s = executeCredits(
    s,
    a,
    "sale",
    {
      kind: "buy",
      listing: "list",
      expectedPrice: 1000,
      policy: s.policy.version,
      confirmed: true,
    },
    6000,
  ).state;
  assertMemberTestEconomy(s);
  assert.equal(wallet(s, "alice").withdrawable, 0);
  assert.equal(wallet(s, "bob").withdrawable, 0);
});
