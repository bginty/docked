import test from "node:test";
import assert from "node:assert/strict";
import {
  storePackFixture,
  storePackReceipt,
  settleFixture,
  buyFixturePack,
  packMember,
  packNow,
} from "../fixtures/store-pack-lifecycle";
import {
  executeCredits,
  wallet,
  validateCredits,
  creditBalances,
} from "../../src/core/credits-sandbox";
import {
  testReceipt,
  memberTestView,
  memberTestCommand,
  assertMemberTestEconomy,
} from "../../src/core/member-test-wallet";
import { paidPackOffers } from "../../src/core/paid-pack-catalogue";

for (const sport of ["nfl", "afl", "nrl"] as const) {
  for (const offer of paidPackOffers)
    test(`${sport} ${offer.name}: verified credit receipt → exact pack → open → refund after spend`, () => {
      let state = storePackFixture(sport);
      const receipt = storePackReceipt();
      const p = Object.values(state.economy!.products).find(
        (p) =>
          state.economy!.activeProductVersions!.includes(p.id) &&
          p.sport === sport &&
          p.type === offer.type &&
          p.cards === offer.cards,
      )!;
      assert.ok(p);
      assert.equal(wallet(state, packMember.id).total, 0);
      state = settleFixture(state, receipt);
      assertMemberTestEconomy(state);
      const view = memberTestView(
        state,
        packMember.id,
        [],
        false,
        packNow,
        [],
        { catalogue: false },
      );
      assert.equal(view.wallet.spendable, 9900);
      assert.ok(Object.values(state.lots).every((l) => !l.redeemable));
      assert.equal(wallet(state, packMember.id).spendable, 9900);
      state = buyFixturePack(state, p.id);
      assert.equal(
        wallet(state, packMember.id).spendable,
        9900 - offer.priceCredits,
      );
      state = executeCredits(
        state,
        packMember,
        "open",
        { kind: "open-pack", entitlement: "pack" },
        packNow,
      ).state;
      const cards = testReceipt(state, "pack", packMember.id).cards;
      assert.equal(cards.length, offer.cards);
      assert.ok(cards.every((c) => c.sport === sport && c.tier !== "CORE"));
      assert.equal(new Set(cards.map((c) => c.id)).size, cards.length);
      const inventory = structuredClone(state.commerce.cards);
      const supply = structuredClone(state.economy!.definitions);
      const savedPack = structuredClone(state.economy!.packs.pack);
      state = settleFixture(state, { ...receipt, state: "REVOKED" });
      assert.equal(
        wallet(state, packMember.id).available,
        9900 - offer.priceCredits,
      );
      assert.equal(
        wallet(state, packMember.id).spendable,
        0,
        "unresolved refunded funding must not be spent again",
      );
      assert.ok(
        Object.values(state.cases).some(
          (c) => c.member === packMember.id && c.status === "OPEN",
        ),
      );
      assert.deepEqual(
        state.commerce.cards,
        inventory,
        "refund does not confiscate or recreate issued cards",
      );
      assert.deepEqual(state.economy!.definitions, supply);
      assert.deepEqual(state.economy!.packs.pack, savedPack);
      assert.equal(creditBalances(state)["system:recovery-review"], -9900);
      assert.throws(() => buyFixturePack(state, p.id, "after-refund"));
      const stable = structuredClone(state);
      state = settleFixture(state, { ...receipt, state: "REVOKED" });
      state = settleFixture(state, receipt);
      assert.deepEqual(state, stable);
      validateCredits(state);
      assertMemberTestEconomy(state);
    });
}

test("member wallet accepts only verified TEST provenance, never client claims or real deposits", () => {
  const settled = settleFixture(storePackFixture(), storePackReceipt());
  const key = Object.keys(settled.deposits)[0];
  const without = structuredClone(settled);
  delete without.storeTestDeposits;
  assert.throws(() => assertMemberTestEconomy(without), /Test-only/);
  const tampered = structuredClone(settled);
  tampered.storeTestDeposits![key].credits++;
  assert.throws(() => assertMemberTestEconomy(tampered), /provenance/);
  const redeemable = structuredClone(settled);
  redeemable.lots[redeemable.deposits[key].lot!].redeemable = true;
  assert.throws(() => assertMemberTestEconomy(redeemable), /provenance/);
  assert.throws(() =>
    memberTestCommand({
      kind: "credit-deposit",
      cents: 9900,
      storeTestDeposits: settled.storeTestDeposits,
    }),
  );
});

