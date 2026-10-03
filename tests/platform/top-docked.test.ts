import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateTopDocked,
  communityPerformance,
  qualifiedPerformanceBadges,
  sameRankingScope,
  leaderboardMilestone,
  rankingWindow,
  type CanonicalCommunityRecord,
} from "../../src/core/top-docked";
function record(
  id: string,
  overrides: Partial<CanonicalCommunityRecord> = {},
): CanonicalCommunityRecord {
  return {
    id,
    profileId: "fixture-member",
    submittedAt: "2026-09-01T00:00:00Z",
    startAt: "2026-09-01T01:00:00Z",
    sport: "football",
    odds: "2.5",
    units: "1.00",
    classification: "STANDARD_VERIFIED",
    ruleVersion: "community-standard-v1",
    verified: true,
    demo: false,
    official: false,
    integrityClear: true,
    result: "WON",
    settledAt: "2026-09-01T03:00:00Z",
    settlementId: `settlement-${id}`,
    ...overrides,
  };
}
function sample(profile: string, odds = "2.001") {
  return Array.from({ length: 20 }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return record(`${profile}-${i}`, {
      profileId: profile,
      odds,
      submittedAt: `2026-09-${day}T00:00:00Z`,
      startAt: `2026-09-${day}T01:00:00Z`,
      settledAt: `2026-09-${day}T03:00:00Z`,
    });
  });
}
const options = { period: "all" as const, asOf: "2026-10-01T00:00:00Z" };
test("one-unit arithmetic retains losses/voids and drawdown; no settled sample remains unknown", () => {
  const p = communityPerformance([
    record("a"),
    record("b", { result: "LOST" }),
    record("c", { result: "VOID" }),
    record("d", { result: "LOST" }),
  ]);
  assert.equal(p.netUnits, "-0.5");
  assert.equal(p.roi, "-16.67");
  assert.equal(p.maxDrawdown, "2");
  assert.equal(p.longestLosingRun, 2);
  assert.equal(p.settled, 4);
  const pending = communityPerformance([
    record("p", { result: "PENDING", settledAt: null, settlementId: null }),
  ]);
  assert.equal(pending.netUnits, null);
  assert.equal(pending.roi, null);
});
test("tiny samples provisional; popularity/demo/official/promo records never qualify", () => {
  const rows = calculateTopDocked(
    [
      record("a"),
      record("demo", { demo: true }),
      record("official", { official: true }),
      record("promo", { classification: "PROMOTIONAL_EXCLUDED" }),
    ],
    options,
  ).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].rank, null);
  assert.equal(rows[0].performance.verifiedEdges, 1);
  assert.equal(rows[0].qualification, "PROVISIONAL");
  assert.deepEqual(qualifiedPerformanceBadges(rows[0]), []);
});
test("ranking preserves sub-cent precision and reproducible deterministic ties", () => {
  const low = sample("a", "2.00001"),
    high = sample("z", "2.00002");
  const rows = calculateTopDocked([...low, ...high], options).rows;
  assert.equal(rows[0].profileId, "z");
  assert.equal(rows[0].performance.netUnits, "20.0004");
  assert.equal(rows[1].performance.netUnits, "20.0002");
  assert.deepEqual(
    calculateTopDocked([...low, ...high].reverse(), options).rows,
    rows,
  );
});
test("integrity-reviewed losses remain in metrics but prevent qualification", () => {
  const records = sample("a");
  records[0] = { ...records[0], result: "LOST", integrityClear: false };
  const row = calculateTopDocked(records, options).rows[0];
  assert.equal(row.performance.lost, 1);
  assert.equal(row.qualification, "INTEGRITY_REVIEW");
  assert.equal(row.rank, null);
});
test("invalid timestamps, lookahead settlement, duplicate IDs and nonunit stake rejected", () => {
  assert.throws(
    () =>
      calculateTopDocked(
        [record("bad", { submittedAt: "not-a-date" })],
        options,
      ),
    /timestamp/,
  );
  assert.throws(
    () =>
      calculateTopDocked(
        [record("future", { settledAt: "2027-01-01Z" })],
        options,
      ),
    /Future/,
  );
  assert.throws(
    () => calculateTopDocked([record("same"), record("same")], options),
    /Duplicate/,
  );
  assert.throws(
    () => communityPerformance([record("stake", { units: "10" })]),
    /one-unit/,
  );
});
test("period UTC boundaries and corrections recompute from retained canonical evidence", () => {
  assert.equal(
    rankingWindow("week", "2026-10-03T12:00:00Z").from,
    "2026-09-28T00:00:00.000Z",
  );
  assert.equal(
    rankingWindow("month", "2026-10-03T12:00:00Z").from,
    "2026-10-01T00:00:00.000Z",
  );
  const original = sample("a"),
    before = calculateTopDocked(original, options).rows[0];
  const corrected = original.map((r, i) =>
    i
      ? r
      : { ...r, result: "LOST" as const, settlementId: "corrected-evidence" },
  );
  const after = calculateTopDocked(corrected, options).rows[0];
  assert.equal(after.performance.lost, 1);
  assert.equal(before.performance.lost, 0);
  assert.ok(after.settlementIds.includes("corrected-evidence"));
});
test("Rising requires comparable frozen scope and actual earlier qualified evidence, not a new month or rolling window", () => {
  const old = calculateTopDocked(
    [...sample("a", "2"), ...sample("b", "2.1")],
    options,
  );
  const current = calculateTopDocked(
    [
      ...sample("a", "2"),
      ...sample("b", "2.1"),
      record("a-extra", { profileId: "a", odds: "5" }),
    ],
    options,
  );
  const row = current.rows.find((r) => r.profileId === "a")!,
    previous = old.rows.find((r) => r.profileId === "a")!;
  assert.equal(
    qualifiedPerformanceBadges(row, previous).some((b) => b.code === "RISING"),
    false,
  );
  assert.equal(
    qualifiedPerformanceBadges(row, previous, undefined, {
      current,
      previous: old,
    }).some((b) => b.code === "RISING"),
    true,
  );
  assert.equal(
    sameRankingScope(
      { ...current, period: "month", from: "2026-10-01T00:00:00Z" },
      { ...old, period: "month", from: "2026-09-01T00:00:00Z" },
    ),
    false,
  );
  assert.equal(
    sameRankingScope(
      { ...current, period: "7d", from: "2026-09-24T00:00:00Z" },
      { ...old, period: "7d", from: "2026-09-23T00:00:00Z" },
    ),
    false,
  );
});
test("leaderboard notifications require a real comparable prior snapshot and new qualification or qualified ranking improvement", () => {
  const previous = calculateTopDocked(sample("a").slice(0, 19), options),
    current = calculateTopDocked(sample("a"), options),
    row = current.rows[0];
  assert.equal(leaderboardMilestone(row, previous.rows[0], undefined), null);
  assert.equal(
    leaderboardMilestone(row, previous.rows[0], { current, previous }),
    "QUALIFIED",
  );
  assert.equal(
    leaderboardMilestone(row, row, { current, previous: current }),
    null,
  );
  assert.equal(
    leaderboardMilestone(
      row,
      { ...previous.rows[0], qualification: "INTEGRITY_REVIEW" },
      { current, previous },
    ),
    null,
  );
  assert.equal(
    leaderboardMilestone(row, previous.rows[0], {
      current: { ...current, from: "2026-10-01" },
      previous: { ...previous, from: "2026-09-01" },
    }),
    null,
  );
  const oldBoard = calculateTopDocked(
      [...sample("a", "2"), ...sample("b", "2.1")],
      options,
    ),
    newBoard = calculateTopDocked(
      [
        ...sample("a", "2"),
        ...sample("b", "2.1"),
        record("new-a", { profileId: "a", odds: "5" }),
      ],
      options,
    );
  assert.equal(
    leaderboardMilestone(
      newBoard.rows.find((r) => r.profileId === "a")!,
      oldBoard.rows.find((r) => r.profileId === "a"),
      { current: newBoard, previous: oldBoard },
    ),
    "RISING",
  );
});
