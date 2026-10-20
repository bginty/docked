import { test } from "node:test";
import assert from "node:assert/strict";
import verified from "../fixtures/postgame/kamara-week-six-verified.json";
import { nflPlayerHistory } from "../../src/core/nfl-player-history";
import {
  scorePlayer,
  rulesets,
  nflPostgameTestRules,
  nflRarityRules,
} from "../../src/core/scoring-v1";
import { rarityPoints } from "../../src/core/card-rarity";
import {
  competitionScoringLabel,
  historyScoringLabel,
} from "../../src/core/scoring-context";
import {
  syntheticScenario,
  scenarioTimes as t,
} from "../../src/core/scoring-synthetic";
import {
  createPeriod,
  saveTeam,
  lockTeams,
  importStatistics,
  results,
} from "../../src/core/scoring-engine";
test("verified Kamara Week 6 reconciles the same stats under distinct saved rules, not a multiplier defect", () => {
  const history = nflPlayerHistory(
    [verified.history],
    "2026",
    verified.history.last_success,
  );
  assert.equal(history.games?.[0].base, 1490);
  const fields = Object.fromEntries(
    Object.keys(rulesets.nfl.weights).map((k) => [
      k,
      (verified.competition.statistics as Record<string, number>)[k],
    ]),
  );
  assert.equal(scorePlayer(rulesets.nfl, "RB", fields).centipoints, 1390);
  assert.equal(rarityPoints(1390, 14), 1946);
  assert.equal(rarityPoints(1490, 14), 2086);
  assert.equal(
    scorePlayer(
      nflPostgameTestRules(),
      "RB",
      Object.fromEntries(
        Object.keys(nflPostgameTestRules().weights).map((k) => [k, fields[k]]),
      ),
    ).centipoints,
    1490,
  );
  assert.match(historyScoringLabel(history.scoringVersion), /Full-PPR/);
  assert.match(
    competitionScoringLabel({
      receptionCentipoints: 50,
      rarityVersion: "locked",
    }),
    /Half-PPR/,
  );
});
test("authoritative engine applies Kamara multiplier once and sums the same contributions; non-rarity rounds omit it", () => {
  const f = syntheticScenario("nfl");
  for (const rules of [rulesets.nfl, nflRarityRules()]) {
    const catalog = f.catalog.map((c) => ({
      ...c,
      rarity: "LEGENDARY" as const,
    }));
    let state = createPeriod({ ...f.state.period, rules }, t.created);
    state = saveTeam(
      state,
      "amber",
      "QA",
      catalog.filter((c) => c.owner === "amber").map((c) => c.cardId),
      catalog,
      t.save,
    );
    state = lockTeams(state, catalog, t.lock);
    const rb = catalog.find((c) => c.owner === "amber" && c.position === "RB")!;
    const source = structuredClone(f.source);
    source.players.find((p) => p.playerId === rb.playerId)!.stats =
      Object.fromEntries(
        Object.keys(rulesets.nfl.weights).map((k) => [
          k,
          (verified.competition.statistics as Record<string, number>)[k],
        ]),
      );
    state = importStatistics(
      state,
      source,
      { id: "qa", role: "importer" },
      t.initial,
    );
    const result = results(state).rows[0];
    assert.equal(
      result.players.find((p) => p.playerId === rb.playerId)!.centipoints,
      rules.rarityVersion ? 1946 : 1390,
    );
    assert.equal(
      result.centipoints,
      result.players.reduce((sum, p) => sum + p.centipoints!, 0),
    );
    assert.equal(result.rank, 1);
  }
  assert.equal(rarityPoints(5, 11), 6);
  assert.equal(rarityPoints(-5, 11), -6);
});
