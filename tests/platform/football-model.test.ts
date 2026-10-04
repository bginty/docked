import assert from "node:assert/strict";
import test from "node:test";
import {
  NotConfiguredFootballModelProvider,
  footballModelProposal,
  footballSportingInputHash,
  validateFootballProbabilities,
  validateFootballSportingInput,
  validateFootballPrediction,
  type FootballModelEvent,
  type FootballModelProvider,
} from "../../src/core/football-model";
import {
  footballCalibration,
  type FootballCalibrationRequest,
} from "../../src/core/model-calibration";

// Authored contract fixtures only: no sporting data or fitted model is installed.
const event: FootballModelEvent = {
  eventId: "FIXTURE-TARGET",
  sport: "football",
  competitionId: "FIXTURE-LEAGUE",
  homeTeamId: "A",
  awayTeamId: "B",
  startAt: "2026-10-04T12:00:00Z",
  knownAt: "2026-10-01T00:00:00Z",
  sourceId: "fixture",
  status: "scheduled",
};
function input() {
  return {
    schemaVersion: "football-sporting-input-v1",
    event,
    asOfTime: "2026-10-04T10:00:00Z",
    calculatedAt: "2026-10-04T10:00:01Z",
    codeCommit: "a".repeat(40),
    sourceApprovals: [
      {
        sourceId: "fixture",
        provider: "AUTHORED-TEST-ONLY",
        sourceVersion: "v1",
        rightsReference: "FICTIONAL CONTRACT TEST",
        allowedPurposes: [
          "model_training",
          "derived_probabilities",
          "retained_evidence",
        ],
        knownAt: "2026-09-01T00:00:00Z",
        effectiveFrom: "2026-09-01T00:00:00Z",
        effectiveTo: "2026-11-01T00:00:00Z",
      },
    ],
    matches: [
      {
        id: "result1",
        eventId: "FIXTURE-PAST",
        competitionId: "FIXTURE-LEAGUE",
        homeTeamId: "A",
        awayTeamId: "B",
        startAt: "2026-10-01T12:00:00Z",
        completedAt: "2026-10-01T14:00:00Z",
        knownAt: "2026-10-01T14:01:00Z",
        receivedAt: "2026-10-01T14:02:00Z",
        sourceId: "fixture",
        revision: 1,
        status: "final",
        regulationHomeGoals: 1,
        regulationAwayGoals: 0,
      },
    ],
    missingRequired: [],
    missingOptional: ["injuries", "lineups"],
  };
}
test("football probabilities require exact complete finite distribution without price fields", () => {
  assert.deepEqual(
    validateFootballProbabilities({ home: "0.5", draw: "0.3", away: "0.2" }),
    { home: "0.5", draw: "0.3", away: "0.2" },
  );
  for (const bad of [
    { home: "0.5", draw: "0.3", away: "0.3" },
    { home: "0.50000000000000000000000001", draw: "0.3", away: "0.2" },
    { home: "NaN", draw: "0", away: "1" },
    { home: "-0.1", draw: "0.1", away: "1" },
    { home: "1", draw: "0" },
    { home: "1", draw: "0", away: "0", marketPrice: 2 },
  ])
    assert.throws(() => validateFootballProbabilities(bad));
});
test("sporting snapshot rejects odds, target outcome and future-known evidence", () => {
  assert.equal(validateFootballSportingInput(input()).matches.length, 1);
  assert.equal(
    footballSportingInputHash(input()),
    footballSportingInputHash(structuredClone(input())),
  );
  assert.throws(() => validateFootballSportingInput({ ...input(), odds: 2 }));
  for (const mutate of [
    (v: ReturnType<typeof input>) => {
      v.matches[0].eventId = event.eventId;
    },
    (v: ReturnType<typeof input>) => {
      v.matches[0].receivedAt = "2026-10-04T11:00:00Z";
    },
    (v: ReturnType<typeof input>) => {
      v.matches[0].knownAt = "2026-10-04T11:00:00Z";
    },
    (v: ReturnType<typeof input>) => {
      v.sourceApprovals[0].knownAt = "2026-10-04T11:00:00Z";
    },
    (v: ReturnType<typeof input>) => {
      v.sourceApprovals[0].effectiveTo = "2026-10-04T09:00:00Z";
    },
    (v: ReturnType<typeof input>) => {
      v.sourceApprovals[0].allowedPurposes = [
        "model_training",
        "model_training",
        "model_training",
      ];
    },
    (v: ReturnType<typeof input>) => {
      v.matches.push({ ...v.matches[0], id: "revision2", revision: 2 });
    },
    (v: ReturnType<typeof input>) => {
      v.matches[0].regulationHomeGoals = Number.NaN;
    },
  ]) {
    const v = input();
    mutate(v);
    assert.throws(() => validateFootballSportingInput(v));
  }
});
test("unconfigured provider cannot invent probabilities or numerical model configuration", async () => {
  assert.equal(footballModelProposal.parameters, null);
  assert.equal(footballModelProposal.trainingDataHash, null);
  const provider: FootballModelProvider =
    new NotConfiguredFootballModelProvider(
      () => new Date("2026-10-04T10:00:01Z"),
    );
  const result = await provider.estimate(
    event,
    "2026-10-04T10:00:00Z",
    "future-review-version",
  );
  assert.equal(result.status, "NOT_CONFIGURED");
  if (result.status !== "NOT_CONFIGURED") assert.fail();
  assert.equal(result.probabilities, null);
  assert.equal(result.configHash, null);
  assert.equal(result.uncertainty, null);
  await assert.rejects(provider.estimate(event, "2026-10-04T12:00:00Z", "v1"));
});
test("future model injection is only a structural test boundary, with prospective provenance enforced", async () => {
  const fixture = {
    eventId: event.eventId,
    modelVersion: "TEST-ONLY",
    codeCommit: "a".repeat(40),
    configHash: "b".repeat(64),
    inputHash: "c".repeat(64),
    asOfTime: "2026-10-04T10:00:00Z",
    calculatedAt: "2026-10-04T10:00:01Z",
    dataCutoff: "2026-10-04T09:59:00Z",
    startAt: event.startAt,
    probabilities: { home: "0.5", draw: "0.3", away: "0.2" },
    sourceIds: ["AUTHORED-TEST-ONLY"],
    quality: "READY" as const,
    uncertainty: null,
  };
  const provider: FootballModelProvider = {
    async estimate() {
      return { ...validateFootballPrediction(fixture), status: "PREDICTED" };
    },
  };
  assert.equal(
    (await provider.estimate(event, fixture.asOfTime, "TEST-ONLY")).status,
    "PREDICTED",
  );
  assert.throws(() =>
    validateFootballPrediction({
      ...fixture,
      dataCutoff: "2026-10-04T11:00:00Z",
    }),
  );
  assert.throws(() =>
    validateFootballPrediction({ ...fixture, calculatedAt: event.startAt }),
  );
  assert.throws(() =>
    validateFootballPrediction({ ...fixture, uncertainty: "high confidence" }),
  );
});
function calibration(): FootballCalibrationRequest {
  return {
    modelVersion: "TEST-ONLY",
    decisionWindow: "24h",
    from: "2026-10-03T00:00:00Z",
    to: "2026-10-04T00:00:00Z",
    asOfTime: "2026-10-05T00:00:00Z",
    attempts: [],
    outcomes: [],
  };
}
const attempt = (
  id: string,
  status: "PREDICTED" | "ABSTAINED" | "FAILED" | "NOT_CONFIGURED" = "PREDICTED",
) =>
  ({
    id,
    eventId: id,
    modelVersion: "TEST-ONLY",
    decisionWindow: "24h",
    asOfTime: "2026-10-03T10:00:00Z",
    recordedAt: "2026-10-03T10:00:01Z",
    startAt: "2026-10-04T12:00:00Z",
    status,
    probabilities:
      status === "PREDICTED" ? { home: "0.5", draw: "0.3", away: "0.2" } : null,
  }) as FootballCalibrationRequest["attempts"][number];
