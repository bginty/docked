import { test } from "node:test";
import assert from "node:assert/strict";
import {
  playerHistory,
  adjustedCardPoints,
  type PlayerHistorySource,
} from "../../src/core/player-card-history";
import { rulesets, nflStats } from "../../src/core/scoring-v1";
const nflRules = rulesets.nfl;
const stats = (receiving_yards = 0) =>
  nflStats.parse({
    ...Object.fromEntries(Object.keys(nflStats.shape).map((k) => [k, 0])),
    receiving_yards,
  });
const row = (
  patch: Partial<PlayerHistorySource> = {},
): PlayerHistorySource => ({
  season: "2026",
  week: 1,
  fixture: "f1",
  scheduledAt: "2026-09-01T00:00:00Z",
  revision: 1,
  observedAt: "2026-09-02T00:00:00Z",
  final: true,
  visible: true,
  position: "TE",
  rules: nflRules,
  source: { status: "completed", availability: "complete", stats: stats(100) },
  ...patch,
});
test("player history reuses authoritative base scoring, zero, DNP, pending and missing stay distinct", () => {
  const h = playerHistory([
    row(),
    row({
      week: 2,
      fixture: "f2",
      source: { status: "completed", availability: "complete", stats: stats() },
    }),
    row({
      week: 3,
      fixture: "f3",
      source: {
        status: "completed",
        availability: "confirmed-dnp",
        stats: null,
      },
    }),
    row({ week: 4, fixture: "f4", source: null }),
    row({
      week: 5,
      fixture: "f5",
      source: { status: "live", availability: "pending", stats: null },
    }),
  ]);
  assert.equal(h.played, 2);
  assert.equal(h.averageBase, 500);
  assert.equal(h.bestBase, 1000);
  assert.deepEqual(
    h.rows.map((r) => [r.week, r.base, r.status]),
    [
      [5, null, "Pending"],
      [4, null, "Missing data"],
      [3, 0, "DNP"],
      [2, 0, "Final"],
      [1, 1000, "Final"],
    ],
  );
});
test("mode duplication, corrected results and season boundaries do not inflate player history", () => {
  const before = row(),
    corrected = row({
      revision: 2,
      observedAt: "2026-09-03T00:00:00Z",
      final: false,
      source: {
        status: "completed",
        availability: "complete",
        stats: stats(120),
      },
    });
  const frozen = JSON.stringify(before);
  const h = playerHistory([
    before,
    structuredClone(before),
    corrected,
    row({
      season: "2025",
      source: {
        status: "completed",
        availability: "complete",
        stats: stats(500),
      },
    }),
  ]);
  assert.equal(h.rows.length, 1);
  assert.equal(h.rows[0].base, 1200);
  assert.equal(h.rows[0].status, "Provisional");
  assert.equal(h.played, 1);
  assert.equal(JSON.stringify(before), frozen);
  assert.equal(playerHistory([before, corrected], "2025").rows.length, 0);
  assert.equal(adjustedCardPoints(-5, 1.3), -7);
  assert.equal(adjustedCardPoints(5, 1.3), 7);
  assert.equal(adjustedCardPoints(null, 1.3), null);
});
test("review holds cannot leak through the other mode; missing players have no fabricated averages", () => {
  const h = playerHistory([row({ visible: false }), row({ revision: 2 })]);
  assert.equal(h.rows[0].status, "Under review");
  assert.equal(h.rows[0].base, null);
  assert.equal(h.averageBase, null);
  assert.deepEqual(playerHistory([]), {
    season: null,
    seasons: [],
    rows: [],
    played: 0,
    averageBase: null,
    bestBase: null,
  });
});
