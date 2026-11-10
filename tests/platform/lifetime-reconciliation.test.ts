import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reconcileLifetimePool } from "../../src/core/lifetime-reconciliation";
import { dormantCommercialPool } from "../../src/core/commercial-pool-plan";
const player = {
  id: "0058d801-be72-4ba3-ad83-1325b2e8bcfc",
  sport: "afl",
  provider: "isolated",
  providerId: "player-1",
  snapshot: {
    name: "Synthetic source example",
    team: "Fixture",
    position: "MID",
    season: "2026",
    verifiedJerseyNumber: null,
    colour: "#123456",
    status: "active",
    synthetic: false,
  },
  eligiblePositions: ["MID"],
  source: {
    url: "https://example.invalid/roster",
    hash: "a".repeat(64),
    checkedAt: "2026-11-10T00:00:00Z",
    license: "fixture not a rights grant",
    verification: "fixture",
    permanentIssuanceEligible: false,
  },
};
test("all lifetime copies count even with an old alias; Icon cannot replenish", () => {
  const rows = dormantCommercialPool([player]);
  const old = {
    sport: "afl",
    player_id: "old-alias",
    provider: "isolated",
    provider_id: "player-1",
    rarity: "ICON",
    issued: 1,
    max_serial: 1,
  };
  const result = reconcileLifetimePool(rows, [old]);
  assert.equal(result.rows.find((r) => r.rarity === "ICON")!.issued, 1);
  assert.equal(result.legacyIssued, 1);
  assert.equal(result.importReady, true);
  assert.deepEqual(result, reconcileLifetimePool(rows, [old]));
  assert.throws(
    () => reconcileLifetimePool(rows, [{ ...old, issued: 2, max_serial: 2 }]),
    /cap/,
  );
  assert.throws(
    () => reconcileLifetimePool(rows, [{ ...old, max_serial: 2 }]),
    /serial history/,
  );
  assert.throws(() => reconcileLifetimePool(rows, [old, old]), /Ambiguous/);
  assert.equal(
    reconcileLifetimePool(rows, [{ ...old, provider_id: "missing" }])
      .importReady,
    false,
  );
});
test("live reconciliation preserves all supported issued copies, including retired records", () => {
  const report = JSON.parse(
    readFileSync(
      "docs/qa/v31-p1-p4-20261110/issued-reconciliation.json",
      "utf8",
    ),
  );
  assert.equal(report.overCap, 0);
  assert.equal(report.duplicateSerialGroups, 0);
  assert.equal(
    report.rows
      .filter((r: { sport: string }) => r.sport !== "basketball")
      .reduce((n: number, r: { issued: number }) => n + r.issued, 0),
    879,
  );
});

test("same UUID cannot conceal contradictory or missing provider identity", () => {
  const rows = dormantCommercialPool([player]);
  const old = {
    sport: "afl",
    player_id: player.id,
    provider: "isolated",
    provider_id: "different-person",
    rarity: "RARE",
    issued: 1,
    max_serial: 1,
  };
  assert.throws(() => reconcileLifetimePool(rows, [old]), /contradicts/);
  assert.throws(
    () =>
      reconcileLifetimePool(rows, [
        { ...old, provider: null, provider_id: null },
      ]),
    /contradicts/,
  );
});
