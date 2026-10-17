import test from "node:test";
import assert from "node:assert/strict";
import {
  statCategories,
  compactColumns,
  historyGameRows,
  historyTotal,
  gameScoreStatus,
} from "../../src/core/player-statistics";
import {
  playerHistory,
  type PlayerHistorySource,
} from "../../src/core/player-card-history";
import { scorePlayer, rulesets } from "../../src/core/scoring-v1";
import examples from "../../config/card-statistics-preview.json";
import type { PlayerHistory } from "../../src/core/player-card-history";

test("NFL position tabs and compact columns share the same approved field definitions", () => {
  for (const [position, ids] of Object.entries({
    QB: ["passing", "rushing", "misc"],
    RB: ["rushing", "receiving", "misc"],
    WR: ["receiving", "rushing", "misc"],
    TE: ["receiving", "rushing", "misc"],
  })) {
    const categories = statCategories("nfl", position);
    assert.deepEqual(
      categories.map((c) => c.id),
      ids,
    );
    for (const c of categories)
      assert.ok(
        compactColumns(c).length <= 3 &&
          compactColumns(c).every((k) => c.columns.includes(k)),
      );
  }
  assert.deepEqual(
    statCategories("nfl", "QB")[0].columns.map((c) => c.label),
    ["ATT", "CMP", "YDS", "TD", "INT"],
  );
  assert.deepEqual(
    statCategories("nfl", "WR")[0].columns.map((c) => c.label),
    ["REC", "TAR", "YDS", "TD"],
  );
});
test("EPL and AFL never receive NFL tabs or unsupported passing counts", () => {
  assert.deepEqual(
    statCategories("football", "MID"),
    statCategories("epl", "MID"),
  );
  assert.deepEqual(
    statCategories("epl", "MID").map((c) => c.id),
    ["attacking", "defending", "other"],
  );
  assert.ok(
    statCategories("epl", "GK")[1].columns.some((c) => c.key === "saves"),
  );
  assert.ok(
    statCategories("afl", "MID")[0].columns.some((c) => c.key === "kicks"),
  );
  assert.deepEqual(statCategories("unknown", "QB"), []);
});
test("all verified examples retain exact server FPTS through category selection and compact projection", () => {
  for (const example of examples.examples) {
    const h = example.history as PlayerHistory,
      original = JSON.stringify(h);
    for (const category of statCategories(example.sport, example.position)) {
      compactColumns(category);
      const rows = historyGameRows(h);
      assert.deepEqual(
        rows.map((r) => r.base),
        [...h.games!].sort((a, b) => b.week - a.week).map((r) => r.base),
      );
      assert.equal(historyTotal(h), h.feed!.seasonBase);
      for (const g of rows)
        if (g.base !== null && g.played)
          assert.equal(
            g.base,
            g.parts.reduce((n, p) => n + p.centipoints, 0),
          );
    }
    assert.equal(JSON.stringify(h), original);
  }
});
test("EPL projection uses authoritative scoring and preserves missing/review/zero/corrections", () => {
  const stats = {
    regulationSeconds: 5400,
    playedSeconds: 5400,
    goals: 1,
    assists: 0,
    saves: 0,
    penaltySaves: 0,
    penaltiesMissed: 0,
    yellowCards: 0,
    dismissal: "none",
    ownGoals: 0,
    concededOnPitch: 1,
    onPitchEvidence: "ordered-events-verified",
  };
  const row: PlayerHistorySource = {
    season: "2026",
    week: 1,
    fixture: "fixture",
    scheduledAt: "2026-09-01",
    revision: 1,
    observedAt: "2026-09-02",
    final: true,
    visible: true,
    position: "MID",
    rules: rulesets.epl,
    source: { status: "completed", availability: "complete", stats },
  };
  const original = JSON.stringify(row),
    h = playerHistory([row]);
  assert.equal(
    h.games![0].base,
    scorePlayer(rulesets.epl, "MID", stats).centipoints,
  );
  assert.equal(h.seasonBase, h.games![0].base);
  assert.equal(h.games![0].values.assists, 0);
  assert.equal(h.games![0].values.passing_attempts, undefined);
  assert.equal(h.games![0].opponent, null);
  assert.equal(gameScoreStatus(h.games![0]), "Final");
  const correction = {
    ...row,
    revision: 2,
    observedAt: "2026-09-03",
    final: false,
    source: { ...row.source!, stats: { ...stats, goals: 2 } },
  };
  const corrected = playerHistory([row, correction]);
  assert.equal(corrected.games!.length, 1);
  assert.equal(gameScoreStatus(corrected.games![0]), "Provisional");
  assert.equal(
    corrected.seasonBase,
    scorePlayer(rulesets.epl, "MID", correction.source.stats).centipoints,
  );
  const hidden = playerHistory([{ ...row, visible: false }]);
  assert.equal(hidden.games![0].base, null);
  assert.deepEqual(hidden.games![0].values, {});
  assert.deepEqual(hidden.games![0].parts, []);
  assert.equal(gameScoreStatus(hidden.games![0]), "Under review");
  const missing = playerHistory([{ ...row, source: null }]);
  assert.equal(missing.seasonBase, null);
  assert.equal(gameScoreStatus(missing.games![0]), "Unavailable");
  assert.equal(JSON.stringify(row), original);
  assert.equal(playerHistory([row], "2025").rows.length, 0);
});
