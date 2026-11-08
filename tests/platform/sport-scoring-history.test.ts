import { test } from "node:test";
import assert from "node:assert/strict";
import {
  scoringHistoryQuery,
  scoringHistoryRows,
  selectedScoringRound,
  sportReferenceRules,
} from "../../src/core/sport-scoring-history";
import { feedRaw, feedGameFixture } from "../fixtures/nfl-testing-data";
import { rulesets } from "../../src/core/scoring-v1";

function observation(revision = 1) {
  return {
    player: "verified-player",
    name: "Synthetic Player",
    position: "WR",
    payload: { ...feedRaw("p_one", revision), week: 8, synthetic: false },
    game_payload: { ...feedGameFixture(), week: 8 },
  };
}
test("sport reference uses existing coefficients; historical competition versions remain unchanged", () => {
  assert.equal(sportReferenceRules("nfl").weights.receptions, 100);
  assert.equal(sportReferenceRules("afl").weights.kicks, 200);
  assert.equal(sportReferenceRules("nrl").weights.tries, 800);
  assert.deepEqual(sportReferenceRules("nrl").statisticGroups, {
    runMetres: 10,
    kickMetres: 30,
  });
  assert.equal(rulesets.nfl.weights.receptions, 50);
  assert.equal(rulesets.afl.weights.kicks, 300);
  assert.throws(() => scoringHistoryQuery.parse({ sport: "basketball" }));
  assert.throws(() =>
    scoringHistoryQuery.parse({ sport: "nfl", season: "PRIVATE-TEST-2026" }),
  );
});
test("all source rounds are selectable without competition records; explicit history is preserved", () => {
  const rounds = [9, 8, 7, 6, 5, 4, 3, 2, 1].map((round) => ({
    season: "2026",
    round,
    games: 1,
    records: 1,
    mappedRecords: 1,
  }));
  assert.deepEqual(selectedScoringRound(rounds, {}), {
    season: "2026",
    round: 9,
  });
  assert.deepEqual(selectedScoringRound(rounds, { round: 8 }), {
    season: "2026",
    round: 8,
  });
  assert.deepEqual(selectedScoringRound(rounds, { season: "2025", round: 3 }), {
    season: "2025",
    round: 3,
  });
});
test("latest correction replaces old score once, missing is not zero and synthetic/tombstones remain excluded", () => {
  const first = observation();
  const corrected = observation(2);
  first.payload.stats.receptions = 5;
  corrected.payload.stats.receptions = 3;
  const rows = scoringHistoryRows(
    [first, corrected, corrected],
    "2026",
    8,
    null,
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].game.base, 300);
  assert.equal(rows[0].game.revision, 2);
  assert.equal(rows[0].name, "Synthetic Player");
  assert.equal(rows[0].scoringVersion, sportReferenceRules("nfl").version);
  assert.equal(scoringHistoryRows([first], "2026", 7, null).length, 0);
  corrected.payload.fields.receptions.current = false;
  assert.equal(
    scoringHistoryRows([corrected], "2026", 8, null)[0].game.base,
    null,
  );
  corrected.payload.fields.receptions.current = true;
  corrected.payload.stats.receptions = 0;
  assert.equal(
    scoringHistoryRows([corrected], "2026", 8, null)[0].game.base,
    0,
  );
  corrected.payload.removed = true;
  assert.equal(
    scoringHistoryRows([first, corrected], "2026", 8, null).length,
    0,
  );
  first.payload.synthetic = true;
  assert.equal(scoringHistoryRows([first], "2026", 8, null).length, 0);
});
test("conflicting observations fail closed instead of adding or arbitrarily choosing points", () => {
  const first = observation();
  const conflict = structuredClone(first);
  conflict.payload.stats.receptions = 19;
  assert.throws(
    () => scoringHistoryRows([first, conflict], "2026", 8, null),
    /Conflicting/,
  );
});
