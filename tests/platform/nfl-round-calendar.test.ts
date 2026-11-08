import test from "node:test";
import assert from "node:assert/strict";
import {
  planNflCalendar,
  nflCalendarStream,
  type NflCalendarGame,
} from "../../src/core/nfl-round-calendar";
const games: NflCalendarGame[] = Array.from({ length: 272 }, (_, i) => {
  const round = Math.floor(i / 16) + 1 + (i >= 264 ? 1 : 0),
    pair = i % 16;
  return {
    id: `2026-${i}`,
    round,
    home: `T${pair * 2}`,
    away: `T${pair * 2 + 1}`,
    kickoff: new Date(Date.UTC(2026, 8, 1 + round * 7)).toISOString(),
  };
});
const input = {
  season: 2026,
  source: "https://calendar.example/verified",
  now: "2026-09-01T00:00:00Z",
  verifiedAt: "2026-09-01T00:00:00Z",
  games,
  existingStreams: [] as string[],
  permitExpiresAt: "2027-03-01T00:00:00Z",
};
test("calendar plans both modes from deadlines, independent of statistics", () => {
  const result = planNflCalendar(input);
  assert.equal(result.rounds.length, 18);
  assert.equal(result.rounds[0].status, "draft-ready");
  assert.deepEqual(result.rounds[0].missingModes, ["SALARY_CAP", "OPEN"]);
  assert.equal(result.publication, "separate-owner-review-required");
});
test("existing modes are idempotent and preserve historical snapshots", () => {
  const result = planNflCalendar({
    ...input,
    existingStreams: [
      nflCalendarStream(2026, 1, "OPEN"),
      nflCalendarStream(2026, 1, "SALARY_CAP"),
    ],
    now: "2026-10-01T00:00:00Z",
    verifiedAt: "2026-10-01T00:00:00Z",
  });
  assert.equal(result.rounds[0].status, "existing");
  assert.deepEqual(result.rounds[0].missingModes, []);
  assert.equal(result.rounds[1].status, "past-deadline");
});
test("a started round is never retroactively opened; future modes stay separate", () => {
  const result = planNflCalendar({
    ...input,
    now: games[0].kickoff,
    verifiedAt: games[0].kickoff,
    existingStreams: [nflCalendarStream(2026, 2, "OPEN")],
  });
  assert.equal(result.rounds[0].status, "past-deadline");
  assert.deepEqual(result.rounds[1].missingModes, ["SALARY_CAP"]);
});
test("reject partial seasons, duplicate games and invalid team mappings", () => {
  assert.throws(
    () => planNflCalendar({ ...input, games: games.slice(1) }),
    /Complete/,
  );
  assert.throws(
    () => planNflCalendar({ ...input, games: [...games.slice(1), games[1]] }),
    /Complete/,
  );
  assert.throws(
    () =>
      planNflCalendar({
        ...input,
        games: games.map((g, i) => (i ? g : { ...g, home: g.away })),
      }),
    /Invalid/,
  );
});
test("invalid or unknown kickoff blocks that round without inventing a deadline", () => {
  const result = planNflCalendar({
    ...input,
    games: games.map((g, i) => (i ? g : { ...g, kickoff: "TBD" })),
  });
  assert.equal(result.rounds[0].status, "calendar-review");
  assert.equal(result.rounds[0].locksAt, null);
  assert.equal(result.rounds[1].status, "draft-ready");
});
test("expired permission and stale evidence cannot prepare playable rounds", () => {
  assert.equal(
    planNflCalendar({ ...input, permitExpiresAt: "2026-09-07T00:00:00Z" })
      .rounds[0].status,
    "provider-renewal-required",
  );
  assert.throws(
    () => planNflCalendar({ ...input, verifiedAt: "2026-08-30T00:00:00Z" }),
    /Fresh/,
  );
  assert.throws(
    () => planNflCalendar({ ...input, verifiedAt: "2026-09-02T00:00:00Z" }),
    /Fresh/,
  );
});
test("review hash is deterministic and changes when the calendar changes", () => {
  const first = planNflCalendar(input);
  assert.equal(
    first.calendarHash,
    planNflCalendar({ ...input, games: [...games].reverse() }).calendarHash,
  );
  assert.notEqual(
    first.calendarHash,
    planNflCalendar({
      ...input,
      games: games.map((g, i) =>
        i ? g : { ...g, kickoff: "2026-09-08T01:00:00Z" },
      ),
    }).calendarHash,
  );
});
