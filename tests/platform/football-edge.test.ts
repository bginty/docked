import test from "node:test";
import assert from "node:assert/strict";
import {
  compareFootballPrediction,
  predictThenCompare,
  validateFootballEdgeStrategy,
  type FootballPredictionEvidence,
} from "../../src/core/football-edge";
import { hash, strategyV1, type Rules } from "../../src/core/pricing";
import {
  marketReferenceV1,
  type MarketReference,
} from "../../src/core/market-reference";
// Arithmetic-only fixtures: never sporting inputs, registered models or official publications.
const rules: Rules = {
  eventId: "fictional-event",
  competition: "soccer_epl",
  participants: ["Fictional Home", "Fictional Away"],
  market: "football_1x2",
  period: "full_game",
  overtime: false,
  draw: true,
  line: null,
  settlement: "regulation_90_plus_stoppage",
  outcomes: ["Fictional Home", "Draw", "Fictional Away"],
};
const cfg = validateFootballEdgeStrategy({
  ...strategyV1,
  version: "football-independent-edge-v1.0.0-fixture",
  method: "football-independent-model",
  aggregation: "independent-sport-model-v1",
  selectionRule: "EV-desc-selection-ascending",
  modelVersion: "football-goals-v1.0.0-fixture",
  maxSportDataAgeSeconds: 86400,
  maxEdgesPerEvent: 1,
  stakeUnits: "1.00",
  minEV: "0.05",
  competitions: ["soccer_epl"],
  marketReference: {
    ...marketReferenceV1,
    availabilityBookmakers: ["fictional-a", "fictional-b"],
  },
});
const p: FootballPredictionEvidence = {
  id: "retained-fictional-id",
  eventId: rules.eventId,
  modelVersion: cfg.modelVersion,
  codeCommit: "a".repeat(40),
  configHash: "b".repeat(64),
  inputHash: "c".repeat(64),
  dataCutoff: "2026-10-04T00:00:00Z",
  asOfTime: "2026-10-04T01:00:00Z",
  calculatedAt: "2026-10-04T01:00:00Z",
  recordedAt: "2026-10-04T01:00:01Z",
  startAt: "2026-10-04T07:00:00Z",
  homeTeam: rules.participants[0],
  awayTeam: rules.participants[1],
  probabilities: { home: "0.58", draw: "0.22", away: "0.20" },
  quality: "READY",
};
const reference: MarketReference = {
  methodologyVersion: cfg.marketReference.version,
  configHash: hash(cfg.marketReference),
  rulesHash: hash(rules),
  selection: p.homeTeam,
  decimalPrice: "2.00",
  observedAt: "2026-10-04T01:00:02Z",
  sourceAt: "2026-10-04T01:00:00Z",
  snapshotAt: "2026-10-04T01:00:01Z",
  receivedAt: "2026-10-04T01:00:01Z",
  pricing: null,
  availability: {
    sourceIds: ["a", "b"],
    operators: ["a", "b"],
    sourceCount: 2,
  },
  evidenceHash: "d".repeat(64),
  evidenceMode: "current",
};
const input = {
  prediction: p,
  rules,
  decisionAt: reference.observedAt,
  references: [reference],
};
test("independent football uses the complete model vector and never anchors to market probabilities", () => {
  const result = compareFootballPrediction(input, cfg);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].ev, "0.16");
  assert.equal(result.candidates[0].minimumOdds, "1.82"); // 1.05/.58 rounds UP; $1.81 fails 5%.
  assert.equal(result.candidates[0].probability, "0.58");
  const anchored = compareFootballPrediction(
    {
      ...input,
      references: [
        {
          ...reference,
          pricing: {
            probability: "0.01",
            fairPrice: "100",
            sourceIds: ["unused"],
            operators: ["unused"],
          },
        },
      ],
    },
    cfg,
  );
  assert.deepEqual(anchored.candidates[0], {
    ...result.candidates[0],
    reference: anchored.candidates[0].reference,
  });
});
test("malformed or incomplete sporting probabilities, later data and wrong models fail closed", () => {
  for (const patch of [
    { probabilities: { home: ".6", draw: ".3", away: ".2" } },
    { probabilities: { home: "NaN", draw: ".3", away: ".2" } },
    { dataCutoff: "2026-10-04T01:00:01Z" },
    { dataCutoff: "2026-10-01T00:00:00Z" },
    { recordedAt: "2026-10-04T01:00:03Z" },
    { modelVersion: "football-other-v2" },
    { homeTeam: p.awayTeam },
  ])
    assert.equal(
      compareFootballPrediction(
        { ...input, prediction: { ...p, ...patch } },
        cfg,
      ).candidates.length,
      0,
    );
});
test("old/research/duplicate references and push-capable rules cannot become candidates", () => {
  for (const references of [
    [{ ...reference, sourceAt: "2026-10-04T00:55:00Z" }],
    [{ ...reference, evidenceMode: "research" as const }],
    [{ ...reference, observedAt: "2026-10-04T00:59:59Z" }],
    [reference, reference],
    [{ ...reference, decimalPrice: "1.81" }],
  ])
    assert.equal(
      compareFootballPrediction({ ...input, references }, cfg).candidates
        .length,
      0,
    );
  assert.equal(
    compareFootballPrediction(
      { ...input, rules: { ...rules, settlement: "draw_no_bet_push" } },
      cfg,
    ).candidates.length,
    0,
  );
});
test("model prediction commits before market reads, including no edge and provider failure", async () => {
  const sequence: string[] = [];
  await assert.rejects(
    predictThenCompare({
      predictAndPersist: async () => {
        sequence.push("committed");
        return p;
      },
      comparisonPermitted: () => true,
      compareMarket: async () => {
        sequence.push("market");
        throw Error("Unavailable market");
      },
    }),
  );
  assert.deepEqual(sequence, ["committed", "market"]);
  const abstained = await predictThenCompare({
    predictAndPersist: async () => ({ status: "NOT_CONFIGURED" }),
    comparisonPermitted: () => false,
    compareMarket: async () => {
      throw Error("Market must not be read");
    },
  });
  assert.equal(abstained.comparison, null);
});
test("football strategy versions cannot weaken safeguards, vary stakes or publish correlated selections", () => {
  for (const patch of [
    { maxEdgesPerEvent: 2 },
    { stakeUnits: "2.00" },
    { minEV: "0.001" },
    { maxAgeSeconds: 181 },
    { competitions: ["basketball_nba"] },
    { modelVersion: "market-reference-baseline-v1" },
  ])
    assert.throws(() => validateFootballEdgeStrategy({ ...cfg, ...patch }));
  assert.notEqual(
    hash(cfg),
    hash(
      validateFootballEdgeStrategy({
        ...cfg,
        version: "football-independent-edge-v2.0.0-fixture",
        minEV: "0.07",
      }),
    ),
  );
});
