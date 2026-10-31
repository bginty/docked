import test from "node:test";
import assert from "node:assert/strict";
import {
  collectibleInventory,
  eligibleInRound,
} from "../../src/core/free-core";
test("free Core eligibility cannot inflate owned inventory or leak between round selections", () => {
  const core = {
    inventory_source: "public-free-core-v1",
    collectible_owned: false,
    eligible_competition_ids: ["afl-open"],
  };
  const owned = {
    inventory_source: "credits-fixture-v1",
    collectible_owned: true,
  };
  assert.deepEqual(collectibleInventory([core, owned]), [owned]);
  assert.equal(eligibleInRound(core, "afl-open"), true);
  for (const id of [undefined, "nfl-open", "afl-locked", "nrl-open"])
    assert.equal(eligibleInRound(core, id), false);
  assert.equal(eligibleInRound(owned, "nfl-open"), true);
});
