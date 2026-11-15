import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nflSeasonCalendar as calendar,
  nflCurrentWeek,
  nflSeasonSelection,
} from "../../src/core/nfl-season-navigation";
import type { FantasyCompetition } from "../../src/core/fantasy";
const competition = (
  id: string,
  round: number,
  mode = "SALARY_CAP",
  season = "2026",
): FantasyCompetition => ({
  id,
  name: id,
  round,
  season,
  locks_at: "2026-10-15T00:00:00Z",
  scored_at: null,
  rules: { lineup_version: "nfl-seven-v1", mode },
});
test("All 18 real weeks remain available; 272 fixtures, one bye per team, no guessed TBD kickoffs", () => {
  assert.equal(calendar.rounds.length, 18);
  const games = calendar.rounds.flatMap((r) => r.games),
    teams = new Map<string, number>();
  assert.equal(games.length, 272);
  assert.equal(new Set(games.map((g) => g.id)).size, 272);
  for (const r of calendar.rounds) {
    const playing = r.games.flatMap((g) => [g.home, g.away]);
    assert.equal(new Set(playing).size, playing.length);
    assert(r.byes.every((t) => !playing.includes(t)));
    for (const t of playing) teams.set(t, (teams.get(t) ?? 0) + 1);
  }
  assert.equal(teams.size, 32);
  assert([...teams.values()].every((n) => n === 17));
  assert.equal(games.filter((g) => g.kickoff === null).length, 24);
  assert(calendar.rounds[17].games.every((g) => g.kickoff === null));
  assert.equal(calendar.sourceVerifiedAt, "2026-11-08T04:42:39.435Z");
});
test("Current week uses season chronology, not first future imported lock or synthetic practice", () => {
  assert.equal(nflCurrentWeek(Date.parse("2026-11-15T12:00:00Z")), 10);
  assert.equal(nflCurrentWeek(Date.parse("2026-11-16T23:00:00-08:00")), 10);
  assert.equal(nflCurrentWeek(Date.parse("2026-08-01")), 1);
  assert.equal(nflCurrentWeek(Date.parse("2027-01-09T15:00:00Z")), 18);
  assert.equal(nflCurrentWeek(Date.parse("2027-02-14")), 18);
  const competitions = [
    competition("week6", 6),
    competition("week7", 7),
    competition("practice", 1, "SALARY_CAP", "2026 Practice"),
    competition("star", 7, "OPEN"),
  ];
  const before = JSON.stringify(competitions);
  const a = nflSeasonSelection({
    competitions,
    mode: "SALARY_CAP",
    chosen: "",
    now: Date.parse("2026-11-15"),
  });
  assert.equal(a.week, 10);
  assert.equal(a.competition, undefined);
  assert.deepEqual(
    a.rounds.map((c) => c.id),
    ["week6", "week7"],
  );
  assert.deepEqual(
    a.practice.map((c) => c.id),
    ["practice"],
  );
  const historical = nflSeasonSelection({
    competitions,
    mode: "SALARY_CAP",
    chosen: "week6",
    now: Date.parse("2026-11-15"),
  });
  assert.equal(historical.competition?.id, "week6");
  const star = nflSeasonSelection({
    competitions,
    mode: "OPEN",
    chosen: "",
    week: "7",
    now: Date.parse("2026-11-15"),
  });
  assert.equal(star.competition?.id, "star");
  assert.equal(
    nflSeasonSelection({
      competitions,
      mode: "OPEN",
      chosen: "",
      week: "19",
      now: Date.parse("2026-11-15"),
    }).week,
    10,
  );
  assert.equal(JSON.stringify(competitions), before);
});
