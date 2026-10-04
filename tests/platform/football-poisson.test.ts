import test from "node:test";
import assert from "node:assert/strict";
import {
  fitPoisson,
  predictPoisson,
  recencyWeight,
  validatePoissonTraining,
} from "../../src/core/football-poisson";
import {
  openFootballTeamId,
  footballTeamAliases,
} from "../../src/core/football-team-mapping";
import { validateFootballProbabilities } from "../../src/core/football-model";

// Synthetic mathematical checks only. These are never provider data or retained predictions.
const training = () => ({
  schemaVersion: "epl-poisson-training-v1",
  competitionId: "soccer_epl",
  asOfTime: "2026-10-04T10:00:00Z",
  matches: Array.from({ length: 40 }, (_, i) => ({
    id: `synthetic-${i}`,
    home: i % 2 ? "A" : "B",
    away: i % 2 ? "B" : "A",
    date: `2026-09-${String(1 + (i % 20)).padStart(2, "0")}`,
    homeGoals: 1,
    awayGoals: 1,
    observedAt: "2026-10-01T00:00:00Z",
    sourceId: "synthetic-test-only",
  })),
});
const event = {
  home: "A",
  away: "B",
  competitionId: "soccer_epl",
  asOfTime: "2026-10-04T11:00:00Z",
  startAt: "2026-10-10T12:00:00Z",
};
test("Poisson symmetric one-goal fixture has known draw probability and deterministic fit", () => {
  const fit = fitPoisson(training()),
    result = predictPoisson(fit, event);
  assert.deepEqual(fit, fitPoisson(training()));
  assert.equal(result.status, "PREDICTED");
  if (result.status !== "PREDICTED") throw Error("Unexpected abstention");
  validateFootballProbabilities(result.probabilities);
  assert.ok(
    Math.abs(Number(result.probabilities.draw) - 0.308508322553671) < 1e-11,
  );
  assert.ok(
    Math.abs(
      Number(result.probabilities.home) - Number(result.probabilities.away),
    ) < 2e-12,
  );
});
test("strict sporting schema excludes price, prose and future knowledge", () => {
  assert.throws(() => fitPoisson({ ...training(), marketReference: 2 }));
  const future = training();
  future.matches[0].observedAt = "2026-10-05T00:00:00Z";
  assert.throws(() => validatePoissonTraining(future), /cutoff/);
  const sameDay = training();
  sameDay.matches[0].date = "2026-10-01";
  assert.throws(() => fitPoisson(sameDay), /cutoff/);
  assert.throws(() =>
    predictPoisson(fitPoisson(training()), { ...event, odds: 2 }),
  );
});
test("new teams abstain and earlier predictions cannot use later fitted state", () => {
  const fit = fitPoisson(training());
  assert.equal(
    predictPoisson(fit, { ...event, home: "NEW" }).status,
    "ABSTAIN",
  );
  assert.throws(
    () => predictPoisson(fit, { ...event, asOfTime: "2026-10-03T00:00:00Z" }),
    /cutoff/,
  );
  assert.throws(
    () => predictPoisson(fit, { ...event, startAt: event.asOfTime }),
    /cutoff/,
  );
});
test("known but sparsely observed promoted teams abstain despite fitted shrinkage", () => {
  const sample = training();
  sample.matches[0].home = "PROMOTED";
  sample.matches[1].away = "PROMOTED";
  const fit = fitPoisson(sample);
  assert.equal(fit.counts.PROMOTED, 2);
  assert.equal(
    predictPoisson(fit, { ...event, home: "PROMOTED" }).status,
    "ABSTAIN",
  );
  assert.equal(new Set(Object.values(footballTeamAliases)).size, 23);
});
test("fixed recency halves a one-year-old match and aliases never fuzzy match", () => {
  assert.equal(recencyWeight("2025-10-04", "2026-10-04T00:00:00Z", 365), 0.5);
  assert.equal(openFootballTeamId("Arsenal FC"), "football:england:arsenal");
  assert.throws(() => openFootballTeamId("Arsenal"), /REVIEW_REQUIRED/);
  assert.throws(() => openFootballTeamId("__proto__"), /REVIEW_REQUIRED/);
});
test("duplicate rows and numerical failure fail closed", () => {
  const duplicate = training();
  duplicate.matches[1].id = duplicate.matches[0].id;
  assert.throws(() => fitPoisson(duplicate), /Duplicate/);
  const zeros = training();
  zeros.matches.forEach((m) => {
    m.homeGoals = 0;
    m.awayGoals = 0;
  });
  assert.throws(() => fitPoisson(zeros), /INSUFFICIENT_SCORING_DATA/);
});
