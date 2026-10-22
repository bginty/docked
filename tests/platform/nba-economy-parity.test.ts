import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  allocateNine,
  prepareNbaTestProducts,
  validateCardEconomy,
  type EconomyPlayer,
} from "../../src/core/card-economy";
import {
  executeCredits,
  validateCredits,
  wallet,
} from "../../src/core/credits-sandbox";
import { testCard, testReceipt } from "../../src/core/member-test-wallet";
import { marketplaceView, marketQuery } from "../../src/core/marketplace";
import { executePrivateOffer } from "../../src/core/private-card-offers";
import { packAvailability } from "../../src/core/pack-availability";
import {
  marketplaceFixture,
  marketActors,
  marketLabels,
} from "../fixtures/marketplace-state";

const now = 1792620000000;
function fixture() {
  const state = marketplaceFixture(now);
  const economy = state.economy!;
  const products = prepareNbaTestProducts(economy, now);
  for (let i = 0; i < 30; i++) {
    const id = `nba-fixture-${i}`;
    economy.players[id] = {
      id,
      provider: "fixture",
      providerId: id,
      synthetic: true,
      name: `Synthetic NBA Player ${i}`,
      sport: "basketball",
      assetKind: "player",
      position: ["PG", "SG", "SF", "PF", "C"][i % 5],
      currentTeam: "Test City",
      status: "active",
      observedAt: now,
      sourceRevision: "isolated-v1",
      presentation: "docked-basketball-v1",
    } satisfies EconomyPlayer;
  }
  return { state, products };
}
function enabled() {
  const f = fixture();
  f.state.economy!.nbaTestAllocation!.enabled = true;
  f.state.economy!.activeProductVersions!.push(...f.products.map((p) => p.id));
  return f;
}
function purchased() {
  const { state: initial, products } = enabled();
  let state = initial;
  const product = products.find((p) => p.type === "STANDARD")!;
  const command = {
    kind: "buy-pack",
    product: product.id,
    configuration: product.version,
    policy: state.policy.version,
    confirmed: true,
  };
  const first = executeCredits(
    state,
    marketActors[0],
    "nba-purchase",
    command,
    now,
  );
  state = first.state;
  assert.deepEqual(
    executeCredits(state, marketActors[0], "nba-purchase", command, now + 1),
    first,
  );
  state = executeCredits(
    state,
    marketActors[0],
    "nba-open",
    { kind: "open-pack", entitlement: "nba-purchase" },
    now + 1,
  ).state;
  return { state, card: state.economy!.packs["nba-purchase"].cards[0] };
}
test("NBA preparation is additive, disabled, idempotent and does not touch NFL or wallets", () => {
  const state = marketplaceFixture(now),
    before = structuredClone(state);
  const products = prepareNbaTestProducts(state.economy!, now);
  assert.deepEqual(
    products.map((p) => [p.type, p.cards, p.priceCredits]),
    [
      ["PREMIUM", 9, 5000],
      ["STANDARD", 9, 700],
    ],
  );
  for (const [id, p] of Object.entries(before.economy!.products))
    assert.deepEqual(state.economy!.products[id], p);
  assert.deepEqual(state.economy!.instances, before.economy!.instances);
  assert.deepEqual(state.lots, before.lots);
  assert.deepEqual(state.journal, before.journal);
  assert.deepEqual(prepareNbaTestProducts(state.economy!, now + 100), products);
  assert.equal(
    packAvailability(state.economy!, products[0], now).availabilityReason,
    "NBA test packs have not been enabled.",
  );
  assert.throws(
    () => allocateNine(state.economy!, products[0].id, "a", "blocked", now),
    /unavailable/,
  );
});
test("NBA gate cannot allocate real or unmarked player records and failures are atomic", () => {
  const { state, products } = enabled(),
    economy = state.economy!;
  for (const p of Object.values(economy.players))
    if (p.sport === "basketball") p.synthetic = false;
  const before = structuredClone(economy);
  assert.throws(
    () => allocateNine(economy, products[0].id, "a", "fail", now),
    /insufficient/,
  );
  assert.deepEqual(economy, before);
});
test("NBA prices, odds, sport and Core exclusion cannot be changed through product metadata", () => {
  const { state, products } = fixture();
  for (const mutate of [
    (p: (typeof products)[number]) => {
      p.priceCredits = 1;
    },
    (p: (typeof products)[number]) => {
      p.weights.CORE = 10000;
    },
    (p: (typeof products)[number]) => {
      p.guaranteedSlots["0"] = "CORE";
    },
    (p: (typeof products)[number]) => {
      p.positions = ["QB"];
    },
  ]) {
    const e = structuredClone(state.economy!);
    mutate(e.products[products[0].id]);
    assert.throws(() => validateCardEconomy(e));
  }
});
test("both NBA packs use nine distinct players, preserve supply and render basketball without scoring multipliers", () => {
  for (const type of ["STANDARD", "PREMIUM"]) {
    const { state, products } = enabled(),
      e = state.economy!;
    const product = products.find((p) => p.type === type)!;
    const nfl = structuredClone(Object.values(e.instances));
    const pack = allocateNine(e, product.id, "a", type, now, () => 0);
    assert.equal(pack.cards.length, 9);
    assert.equal(
      new Set(pack.cards.map((id) => e.instances[id].playerId)).size,
      9,
    );
    assert.ok(
      pack.cards.every((id) =>
        type === "PREMIUM"
          ? e.instances[id].rarity === "ULTRA_RARE"
          : e.instances[id].rarity === "RARE",
      ),
    );
    for (const c of nfl) assert.deepEqual(e.instances[c.id], c);
    validateCardEconomy(e);
  }
  const { state, card } = purchased();
  assert.equal(testCard(state, card).sport, "basketball");
  assert.equal(testCard(state, card).multiplier, 1);
  assert.equal(
    testReceipt(state, "nba-purchase", marketActors[0].id).cards.length,
    9,
  );
  assert.equal(wallet(state, marketActors[0].id).spendable, 8400);
  validateCredits(state);
});
test("NBA public sale reuses shared wallet, immutable serial, fees, filters and replay protection", () => {
  const { state: initial, card } = purchased();
  let state = initial;
  const serial = structuredClone(state.economy!.instances[card]);
  const buyer = marketActors[1],
    seller = marketActors[0];
  const before = [
    wallet(state, seller.id).spendable,
    wallet(state, buyer.id).spendable,
  ];
  state = executeCredits(
    state,
    seller,
    "nba-list",
    { kind: "list", card, price: 1000 },
    now + 2,
  ).state;
  const view = (sport: string) =>
    marketplaceView(
      state,
      buyer.id,
      marketLabels,
      marketQuery.parse({ sport }),
      undefined,
      now + 3,
    );
  assert.equal(view("basketball").rows.length, 1);
  assert.equal(view("nfl").rows.length, 0);
  assert.throws(() =>
    executeCredits(
      state,
      seller,
      "self",
      {
        kind: "buy",
        listing: "nba-list",
        expectedPrice: 1000,
        policy: state.policy.version,
        confirmed: true,
      },
      now + 3,
    ),
  );
  const command = {
    kind: "buy",
    listing: "nba-list",
    expectedPrice: 1000,
    policy: state.policy.version,
    confirmed: true,
  };
  const sale = executeCredits(state, buyer, "nba-sale", command, now + 3);
  state = sale.state;
  assert.deepEqual(
    executeCredits(state, buyer, "nba-sale", command, now + 4),
    sale,
  );
  assert.equal(wallet(state, seller.id).spendable, before[0] + 950);
  assert.equal(wallet(state, buyer.id).spendable, before[1] - 1000);
  assert.deepEqual(state.economy!.instances[card], serial);
  assert.equal(state.commerce.cards[card].owner, buyer.id);
  assert.throws(() =>
    executeCredits(state, marketActors[2], "second", command, now + 4),
  );
  validateCredits(state);
});
test("NBA private offers use the existing settlement engine without new wallet or ownership systems", () => {
  const { state: initial, card } = purchased();
  let state = initial;
  const permission = { allowed: true, minimum: null };
  const offer = randomUUID(),
    accept = randomUUID();
  state = executePrivateOffer(
    state,
    marketActors[1],
    offer,
    { kind: "private-offer", card, price: 1000 },
    now + 2,
    permission,
  ).state;
  const sale = executePrivateOffer(
    state,
    marketActors[0],
    accept,
    { kind: "private-accept", offer },
    now + 3,
    permission,
  );
  assert.equal(sale.state.commerce.cards[card].owner, marketActors[1].id);
  const retry = executePrivateOffer(
    sale.state,
    marketActors[0],
    accept,
    { kind: "private-accept", offer },
    now + 4,
    permission,
  );
  assert.deepEqual(retry.state, sale.state);
  assert.deepEqual(retry.result, sale.result);
  validateCredits(sale.state);
});
