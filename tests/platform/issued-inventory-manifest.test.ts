import test from "node:test";
import assert from "node:assert/strict";
import {
  issuedInventoryManifest,
  type IssuedAllocation,
} from "../../src/core/issued-inventory-manifest";
const one: IssuedAllocation = {
  id: "existing-immutable-card",
  sport: "afl",
  playerId: "legacy-stable-player",
  provider: "wikimedia",
  providerId: "afl:Q1",
  rarity: "ICON",
  serial: 1,
};

test("manifest digest binds each immutable ID to its original serial", () => {
  const first = { ...one, rarity: "RARE" as const };
  const second = { ...first, id: "second-existing-card", serial: 2 };
  const original = issuedInventoryManifest([first, second]);
  const swapped = issuedInventoryManifest([
    { ...first, serial: 2 },
    { ...second, serial: 1 },
  ]);
  assert.notEqual(original.digest, swapped.digest);
  assert.deepEqual(original, issuedInventoryManifest([second, first]));
  assert.deepEqual(original.rows[0].allocations, [
    { id: first.id, serial: 1 },
    { id: second.id, serial: 2 },
  ]);
});
test("issued manifest counts lifetime allocations once regardless of refund/retirement or transfer; replay is deterministic", () => {
  const two = {
    ...one,
    id: "other-player-icon",
    playerId: "other",
    providerId: "afl:Q2",
  };
  const a = issuedInventoryManifest([one, two]),
    b = issuedInventoryManifest([two, one]);
  assert.deepEqual(a, b);
  assert.equal(a.totalIssued, 2);
  assert(
    a.rows.every((r) => r.remainingLifetimeCapacity === 0 && r.available === 0),
  );
  assert.throws(
    () =>
      issuedInventoryManifest([
        one,
        { ...one, id: "replacement-icon", serial: 2 },
      ]),
    /Invalid/,
  );
});
test("issued manifest rejects duplicate IDs, aliased serials, missing identities and gaps without guessing", () => {
  assert.throws(() => issuedInventoryManifest([one, one]), /Duplicate/);
  assert.throws(
    () => issuedInventoryManifest([one, { ...one, id: "different-id" }]),
    /Duplicate/,
  );
  assert.throws(
    () => issuedInventoryManifest([{ ...one, providerId: "" }]),
    /identity/,
  );
  assert.throws(
    () => issuedInventoryManifest([{ ...one, rarity: "RARE", serial: 2 }]),
    /gap/,
  );
  assert.throws(
    () => issuedInventoryManifest([{ ...one, rarity: "CORE" }]),
    /Invalid/,
  );
  assert.throws(
    () => issuedInventoryManifest([{ ...one, sport: "nba" }]),
    /supported/,
  );
});
test("all five approved lifetime boundaries are preserved and exhausted without replacement", () => {
  for (const [rarity, cap] of [
    ["RARE", 5000],
    ["ELITE", 2500],
    ["ULTRA_RARE", 400],
    ["LEGENDARY", 50],
    ["ICON", 1],
  ] as const) {
    const cards = Array.from({ length: cap }, (_, i) => ({
      ...one,
      id: "existing-" + i,
      rarity,
      serial: i + 1,
    }));
    assert.equal(
      issuedInventoryManifest(cards).rows[0].remainingLifetimeCapacity,
      0,
    );
    assert.throws(
      () =>
        issuedInventoryManifest([
          ...cards,
          { ...one, id: "excess", rarity, serial: cap + 1 },
        ]),
      /Invalid/,
    );
  }
});
