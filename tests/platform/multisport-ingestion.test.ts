import assert from "node:assert/strict";
import test from "node:test";
import {
  mapRawScoringInput,
  type RawGame,
} from "../../src/core/multisport-ingestion";
import { aflStats } from "../../src/core/scoring-v1";
const base: RawGame = {
  sport: "afl",
  fixture_id: "f1",
  player_id: "p1",
  revision: 1,
  synthetic: false,
  usable: true,
  stats: {},
  current_fields: {},
};
test("multi-sport translation obeys actual Docked AFL schema without scoring", () => {
  const row = structuredClone(base);
  for (const k of [
    "kicks",
    "handballs",
    "marks",
    "tackles",
    "goals",
    "behinds",
    "hitouts",
    "frees_for",
    "frees_against",
  ]) {
    row.stats[k] = 0;
    row.current_fields[k] = true;
  }
  const result = mapRawScoringInput(row, "existing-catalogue-id");
  assert.equal(result.availability, "complete");
  aflStats.parse(result.stats);
  row.stats.frees_against = null;
  assert.equal(mapRawScoringInput(row, "existing").availability, "pending");
});
test("EPL evidence gaps and unapproved NBA/NRL contracts remain pending", () => {
  for (const sport of ["epl", "nba", "nrl"] as const)
    assert.equal(
      mapRawScoringInput({ ...base, sport }, "existing").availability,
      "pending",
    );
});
test("synthetic, incomplete and unmapped records cannot reach scoring", () => {
  assert.equal(
    mapRawScoringInput({ ...base, synthetic: true }, "existing").availability,
    "pending",
  );
  assert.equal(
    mapRawScoringInput({ ...base, usable: false }, "existing").availability,
    "pending",
  );
  assert.equal(mapRawScoringInput(base, null).availability, "pending");
});
