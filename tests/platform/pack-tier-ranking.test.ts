import { test } from "node:test";
import assert from "node:assert/strict";
import { prepareScoringPackPools } from "../../src/core/pack-tier-ranking";
import { packRankingPolicy } from "../../src/core/pack-products";

function fixture(league: "EPL" | "NFL" = "EPL") {
  return {
    league,
    rulesVersion: `synthetic-${league}-v1`,
    sourceSnapshotId: "synthetic-test-only",
    season: {
      label: "Synthetic test season",
      start: "2025-01-01T00:00:00Z",
      end: "2026-01-01T00:00:00Z",
    },
    complete: true,
    final: true,
    players: Array.from({ length: 200 }, (_, i) => ({
      playerId: `test-player-${i + 1}`,
      league,
      totalPointsHundredths: ((200 - i) * 100) as number | null,
    })),
  };
}
test("Each league uses top 20 Elite and next 150 Premium without changing source records", () => {
  for (const league of ["EPL", "NFL"] as const) {
    const input = fixture(league);
    input.players.reverse();
    const before = structuredClone(input);
    const result = prepareScoringPackPools(input);
    assert.equal(result.status, "PROPOSED_ONLY");
    const elite = result.pools.find((p) => p.tier === "ELITE")!;
    const premium = result.pools.find((p) => p.tier === "RARE")!;
    assert.equal(elite.players.length, 20);
    assert.equal(premium.players.length, 150);
    assert.equal(elite.players[19].playerId, "test-player-20");
    assert.equal(premium.players[0].playerId, "test-player-21");
    assert.equal(premium.players[149].playerId, "test-player-170");
    assert.equal(
      new Set([...elite.players, ...premium.players].map((p) => p.playerId))
        .size,
      170,
    );
    assert.deepEqual(input, before);
  }
  assert.equal(packRankingPolicy.period, "previous-completed-season");
});
test("Cutoff ties cannot be decided by arbitrary player ID; within-tier ties are allowed", () => {
  for (const boundary of [20, 170]) {
    const input = fixture();
    input.players[boundary].totalPointsHundredths =
      input.players[boundary - 1].totalPointsHundredths;
    const result = prepareScoringPackPools(input);
    assert.equal(result.status, "BOUNDARY_TIE_REVIEW");
    assert.deepEqual(result.pools, []);
  }
  const input = fixture();
  input.players[1].totalPointsHundredths =
    input.players[0].totalPointsHundredths;
  assert.equal(prepareScoringPackPools(input).status, "PROPOSED_ONLY");
});
test("Incomplete, provisional or missing points cannot create a sale-pool proposal", () => {
  for (const change of [
    (s: ReturnType<typeof fixture>) => {
      s.complete = false;
    },
    (s: ReturnType<typeof fixture>) => {
      s.final = false;
    },
    (s: ReturnType<typeof fixture>) => {
      s.players[0].totalPointsHundredths = null;
    },
    (s: ReturnType<typeof fixture>) => {
      s.players = s.players.slice(0, 169);
    },
  ]) {
    const input = fixture();
    change(input);
    assert.equal(prepareScoringPackPools(input).status, "DATA_REQUIRED");
  }
});
test("Mixed leagues, duplicate identities, fractional units and invalid seasons rejected", () => {
  const mixed = fixture();
  mixed.players[0].league = "NFL";
  assert.throws(() => prepareScoringPackPools(mixed), /separately/);
  const duplicate = fixture();
  duplicate.players.push(duplicate.players[0]);
  assert.throws(() => prepareScoringPackPools(duplicate), /Duplicate/);
  const fractional = fixture();
  fractional.players[0].totalPointsHundredths = 1.5;
  assert.throws(() => prepareScoringPackPools(fractional));
  const invalid = fixture();
  invalid.season.end = invalid.season.start;
  assert.throws(() => prepareScoringPackPools(invalid), /season/);
});
