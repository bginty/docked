import test from "node:test";
import assert from "node:assert/strict";
import {
  openFootballQualityReport,
  parseOpenFootballDataset,
} from "../../src/core/openfootball-dataset";

// Synthetic schema fixtures only. They are never imported into any sporting or results ledger.
const provenance = {
  observedAt: "2026-10-04T02:38:21Z",
  sourceId: "openfootball-epl",
  sourceVersion: "test-v1",
};
const row = {
  round: "Matchday 1",
  date: "2026-08-21",
  time: "20:00",
  team1: "Fixture Home",
  team2: "Fixture Away",
  score: { ft: [2, 1], ht: [1, 0] },
};
const fixture = () => ({
  name: "English Premier League 2026/27",
  matches: [structuredClone(row)],
});
test("OpenFootball adapter preserves observed-only clocks and reported result semantics", () => {
  const result = parseOpenFootballDataset(fixture(), provenance);
  assert.equal(result.sourcePublishedAt, null);
  assert.equal(result.sourceObservedAt, provenance.observedAt);
  assert.equal(result.matches[0].scheduledTime, "20:00");
  assert.equal(
    result.matches[0].resultSemantics,
    "REPORTED_UNVERIFIED_REGULATION",
  );
  assert.equal("startAt" in result.matches[0], false);
  assert.equal("status" in result.matches[0], false);
  const report = openFootballQualityReport(result);
  assert.equal(report.modelReady, false);
  assert.equal(report.settlementReady, false);
});
test("OpenFootball unavailable score/time stays null rather than zero or assumed UTC", () => {
  const { score: _score, time: _time, ...pending } = row;
  void _score;
  void _time;
  const result = parseOpenFootballDataset(
    { ...fixture(), matches: [pending] },
    provenance,
  );
  assert.equal(result.matches[0].homeGoals, null);
  assert.equal(result.matches[0].awayGoals, null);
  assert.equal(result.matches[0].scheduledTime, null);
  assert.equal(openFootballQualityReport(result).missingScores, 1);
});
test("OpenFootball malformed/changed schema and odds cannot silently enter research", () => {
  for (const bad of [
    { ...fixture(), odds: [2, 3, 4] },
    { ...fixture(), name: "Other competition 2026/27" },
    { ...fixture(), name: "English Premier League 2026/29" },
    { ...fixture(), matches: [{ ...row, score: { ft: [-1, 1] } }] },
    { ...fixture(), matches: [{ ...row, date: "2026-02-30" }] },
    { ...fixture(), matches: [{ ...row, marketReference: "2.10" }] },
    { ...fixture(), matches: [{ ...row, score: { ft: [1, 0], ht: [2, 0] } }] },
  ])
    assert.throws(() => parseOpenFootballDataset(bad, provenance));
});
test("OpenFootball repeated pairing degrades adapter and rescheduling keeps source identity", () => {
  assert.throws(
    () =>
      parseOpenFootballDataset(
        { ...fixture(), matches: [row, { ...row, date: "2026-08-28" }] },
        provenance,
      ),
    /duplicate/,
  );
  const original = parseOpenFootballDataset(fixture(), provenance);
  const revised = parseOpenFootballDataset(
    { ...fixture(), matches: [{ ...row, date: "2026-08-28" }] },
    provenance,
  );
  assert.equal(
    original.matches[0].sourceItemId,
    revised.matches[0].sourceItemId,
  );
  assert.notEqual(
    openFootballQualityReport(original).datasetHash,
    openFootballQualityReport(revised).datasetHash,
  );
});
test("OpenFootball future reported score is flagged without fabricated finality", () => {
  const result = parseOpenFootballDataset(
    { ...fixture(), matches: [{ ...row, date: "2027-01-10" }] },
    provenance,
  );
  const report = openFootballQualityReport(result);
  assert.equal(report.futureReportedScores, 1);
  assert.equal(report.status, "SOURCE_ADAPTER_DEGRADED");
  assert.equal(report.modelReady, false);
});
test("OpenFootball observed unlabelled tuple stays distinct from an ft field", () => {
  const result = parseOpenFootballDataset(
    { ...fixture(), matches: [{ ...row, score: [2, 1] }] },
    provenance,
  );
  assert.equal(result.matches[0].scoreField, "UNLABELLED_SCORE");
  assert.equal(openFootballQualityReport(result).unlabelledScores, 1);
  assert.equal(openFootballQualityReport(result).settlementReady, false);
  assert.throws(() =>
    parseOpenFootballDataset(
      { ...fixture(), matches: [{ ...row, score: [2] }] },
      provenance,
    ),
  );
});