test("refund after transfer preserves recipient ownership and locked fantasy card metadata", () => {
  const receipt = storePackReceipt();
  let s = settleFixture(storePackFixture(), receipt);
  const p = Object.values(s.economy!.products).find(
    (p) => p.cards === 3 && p.type === "STANDARD",
  )!;
  s = buyFixturePack(s, p.id);
  s = executeCredits(
    s,
    packMember,
    "open",
    { kind: "open-pack", entitlement: "pack" },
    packNow,
  ).state;
  const [card, locked] = s.economy!.packs.pack.cards;
  const other = { id: "synthetic-buyer", role: "member" } as const;
  s = settleFixture(s, storePackReceipt("buyer", 4900), other.id);
  s = executeCredits(
    s,
    packMember,
    "listing",
    { kind: "list", card, price: 1000 },
    packNow,
  ).state;
  s = executeCredits(
    s,
    other,
    "review",
    { kind: "review-buy", listing: "listing" },
    packNow,
  ).state;
  s = executeCredits(
    s,
    other,
    "buy",
    {
      kind: "buy",
      listing: "listing",
      review: "review",
      expectedPrice: 1000,
      policy: s.policy.version,
      confirmed: true,
    },
    packNow,
  ).state;
  s.cards[locked].locked = true; // Isolated saved-lock fixture; no competition is entered.
  const before = structuredClone({
    cards: s.cards,
    ownership: s.commerce.cards,
    packs: s.economy!.packs,
    listings: s.listings,
  });
  s = settleFixture(s, { ...receipt, state: "CANCELLED" });
  assert.deepEqual(
    {
      cards: s.cards,
      ownership: s.commerce.cards,
      packs: s.economy!.packs,
      listings: s.listings,
    },
    before,
  );
  assert.equal(s.commerce.cards[card].owner, other.id);
  assert.equal(wallet(s, other.id).available, 3900);
  assert.equal(
    wallet(s, packMember.id).spendable,
    950,
    "unrelated buyer-funded sale proceeds are not silently seized",
  );
  validateCredits(s);
});

test("failed pack fulfilment preserves verified credits; full unspent refund reverses exactly once", () => {
  const receipt = storePackReceipt();
  let s = settleFixture(storePackFixture(), receipt);
  const product = s.economy!.activeProductVersions![0];
  Object.values(s.economy!.players).forEach((p) => (p.status = "inactive"));
  const unchanged = structuredClone(s);
  assert.throws(() => buyFixturePack(s, product), /insufficient/);
  assert.deepEqual(s, unchanged);
  s = settleFixture(s, { ...receipt, state: "CANCELLED" });
  assert.equal(wallet(s, packMember.id).available, 0);
  assert.equal(Object.keys(s.economy!.instances).length, 0);
  validateCredits(s);
});

test("refund before opening preserves the already-issued entitlement without issuing another pack", () => {
  const receipt = storePackReceipt();
  let s = settleFixture(storePackFixture("afl"), receipt);
  const product = s.economy!.activeProductVersions![0];
  s = buyFixturePack(s, product);
  const before = structuredClone({
    entitlements: s.entitlements,
    packs: s.economy!.packs,
    instances: s.economy!.instances,
  });
  s = settleFixture(s, { ...receipt, state: "REVOKED" });
  assert.deepEqual(
    {
      entitlements: s.entitlements,
      packs: s.economy!.packs,
      instances: s.economy!.instances,
    },
    before,
  );
  assert.equal(wallet(s, packMember.id).spendable, 0);
  assert.ok(Object.values(s.cases).some((c) => c.status === "OPEN"));
  validateCredits(s);
});

test("declined or pending Google receipts cannot fund any paid pack", () => {
  for (const status of ["CANCELLED", "PENDING"] as const) {
    let s = storePackFixture("nrl");
    s = settleFixture(s, { ...storePackReceipt(), state: status });
    assert.equal(wallet(s, packMember.id).spendable, 0);
    assert.throws(() =>
      buyFixturePack(s, s.economy!.activeProductVersions![0]),
    );
    assert.equal(Object.keys(s.economy!.instances).length, 0);
    validateCredits(s);
  }
});
