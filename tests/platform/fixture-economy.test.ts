import test from "node:test";
import assert from "node:assert/strict";
import {
  fixtureSports,
  type FixtureSport,
} from "../../src/core/fixture-sports";
import {
  prepareSportTestProducts,
  validateCardEconomy,
  eligibleCatalogue,
} from "../../src/core/card-economy";
import { packAvailability } from "../../src/core/pack-availability";
import {
  executeCredits,
  wallet,
  validateCredits,
} from "../../src/core/credits-sandbox";
import { fixtureCommandScope } from "../../src/core/fixture-commerce";
import { testCard } from "../../src/core/member-test-wallet";
import {
  marketplaceFixture,
  marketActors,
} from "../fixtures/marketplace-state";
const now = 1792620000000;
function setup(sport: FixtureSport) {
  const state = marketplaceFixture(now),
    e = state.economy!,
    spec = fixtureSports[sport];
  const products = prepareSportTestProducts(e, sport, now);
  for (let i = 0; i < 30; i++) {
    const id = `${spec.prefix}-fixture-${i}`;
    e.players[id] = {
      id,
      provider: "fixture",
      providerId: id,
      fixturePlayerId: `stable-${sport}-${i}`,
      synthetic: true,
      sport,
      assetKind: "player",
      name: `Fictional ${spec.label} ${i}`,
      position: spec.positions[i % spec.positions.length],
      currentTeam: "Test City",
      status: "active",
      observedAt: now,
      sourceRevision: "isolated-v1",
      presentation: "generic-test",
    };
  }
  if (sport === "basketball") e.nbaTestAllocation!.enabled = true;
  else e.fixtureTestAllocation![sport]!.enabled = true;
  e.activeProductVersions!.push(...products.map((p) => p.id));
  return { state, products };
}
for (const sport of Object.keys(fixtureSports) as FixtureSport[]) {
  test(`${sport}: immutable fictional catalogue remains usable without claiming a real roster refresh`, () => {
    const { state, products } = setup(sport);
    const later = now + 14 * 86400000;
    const product = products[0];
    assert.equal(eligibleCatalogue(state.economy!, product, later).length, 30);
    assert.equal(
      packAvailability(state.economy!, product, later).available,
      true,
    );
    const nfl = state.economy!.products["standard-nine-seven-test-v2"];
    assert.equal(eligibleCatalogue(state.economy!, nfl, later).length, 0);
    const result = executeCredits(
      state,
      marketActors[0],
      "later-pack",
      {
        kind: "buy-pack",
        product: product.id,
        configuration: product.version,
        policy: state.policy.version,
        confirmed: true,
      },
      later,
    );
    assert.equal(result.state.economy!.packs["later-pack"].cards.length, 9);
  });
  test(`${sport}: both pack families preserve odds, shared wallet and idempotency`, () => {
    for (const type of ["STANDARD", "PREMIUM"]) {
      const fixture = setup(sport),
        products = fixture.products;
      let state = fixture.state;
      const p = products.find((p) => p.type === type)!;
      const nfl = structuredClone(Object.values(state.economy!.instances));
      const before = wallet(state, marketActors[0].id).spendable;
      const command = {
        kind: "buy-pack",
        product: p.id,
        configuration: p.version,
        policy: state.policy.version,
        confirmed: true,
      };
      const purchase = executeCredits(
        state,
        marketActors[0],
        "pack",
        command,
        now,
      );
      state = purchase.state;
      assert.deepEqual(
        executeCredits(state, marketActors[0], "pack", command, now + 1),
        purchase,
      );
      assert.equal(
        wallet(state, marketActors[0].id).spendable,
        before - p.priceCredits,
      );
      assert.equal(fixtureCommandScope(state, command), sport);
      assert.equal(
        fixtureCommandScope(state, { kind: "open-pack", entitlement: "pack" }),
        sport,
      );
      state = executeCredits(
        state,
        marketActors[0],
        "open",
        { kind: "open-pack", entitlement: "pack" },
        now + 1,
      ).state;
      const cards = state.economy!.packs.pack.cards;
      assert.equal(cards.length, 9);
      assert.equal(
        new Set(cards.map((id) => state.economy!.instances[id].playerId)).size,
        9,
      );
      for (const id of cards) {
        const c = testCard(state, id);
        assert.equal(c.sport, sport);
        assert.equal(c.multiplier, 1);
        assert.match(c.player_id, /^stable-/);
        assert.notEqual(c.tier, "CORE");
        if (type === "PREMIUM")
          assert.ok(["ULTRA_RARE", "LEGENDARY", "ICON"].includes(c.tier));
      }
      for (const c of nfl) assert.deepEqual(state.economy!.instances[c.id], c);
      validateCardEconomy(state.economy!);
      validateCredits(state);
    }
  });
  test(`${sport}: sale uses five percent and cannot be purchased twice`, () => {
    const fixture = setup(sport),
      products = fixture.products;
    let state = fixture.state;
    const p = products.find((p) => p.type === "STANDARD")!;
    state = executeCredits(
      state,
      marketActors[0],
      "pack",
      {
        kind: "buy-pack",
        product: p.id,
        configuration: p.version,
        policy: state.policy.version,
        confirmed: true,
      },
      now,
    ).state;
    state = executeCredits(
      state,
      marketActors[0],
      "open",
      { kind: "open-pack", entitlement: "pack" },
      now + 1,
    ).state;
    const card = state.economy!.packs.pack.cards[0],
      identity = structuredClone(state.economy!.instances[card]);
    state = executeCredits(
      state,
      marketActors[0],
      "listing",
      { kind: "list", card, price: 1000 },
      now + 2,
    ).state;
    const before = wallet(state, marketActors[0].id).spendable;
    const c = {
      kind: "buy",
      listing: "listing",
      expectedPrice: 1000,
      policy: state.policy.version,
      confirmed: true,
    };
    assert.equal(fixtureCommandScope(state, c), sport);
    const result = executeCredits(state, marketActors[1], "sale", c, now + 3);
    state = result.state;
    assert.equal(wallet(state, marketActors[0].id).spendable, before + 950);
    assert.equal(state.listings.listing.receipt!.fee, 50);
    assert.deepEqual(state.economy!.instances[card], identity);
    assert.deepEqual(
      executeCredits(state, marketActors[1], "sale", c, now + 4),
      result,
    );
    assert.throws(() =>
      executeCredits(state, marketActors[2], "second", c, now + 4),
    );
    const permanent = Object.values(state.economy!.instances).find(
      (i) => state.economy!.players[i.playerId].sport === "nfl",
    )!.id;
    assert.throws(
      () =>
        fixtureCommandScope(state, {
          kind: "offer",
          give: [card],
          take: [permanent],
        }),
      /permanent inventory/,
    );
    assert.throws(
      () =>
        fixtureCommandScope(state, {
          kind: "private-offer",
          card,
          offeredCards: [permanent],
        }),
      /permanent inventory/,
    );
    assert.equal(
      fixtureCommandScope(state, { kind: "list", card: permanent, sport }),
      null,
    );
    validateCredits(state);
  });
}