const outcome = (
  id: string,
  result: "home" | "draw" | "away" | "void" = "home",
) => ({
  id: `outcome-${id}`,
  eventId: id,
  revision: 1,
  supersedesId: null,
  knownAt: "2026-10-04T14:01:00Z",
  completedAt: "2026-10-04T14:00:00Z",
  sourceId: "FIXTURE",
  rightsReference: "TEST-ONLY",
  result,
});
test("empty calibration reports unknown metrics and empty fixed class buckets", () => {
  const r = footballCalibration(calibration());
  assert.equal(r.brierScore, null);
  assert.equal(r.logLoss, null);
  assert.equal(r.logLossStatus, "UNKNOWN");
  assert.equal(r.abstentionRate, null);
  assert.equal(r.buckets.length, 30);
  assert.ok(
    r.buckets.every((b) => b.count === 0 && b.observedFrequency === null),
  );
});
test("calibration scores all prospective predictions and keeps pending, void, abstention and failure denominators", () => {
  const v = calibration();
  v.attempts = [
    attempt("a"),
    attempt("b"),
    attempt("pending"),
    attempt("void"),
    attempt("abstain", "ABSTAINED"),
    attempt("failed", "FAILED"),
    attempt("missing", "NOT_CONFIGURED"),
    { ...attempt("different-horizon"), decisionWindow: "1h" },
  ];
  v.outcomes = [outcome("a"), outcome("b", "away"), outcome("void", "void")];
  const r = footballCalibration(v);
  assert.equal(r.attempts, 7);
  assert.equal(r.settled, 2);
  assert.equal(r.pending, 1);
  assert.equal(r.voids, 1);
  assert.equal(r.abstained, 2);
  assert.equal(r.failed, 1);
  assert.equal(r.brierScore, "0.68");
  assert.ok(
    Math.abs(r.logLoss! - (-Math.log(0.5) - Math.log(0.2)) / 2) < 1e-12,
  );
  assert.equal(
    r.buckets.reduce((n, b) => n + b.count, 0),
    6,
  );
  assert.equal(r.uncertainty, null);
  assert.equal(r.bettingPerformance, null);
});
test("zero-probability realised outcome has explicit infinite loss without clipping", () => {
  const v = calibration();
  v.attempts = [
    {
      ...attempt("a"),
      status: "PREDICTED",
      probabilities: { home: "1", draw: "0", away: "0" },
    },
  ];
  v.outcomes = [outcome("a", "away")];
  const r = footballCalibration(v);
  assert.equal(r.brierScore, "2");
  assert.equal(r.logLoss, null);
  assert.equal(r.logLossStatus, "INFINITE");
  assert.equal(r.infiniteLogLossCount, 1);
});
test("calibration binds corrections to report time and rejects duplicated decisions or broken chains", () => {
  const v = calibration();
  v.attempts = [attempt("a")];
  v.outcomes = [
    outcome("a"),
    {
      ...outcome("a", "away"),
      id: "correction",
      revision: 2,
      supersedesId: "outcome-a",
      knownAt: "2026-10-06T00:00:00Z",
    },
  ];
  assert.equal(footballCalibration(v).brierScore, "0.38");
  assert.equal(
    footballCalibration({ ...v, asOfTime: "2026-10-07T00:00:00Z" }).brierScore,
    "0.98",
  );
  assert.throws(() =>
    footballCalibration({
      ...v,
      attempts: [...v.attempts, { ...attempt("a"), id: "duplicate" }],
    }),
  );
  assert.throws(() => footballCalibration({ ...v, outcomes: [v.outcomes[1]] }));
  assert.throws(() =>
    footballCalibration({
      ...v,
      attempts: [{ ...attempt("a"), recordedAt: "2026-10-05T00:00:00Z" }],
    }),
  );
});

test("manual review preserves the correction chain and withdraws scoring until resolved", () => {
  const v = calibration();
  v.attempts = [attempt("a")];
  v.outcomes = [
    outcome("a"),
    {
      ...outcome("a"),
      id: "review",
      revision: 2,
      supersedesId: "outcome-a",
      knownAt: "2026-10-04T15:00:00Z",
      result: "manual_review",
    },
  ];
  const pending = footballCalibration(v);
  assert.equal(pending.settled, 0);
  assert.equal(pending.pending, 1);
  assert.equal(pending.manualReview, 1);
  assert.equal(pending.brierScore, null);
  v.outcomes.push({
    ...outcome("a", "away"),
    id: "resolved",
    revision: 3,
    supersedesId: "review",
    knownAt: "2026-10-04T16:00:00Z",
  });
  assert.equal(footballCalibration(v).brierScore, "0.98");
});
