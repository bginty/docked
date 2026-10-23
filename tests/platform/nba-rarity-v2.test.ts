import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nbaRarityWeeklyRules,
  nbaWeeklyRules,
  nbaWeek,
} from "../../src/core/nba-weekly";
import {
  lockRarity,
  scorePlayer,
  validateLineup,
} from "../../src/core/scoring-v1";
import {
  createPeriod,
  saveTeam,
  lockTeams,
  importStatistics,
  results,
  finalise,
  digest,
  type CatalogCard,
} from "../../src/core/scoring-engine";
import { rarities, rarityRule, rarityPoints } from "../../src/core/card-rarity";
import { sandboxScoreView } from "../../src/core/sandbox-score-view";
import type { SandboxState } from "../../src/core/sport-sandbox";
const rules = nbaRarityWeeklyRules();
const stats = {
  points: 10,
  rebounds: 10,
  assists: 10,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  threePointers: 0,
};
function fixture(rarity: (typeof rarities)[number], legacy = false) {
  const w = nbaWeek("2099-02-02T20:00:00Z");
  const cards: CatalogCard[] = rules.slots.map((s, i) => ({
    cardId: `c${i}`,
    playerId: `p${i}`,
    position: s.positions[0],
    sport: "basketball",
    owner: "member",
    eligible: true,
    rarity,
  }));
  let state = createPeriod(
    {
      id: "sim:basketball:round",
      sport: "basketball",
      label: "Isolated rarity test",
      locksAt: "2099-02-02T20:00:00Z",
      window: { start: w.start, end: w.end, timezone: w.timezone },
      rules: legacy ? nbaWeeklyRules() : rules,
      fixtures: [0, 1].map((i) => ({
        id: `sim:basketball:g${i}`,
        scheduledAt: `2099-02-0${i + 2}T20:00:00Z`,
        playerIds: cards.map((c) => c.playerId),
      })),
    },
    "2099-01-01T20:00:00Z",
  );
  state = saveTeam(
    state,
    "member",
    "Team",
    cards.map((c) => c.cardId),
    cards,
    "2099-01-01T20:00:00Z",
  );
  state.entries[0].cards.forEach((c, i) => (c.slot = rules.slots[i].id));
  state = lockTeams(state, cards, state.period.locksAt);
  return { state, cards };
}
const source = (game = 0, revision = 1) => ({
  provider: "docked-synthetic-v1",
  simulated: true,
  sport: "basketball",
  fixtureId: `sim:basketball:g${game}`,
  revision,
  observedAt: `2099-02-0${game + 2}T23:00:00Z`,
  endedAt: `2099-02-0${game + 2}T22:00:00Z`,
  status: "completed",
  players: rules.slots.map((_, i) => ({
    playerId: `p${i}`,
    availability: i === 7 ? "confirmed-dnp" : "complete",
    stats: i === 7 ? null : { ...stats, points: 10 + revision - 1 },
  })),
});
const reviewer = { id: "reviewer", role: "reviewer" as const };
test("NBA V2 preserves base bonuses and uses the exact approved NFL rarity table once", () => {
  assert.deepEqual(
    rarities.map((r) => rarityRule(r).multiplierTenths),
    [10, 11, 12, 13, 14, 15],
  );
  assert.equal(scorePlayer(rules, "PG", stats).centipoints, 4150);
  assert.deepEqual(rules.weights, nbaWeeklyRules().weights);
  assert.deepEqual(rules.bonuses, nbaWeeklyRules().bonuses);
  for (const rarity of rarities) {
    let { state } = fixture(rarity);
    const v = rarityRule(rarity).multiplierTenths;
    state = importStatistics(state, source(), reviewer, "2099-02-02T23:00:00Z");
    const partial = results(state).rows[0];
    assert.equal(partial.centipoints, null);
    assert.equal(partial.knownCentipoints, rarityPoints(4150, v) * 7);
    const view = {
      sport: "basketball",
      server_time: "2099-02-03T23:00:00Z",
      user_id: "member",
      competitions: [
        {
          id: "round",
          sport: "basketball",
          locks_at: state.period.locksAt,
          rules: {
            lineup_version: "docked-nba-weekly-lineup-proposal-v1",
            scoring_version: rules.version,
          },
        },
      ],
      entries: [
        {
          competition_id: "round",
          user_id: "member",
          snapshot: state.entries[0].cards.map((c) => ({
            card_id: c.cardId,
            player_id: c.playerId,
            slot: c.slot,
            tier: rarity,
            fixture_ids: state.period.fixtures.map((f) => f.id),
          })),
        },
      ],
    } as unknown as SandboxState;
    const projection = sandboxScoreView(view, [
      { competition_id: "round", state_hash: digest(state), body: state },
    ]).round.rows[0];
    assert.equal(projection.players[0].points, rarityPoints(4150, v));
    assert.equal(projection.points, partial.knownCentipoints);
    view.entries[0].snapshot[0].tier = rarity === "ICON" ? "CORE" : "ICON";
    assert.throws(
      () =>
        sandboxScoreView(view, [
          { competition_id: "round", state_hash: digest(state), body: state },
        ]),
      /disagree/,
    );
    state = importStatistics(
      state,
      source(1),
      reviewer,
      "2099-02-03T23:00:00Z",
    );
    assert.equal(results(state).rows[0].centipoints, rarityPoints(8300, v) * 7);
    assert.equal(results(state).rows[0].players[7].centipoints, 0);
  }
});
test("NBA V2 corrections replay idempotently; finalised and V1 historical results are protected", () => {
  let { state } = fixture("LEGENDARY");
  state = importStatistics(state, source(), reviewer, "2099-02-02T23:00:00Z");
  state = importStatistics(state, source(1), reviewer, "2099-02-03T23:00:00Z");
  const corrected = { ...source(0, 2), observedAt: "2099-02-04T23:00:00Z" };
  state = importStatistics(state, corrected, reviewer, "2099-02-04T23:00:00Z");
  const replay = importStatistics(
    state,
    corrected,
    reviewer,
    "2099-02-04T23:00:00Z",
  );
  assert.deepEqual(replay, state);
  assert.equal(results(state).rows[0].centipoints, 8400 * 1.4 * 7);
  state = finalise(state, reviewer, "2099-02-10T23:00:00Z");
  assert.throws(() =>
    importStatistics(
      state,
      { ...source(0, 3), observedAt: "2099-02-11T23:00:00Z" },
      reviewer,
      "2099-02-11T23:00:00Z",
    ),
  );
  let old = fixture("ICON", true).state;
  old = importStatistics(old, source(), reviewer, "2099-02-02T23:00:00Z");
  assert.equal(results(old).rows[0].knownCentipoints, 4150 * 7);
});
test("Only authoritative rarity derives NBA multipliers; invalid locks and missing statistics fail closed", () => {
  const { state } = fixture("ICON");
  assert.equal(results(state).rows[0].centipoints, null);
  const card = { ...state.entries[0].cards[0], multiplierTenths: 999 };
  assert.equal(lockRarity(rules, card).multiplierTenths, 15);
  assert.throws(
    () => validateLineup(rules, [card, ...state.entries[0].cards.slice(1)]),
    /rarity snapshot/,
  );
  assert.equal(rarityPoints(-415, 15), -623);
  assert.equal(rarityPoints(415, 15), 623);
});
