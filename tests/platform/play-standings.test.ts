import { test } from "node:test";
import assert from "node:assert/strict";
import {
  slotPool,
  filterSlotPool,
  upcomingFixtures,
} from "../../src/core/lineup-picker";
import { teamFilter } from "../../src/core/card-presentation";
import {
  seasonStandings,
  sharedRanks,
  standingsPage,
  myTeamPage,
  type StandingRound,
  type StandingRow,
} from "../../src/core/standings";
import {
  competitionName,
  competitionLabel,
} from "../../src/core/competition-display";
import type { FantasyCard, FantasyCompetition } from "../../src/core/fantasy";
const comp = {
  id: "round",
  name: "Saved Salary Cap",
  locks_at: "2026-11-01T00:00:00Z",
  scored_at: null,
  sport: "nfl",
  season: "2026",
  round: 1,
  rules: { mode: "SALARY_CAP", lineup_version: "v1" },
} as FantasyCompetition;
const cards = ["QB", "RB", "WR", "TE", "K", "DEF"].map(
  (position, i) =>
    ({
      id: String(i),
      owner_id: "owner",
      sport: "nfl",
      season: "2026",
      position,
      tier: "RARE",
      team: "NYG",
      name: `Player ${position}`,
      player_id: String(i),
    }) as FantasyCard,
);
test("picker slot pool precedes intersected filters and pagination; no foreign inventory", () => {
  const inventory = [
    ...cards,
    ...cards.map((c) => ({ ...c, id: c.id + "foreign", owner_id: "other" })),
    ...cards.map((c) => ({ ...c, id: c.id + "sport", sport: "football" })),
  ];
  for (const p of ["QB", "RB", "WR", "TE"])
    assert.deepEqual(
      slotPool(inventory, "owner", comp, p + "1").map((c) => c.position),
      [p],
    );
  const flex = slotPool(inventory, "owner", comp, "FLEX1");
  assert.deepEqual(
    flex.map((c) => c.position),
    ["RB", "WR", "TE"],
  );
  assert.deepEqual(
    filterSlotPool(flex, {
      search: "Player R",
      tier: "RARE",
      team: "NYG",
      position: "RB",
    }).map((c) => c.position),
    ["RB"],
  );
  assert.equal(
    filterSlotPool(flex, { search: "", tier: "CORE", team: "", position: "" })
      .length,
    0,
  );
  assert.equal(
    filterSlotPool(flex, { search: "", tier: "", team: "", position: "" })
      .length,
    3,
  );
  assert.equal(
    slotPool(
      inventory,
      "owner",
      { ...comp, eligible_player_ids: ["0"] },
      "FLEX1",
    ).length,
    0,
  );
  assert.equal(slotPool(inventory, "owner", comp, "unknown").length, 0);
});
test("team filters distinguish shared cities, canonical aliases and unknown metadata", () => {
  assert.notEqual(teamFilter("NYG").label, teamFilter("NYJ").label);
  assert.notEqual(teamFilter("LA").label, teamFilter("LAC").label);
  assert.deepEqual(teamFilter("LA"), teamFilter("Los Angeles Rams"));
  assert.deepEqual(teamFilter("bad-code"), teamFilter(undefined));
});
const row = (key: string, centipoints: number | null): StandingRow => ({
  key,
  name: `Team ${key}`,
  isMe: key === "a",
  centipoints,
  rank: null,
  status: centipoints === null ? "pending-data" : "final",
  lineup: null,
});
const round = (
  id: string,
  week: number,
  rows: StandingRow[],
  overrides: Partial<StandingRound> = {},
): StandingRound => ({
  competitionId: id,
  label: id,
  mode: "SALARY_CAP",
  season: "2026",
  series: "one",
  week,
  visible: true,
  finalised: true,
  rows: sharedRanks(rows),
  ...overrides,
});
test("season totals isolate mode, season, series; reopened and missing weeks are excluded", () => {
  const rounds = [
    round("one", 1, [row("a", 10001), row("b", 10001), row("c", 5000)]),
    round("two", 2, [row("a", 50), row("b", 50), row("c", -100)]),
    round("pending", 3, [row("a", null)], { finalised: false }),
    round("other-mode", 1, [row("a", 99999)], { mode: "OPEN" }),
    round("other-season", 1, [row("a", 99999)], { season: "2025" }),
    round("other-series", 1, [row("a", 99999)], { series: "legacy" }),
  ];
  let result = seasonStandings(rounds, "SALARY_CAP", "2026", "one");
  assert.deepEqual(
    result.rows.map((r) => [r.centipoints, r.rank]),
    [
      [10051, 1],
      [10051, 1],
      [4900, 3],
    ],
  );
  assert.equal(result.rows[0].weeksEntered, 3);
  assert.equal(result.rows[0].weeksIncluded, 2);
  assert.equal(result.latestWeek, 2);
  rounds[1].finalised = false;
  result = seasonStandings(rounds, "SALARY_CAP", "2026", "one");
  assert.equal(result.rows[0].centipoints, 10001);
  assert.equal(result.latestWeek, 1);
  rounds[0].rows[0].centipoints = 11000;
  assert.equal(
    seasonStandings(rounds, "SALARY_CAP", "2026", "one").rows[0].centipoints,
    11000,
  );
  rounds[0].visible = false;
  assert.equal(
    seasonStandings(rounds, "SALARY_CAP", "2026", "one").latestWeek,
    null,
  );
  assert.ok(
    seasonStandings(rounds, "SALARY_CAP", "2026", "one").rows.every(
      (r) => r.rank === null && r.centipoints === null,
    ),
  );
});
test("shared ranks retain gaps and pending prevents invented rank; Find My Team reaches true page", () => {
  assert.deepEqual(
    sharedRanks([row("b", 100), row("a", 100), row("c", 99)]).map((r) => [
      r.key,
      r.rank,
    ]),
    [
      ["a", 1],
      ["b", 1],
      ["c", 3],
    ],
  );
  assert.ok(
    sharedRanks([row("b", null), row("a", 100)]).every((r) => r.rank === null),
  );
  const rows = Array.from({ length: 25 }, (_, i) => ({
    ...row(String(i), 2500 - i),
    isMe: i === 22,
    rank: i + 1,
  }));
  assert.equal(myTeamPage(rows), 3);
  assert.equal(
    standingsPage(rows, "", myTeamPage(rows)!).rows.find((r) => r.isMe)?.rank,
    23,
  );
  assert.equal(standingsPage(rows, "Team 22", 1).rows[0].rank, 23);
});
test("display names leave stable modes and saved historical labels intact", () => {
  assert.equal(competitionName("SALARY_CAP"), "Traditional");
  assert.equal(competitionName("OPEN"), "All-Star");
  assert.equal(competitionLabel({ ...comp, rules: {} }), "Saved Salary Cap");
  assert.equal(comp.rules.mode, "SALARY_CAP");
});

test("upcoming fixtures deduplicate identities, preserving distinct games and selected snapshot", () => {
  const one = {
    fixtureId: "one",
    scheduledAt: "2026-11-01T00:00:00Z",
    playerIds: ["p"],
  };
  const fixtures = upcomingFixtures(
    {
      selected: [one],
      other: [
        { ...one, scheduledAt: "2026-11-02T00:00:00Z" },
        { ...one, fixtureId: "two" },
      ],
    },
    "selected",
    "p",
    0,
  );
  assert.equal(fixtures.length, 2);
  assert.equal(
    fixtures.find((f) => f.fixtureId === "one")?.scheduledAt,
    one.scheduledAt,
  );
});
