import test from "node:test";
import assert from "node:assert/strict";
import {
  collectionQuery,
  collectionPageSize,
} from "../../src/core/owned-collection";
import { nflSearchTeams } from "../../src/core/card-presentation";
import { testCard } from "../../src/core/member-test-wallet";
import {
  marketplaceFixture,
  marketActors,
} from "../fixtures/marketplace-state";
import { rarities, rarityRule } from "../../src/core/card-rarity";
test("collection filters reject account overrides, arbitrary sorts and oversized input", () => {
  assert.equal(collectionPageSize, 18);
  for (const q of [
    { user_id: "other" },
    { owner: "other" },
    { limit: 10000 },
    { sort: "sql" },
    { sport: "football" },
    { search: "x".repeat(81) },
    { cursor: "x".repeat(601) },
  ])
    assert.equal(collectionQuery.safeParse(q).success, false);
  for (const sport of ["nfl", "basketball", "afl", "nrl"])
    assert.equal(collectionQuery.parse({ sport }).sort, "recent");
  assert.deepEqual(nflSearchTeams("Houston"), ["HOU"]);
  assert.deepEqual(nflSearchTeams("Texans"), ["HOU"]);
  assert.ok(nflSearchTeams("Los Angeles").includes("LAC"));
});
test("lightweight collection projection retains exact existing card presentation and NBA multiplier for every rarity", () => {
  for (const sport of ["nfl", "basketball", "afl", "nrl"] as const) {
    const state = marketplaceFixture(Date.now(), marketActors, false, sport);
    const id = Object.keys(state.cards)[0],
      instance = state.economy!.instances[id],
      player = state.economy!.players[instance.playerId];
    for (const tier of rarities) {
      instance.rarity = tier;
      state.commerce.cards[id].tier = tier;
      const projected = testCard(
        {
          commerce: { cards: { [id]: state.commerce.cards[id] } },
          cards: { [id]: true },
          economy: {
            instances: { [id]: instance },
            players: { [player.id]: player },
          },
        },
        id,
      );
      assert.deepEqual(projected, testCard(state, id));
      if (sport === "basketball" || sport === "nfl")
        assert.equal(
          projected.multiplier,
          rarityRule(tier).multiplierTenths / 10,
        );
    }
  }
});
