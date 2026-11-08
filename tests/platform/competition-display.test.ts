import { test } from "node:test";
import assert from "node:assert/strict";
import {
  competitionRoundWord,
  competitionRoundStatus,
  competitionContextBadge,
  competitionRoundOption,
  competitionLabel,
  seasonLabel,
} from "../../src/core/competition-display";
const now = Date.parse("2026-11-08T00:00:00Z");
const round = {
  name: "NFL Traditional",
  sport: "nfl",
  season: "2026",
  round: 8,
  opens_at: "2026-11-07T00:00:00Z",
  locks_at: "2026-11-09T00:00:00Z",
  scored_at: null,
  rules: { mode: "SALARY_CAP", lineup_version: "saved-v1" },
};
test("round labels are presentation-only and preserve basketball weekly terminology", () => {
  for (const sport of ["nfl", "afl", "nrl"])
    assert.equal(competitionRoundWord(sport), "Round");
  assert.equal(competitionRoundWord("basketball"), "Week");
  assert.equal(competitionLabel(round), "Traditional · Round 8");
  assert.equal(round.rules.lineup_version, "saved-v1");
  assert.equal(round.season, "2026");
  assert.equal(seasonLabel("PRIVATE-TEST-2026"), "2026 · Test");
});
test("deadline and final states do not infer finality from player stats or past rounds", () => {
  assert.equal(competitionRoundStatus(round, now), "Entries open");
  assert.equal(
    competitionRoundStatus({ ...round, rules: { disabled: true } }, now),
    "Entries unavailable",
  );
  assert.equal(
    competitionRoundStatus(
      {
        ...round,
        rules: { disabled: true },
        scored_at: "2026-11-07T00:00:00Z",
      },
      now,
    ),
    "Final",
  );
  assert.equal(
    competitionRoundStatus({ ...round, opens_at: "2026-11-09T00:00:00Z" }, now),
    "Upcoming",
  );
  assert.equal(
    competitionRoundStatus(
      { ...round, locks_at: new Date(now).toISOString() },
      now,
    ),
    "Entries closed",
  );
  assert.equal(
    competitionRoundStatus(
      {
        ...round,
        locks_at: "2026-10-01T00:00:00Z",
        scored_at: "2026-10-02T00:00:00Z",
      },
      now,
    ),
    "Final",
  );
  assert.equal(
    competitionRoundStatus({ ...round, opens_at: undefined }, now),
    "Open for planning",
  );
  assert.equal(
    competitionRoundStatus({ ...round, locks_at: "invalid" }, now),
    "Schedule pending",
  );
});
test("practice and historical test context remain visible without leaking internal season labels", () => {
  assert.equal(competitionContextBadge(round), null);
  assert.equal(
    competitionContextBadge({ ...round, season: "PRIVATE-TEST-2026" }),
    "Test",
  );
  assert.equal(
    competitionContextBadge({ ...round, name: "NFL Practice" }),
    "Practice",
  );
  assert.equal(
    competitionContextBadge({ ...round, rules: { practice: true } }),
    "Practice",
  );
  assert.equal(
    competitionRoundOption({ ...round, name: "NFL Practice" }, now),
    "Round 8 — Entries open · Practice",
  );
  assert.equal(
    competitionRoundOption(
      {
        ...round,
        season: "PRIVATE-TEST-2026",
        locks_at: "2026-10-23T00:00:00Z",
      },
      now,
    ),
    "Round 8 — Entries closed · Test",
  );
});
