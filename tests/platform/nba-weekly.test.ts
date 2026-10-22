import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nbaWeek,
  freezeNbaWeek,
  nbaWeeklyLineup,
  nbaWeeklyRules,
} from "../../src/core/nba-weekly";
import {
  scorePlayer,
  validateLineup,
  lockRarity,
} from "../../src/core/scoring-v1";
import { sportEventRules } from "../../src/core/sport-event-rules";
import {
  nbaConfiguration,
  nbaWeeklyConfiguration,
} from "../../src/core/sport-configuration";
import { autoSelect } from "../../src/core/lineup-auto-select";
import { sevenIssues } from "../../src/core/nfl-seven";
import {
  createPeriod,
  saveTeam,
  lockTeams,
  importStatistics,
  results,
  finalise,
  validatePeriodDefinition,
  type CatalogCard,
} from "../../src/core/scoring-engine";

const rules = nbaWeeklyRules();
const zero = {
  points: 0,
  rebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  threePointers: 0,
};
test("NBA proposal: exact example, negatives, thresholds, stacking and old-version isolation", () => {
  const example = {
    ...zero,
    points: 28,
    rebounds: 9,
    assists: 7,
    steals: 2,
    blocks: 1,
    turnovers: 3,
  };
  assert.equal(scorePlayer(rules, "PG", example).centipoints, 5530);
  assert.equal(
    scorePlayer(sportEventRules("basketball"), "PG", example).centipoints,
    6000,
  );
  assert.equal(
    scorePlayer(rules, "C", { ...zero, points: 10, rebounds: 10 }).centipoints,
    2350,
  );
  assert.equal(
    scorePlayer(rules, "C", { ...zero, points: 10, rebounds: 10, assists: 10 })
      .centipoints,
    4150,
  );
  assert.equal(
    scorePlayer(rules, "PG", { ...zero, turnovers: 5 }).centipoints,
    -500,
  );
  assert.equal(
    scorePlayer(rules, "PG", {
      ...zero,
      points: 9,
      rebounds: 9,
      assists: 9,
    }).parts.at(-2)?.quantity,
    0,
  );
  assert.equal(
    scorePlayer(rules, "PG", { ...zero, steals: 10, blocks: 10 }).centipoints,
    6150,
  );
  assert.equal(
    scorePlayer(rules, "PG", { ...zero, points: 10, threePointers: 3 })
      .centipoints,
    1000,
  );
  assert.throws(() => scorePlayer(rules, "PG", { ...zero, rebounds: null }));
  assert.throws(() => scorePlayer(rules, "PG", { ...zero, points: 1.5 }));
  assert.throws(
    () =>
      scorePlayer(
        { ...rules, weights: { ...rules.weights, rebounds: 100 } },
        "C",
        zero,
      ),
    /Frozen/,
  );
  assert.throws(
    () => scorePlayer({ ...rules, bonuses: undefined }, "C", zero),
    /Frozen/,
  );
  assert.deepEqual(
    lockRarity(rules, {
      cardId: "x",
      playerId: "x",
      position: "C",
      rarity: "ICON",
    }),
    {},
  );
  assert.equal(nbaConfiguration.slots.at(-1)?.id, "FLEX3");
  assert.equal(nbaWeeklyConfiguration.publicEnabled, false);
  assert.equal(nbaWeeklyConfiguration.issuanceApproved, false);
});
test("NBA weeks are New York calendar weeks: DST, midnight, year boundary and overnight completion", () => {
  for (const [instant, hours] of [
    ["2026-03-08T17:00:00Z", 167],
    ["2026-11-01T17:00:00Z", 169],
    ["2026-10-22T17:00:00Z", 168],
  ] as const) {
    const w = nbaWeek(instant);
    assert.equal((Date.parse(w.end) - Date.parse(w.start)) / 3600000, hours);
  }
  assert.equal(nbaWeek("2026-10-26T03:59:59Z").key, "2026-10-19");
  assert.equal(nbaWeek("2026-10-26T04:00:00Z").key, "2026-10-26");
  assert.equal(nbaWeek("2027-01-01T00:00:00Z").key, "2026-12-28");
  assert.throws(() => nbaWeek("2026-11-01T01:30:00"), /Explicit/);
  assert.equal(
    nbaWeek("2026-11-01T01:30:00-04:00").key,
    nbaWeek("2026-11-01T01:30:00-05:00").key,
  );
  const fixture = {
    id: "sim:basketball:game",
    scheduledAt: "2026-10-26T03:00:00Z",
    playerIds: ["player"],
    status: "scheduled",
  };
  const frozen = freezeNbaWeek("2026-10-19", [fixture], {
    complete: true,
    previouslyAssigned: {},
  });
  assert.equal(frozen.fixtures[0].id, fixture.id); // An end time is deliberately not an assignment input.
  assert.equal(frozen.locksAt, fixture.scheduledAt);
  assert.throws(
    () =>
      freezeNbaWeek("2026-10-19", [fixture, fixture], {
        complete: true,
        previouslyAssigned: {},
      }),
    /Duplicate/,
  );
  assert.throws(
    () =>
      freezeNbaWeek(
        "2026-10-26",
        [{ ...fixture, scheduledAt: "2026-10-27T00:00:00Z" }],
        { complete: true, previouslyAssigned: { [fixture.id]: "2026-10-19" } },
      ),
    /already assigned/,
  );
  for (const status of ["cancelled", "postponed", "suspended", "rescheduled"])
    assert.throws(
      () =>
        freezeNbaWeek("2026-10-19", [{ ...fixture, status }], {
          complete: true,
          previouslyAssigned: {},
        }),
      /review/,
    );
});
test("NBA eight-slot optimisation respects G/F/UTIL, canonical duplicates, eligibility and salary", () => {
  const cfg = nbaWeeklyLineup();
  const cards = cfg.slots.map((s, i) => ({
    id: `c${i}`,
    player_id: `p${i}`,
    position: s.positions[0],
    eligible_positions: [s.positions[0]],
    sport: "basketball",
    tier: "CORE",
    status: "active",
    listed: false,
    value: 100 + i,
  }));
  const select = autoSelect(cards, "SALARY_CAP", [], cfg);
  assert.equal(select.picks.length, 8);
  assert.equal(select.cost, 4_000_000);
  assert.deepEqual(
    sevenIssues("SALARY_CAP", select.picks, cards, true, cfg).errors,
    [],
  );
  assert.equal(
    autoSelect(
      cards.map((c) => ({ ...c, tier: "ICON" })),
      "SALARY_CAP",
      [],
      cfg,
    ).picks.length,
    6,
  );
  assert.equal(
    autoSelect(
      cards.map((c) => ({ ...c, tier: "ICON" })),
      "OPEN",
      [],
      cfg,
    ).picks.length,
    8,
  );
  assert.equal(
    autoSelect(
      cards.map((c, i) => ({
        ...c,
        canonical_player_id: i === 7 ? "p0" : c.player_id,
      })),
      "OPEN",
      [],
      cfg,
    ).picks.length,
    7,
  );
  assert.equal(
    autoSelect(
      cards.map((c, i) => (i === 0 ? { ...c, status: "unverified" } : c)),
      "OPEN",
      [],
      cfg,
    ).picks.length,
    7,
  );
  const picks = select.picks.map((p) => ({ ...p }));
  const guard = picks.find((p) => p.slot === "G1")!;
  guard.card = cards[4].id;
  assert.ok(
    sevenIssues("OPEN", picks, cards, true, cfg).errors.some((e) =>
      e.includes("G1"),
    ),
  );
  const dual = cfg.slots.map((s, i) => ({
    cardId: `c${i}`,
    playerId: `p${i}`,
    position: s.positions[0],
    eligiblePositions: [s.positions[0]],
  }));
  dual[1] = { ...dual[1], position: "PG", eligiblePositions: ["PG", "SG"] };
  assert.doesNotThrow(() => validateLineup(rules, dual));
  assert.throws(
    () =>
      validateLineup(
        rules,
        dual.map((c, i) =>
          i === 1 ? { ...c, eligiblePositions: ["SG", "XXX"] } : c,
        ),
      ),
    /eligibility/,
  );
});
test("NBA weekly scoring: partial standings, DNP, missing, corrections, stable ties and final protection", () => {
  const cards: CatalogCard[] = rules.slots.map((s, i) => ({
    cardId: `c${i}`,
    playerId: `p${i}`,
    position: s.positions[0],
    owner: "a",
    sport: "basketball",
    eligible: true,
  }));
  const second = cards.map((c) => ({
    ...c,
    cardId: `b${c.cardId}`,
    owner: "b",
  }));
  const ids = cards.map((c) => c.playerId),
    before = "2026-10-19T05:00:00Z",
    lock = "2026-10-20T00:00:00Z",
    at = "2026-10-22T04:00:00Z";
  const frozen = freezeNbaWeek(
    "2026-10-19",
    [0, 1].map((i) => ({
      id: `sim:basketball:g${i}`,
      scheduledAt: i ? "2026-10-22T00:00:00Z" : lock,
      playerIds: ids,
      status: "scheduled",
    })),
    { complete: true, previouslyAssigned: {} },
  );
  const definition = {
    ...frozen,
    id: "sim:basketball:weekly",
    sport: "basketball" as const,
    label: "Synthetic week",
    rules,
  };
  assert.throws(
    () =>
      validatePeriodDefinition(
        { ...definition, id: "beta-real:basketball:weekly" },
        before,
        "authorised",
      ),
    /isolated-only/,
  );
  let s = createPeriod(definition, before);
  s = saveTeam(
    s,
    "a",
    "Alpha",
    cards.map((c) => c.cardId),
    cards,
    before,
  );
  assert.throws(
    () =>
      saveTeam(
        s,
        "a",
        "Changed",
        cards.map((c) => c.cardId),
        cards,
        before,
      ),
    /name is fixed/,
  );
  s = saveTeam(
    s,
    "b",
    "Beta",
    second.map((c) => c.cardId),
    second,
    before,
  );
  s = lockTeams(s, [...cards, ...second], lock);
  assert.throws(
    () =>
      saveTeam(
        s,
        "a",
        "Alpha",
        cards.map((c) => c.cardId),
        cards,
        lock,
      ),
    /locked/,
  );
  const op = { id: "qa", role: "reviewer" as const };
  const source = (game: number, revision = 1, missing = false) => ({
    provider: "docked-synthetic-v1",
    simulated: true,
    sport: "basketball",
    fixtureId: `sim:basketball:g${game}`,
    revision,
    observedAt: at,
    status: "completed",
    endedAt: at,
    players: ids.map((playerId, i) => ({
      playerId,
      availability:
        i === 0 ? "confirmed-dnp" : missing && i === 1 ? "pending" : "complete",
      stats:
        i === 0 || (missing && i === 1)
          ? null
          : {
              ...zero,
              points: 10,
              rebounds: 10,
              assists: revision === 2 ? 10 : 0,
            },
    })),
  });
  assert.equal(results(s).rows[0].rank, null);
  s = importStatistics(s, source(0), op, at);
  let r = results(s);
  assert.equal(r.rows[0].centipoints, null);
  assert.equal(r.rows[0].knownCentipoints, 7 * 2350);
  assert.equal(r.rows[0].rank, 1);
  assert.equal(r.rows[1].rank, 1);
  s = importStatistics(s, source(1, 1, true), op, at);
  assert.equal(results(s).rows[0].centipoints, null);
  assert.throws(() => finalise(s, op, "2026-10-27T04:00:00Z"), /Pending data/);
  s = importStatistics(s, source(1, 2), op, at);
  r = results(s);
  assert.equal(r.rows[0].centipoints, 7 * (2350 + 4150));
  assert.equal(r.rows[0].players[0].centipoints, 0);
  assert.equal(r.rows[0].players[1].matches[1].revision, 2);
  const audits = s.audits.length;
  s = importStatistics(s, source(1, 2), op, at);
  assert.equal(s.audits.length, audits);
  assert.ok(s.audits.some((a) => a.action === "statistics-corrected"));
  s = finalise(s, op, "2026-10-27T04:00:00Z");
  assert.equal(results(s).rows[0].status, "final");
  assert.throws(
    () => importStatistics(s, source(1, 3), op, "2026-10-27T04:00:00Z"),
    /correction|final|review/i,
  );
});
