import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { sandboxCommand } from "../../src/core/sport-sandbox";
import { fantasyProductionAction } from "../../src/core/fantasy-production";
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

test("all sports accept server-projected PostgreSQL Core IDs at the request boundary", () => {
  const payload = {
    competition_id: randomUUID(),
    revision: 0,
    selections: [{ slot: "QB", card: "" }],
  };
  const request_id = randomUUID();
  for (let i = 0; i < 100; i++) {
    const h = createHash("md5")
      .update(`public-free-core-v1:isolated-member:${i}`)
      .digest("hex");
    const card = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    payload.selections[0].card = card;
    assert(
      fantasyProductionAction.safeParse({
        action: "seven_draft",
        payload,
        request_id,
      }).success,
    );
    for (const sport of ["afl", "nrl", "basketball"])
      assert(
        sandboxCommand.safeParse({
          sport,
          action: "seven_draft",
          ...payload,
          request_id,
        }).success,
      );
  }
  for (const card of ["not-a-card", "' OR true --", "", "0".repeat(32)]) {
    payload.selections[0].card = card;
    assert(
      !fantasyProductionAction.safeParse({
        action: "seven_enter",
        payload,
        request_id,
      }).success,
    );
    assert(
      !sandboxCommand.safeParse({
        sport: "nrl",
        action: "seven_enter",
        ...payload,
        request_id,
      }).success,
    );
  }
});
