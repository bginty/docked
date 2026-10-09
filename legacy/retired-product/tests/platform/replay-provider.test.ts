import { test } from "node:test";
import assert from "node:assert/strict";
import {
  replay,
  type Manifest,
  type HistoricalEvent,
} from "../../src/research/replay";
import { hash, strategyV1, evaluate } from "../../src/core/pricing";
import { TheOddsApi, forecastCredits } from "../../src/providers/odds-api";
import { quotes, rules, now } from "./fixtures";
import { sensitivity } from "../../src/research/sensitivity";
const events = (): HistoricalEvent[] => [
  {
    rules,
    startAt: "2026-10-02T12:00:00.000Z",
    snapshots: [
      { observedAt: now, quotes: quotes() },
      {
        observedAt: "2026-10-02T06:05:00.000Z",
        quotes: quotes("2026-10-02T06:05:00.000Z"),
      },
    ],
    result: null,
  },
];
function manifest(e: HistoricalEvent[]): Manifest {
  return {
    datasetId: "fictional",
    evidence: "demo",
    oddsRights: "test fixtures authored locally",
    resultsRights: "test fixtures authored locally",
    retentionAllowed: true,
    configHash: hash(strategyV1),
    dataHash: hash(e),
    codeCommit: "fixture-only",
    seed: 42,
    split: "held_out",
    contaminated: true,
    frozenAt: "2026-01-01",
    from: "2026-10-01",
    to: "2026-10-03",
    historicalUniverseEvidence: "fictional operators",
  };
}
test("sensitivity rejects held-out tuning and reports all development variants", () => {
  const e = events();
  assert.throws(() => sensitivity(e, manifest(e)), /held-out/);
  const s = sensitivity(e, { ...manifest(e), split: "development" });
  assert.equal(s.thresholds.length, 3);
  assert.equal(s.delays.length, 3);
  assert.equal(s.missingReferences.length, 3);
  assert.equal(s.priceAndFeeStress[0].roi, null);
});
test("legacy stress honors the supplied configuration and preserves derived source lineage", () => {
  const data = events();
  const config = {
    ...strategyV1,
    version: "reference-v1.0.1-research",
    windowsSeconds: [3600],
  };
  const input: Manifest = {
    ...manifest(data),
    split: "development",
    configHash: hash(config),
    datasetHashes: {
      canonical: hash(data),
      rawFiles: [
        {
          name: "fictional-archive.json",
          sha256: hash("authored fixture bytes"),
        },
      ],
    },
  };
  const report = sensitivity(data, input, config);
  assert.equal(
    report.thresholds.every((value) => value.immediate.count === 0),
    true,
  );
  for (const removal of report.missingReferences) {
    assert.equal(removal.lineage.sourceDatasetHash, input.dataHash);
    assert.equal(removal.lineage.sourceManifestHash, hash(input));
    assert.deepEqual(removal.lineage.rawFiles, input.datasetHashes!.rawFiles);
    assert.notEqual(removal.lineage.derivedDatasetHash, input.dataHash);
  }
});
test("same decision library in replay and live; delayed entry remains separate", () => {
  const e = events(),
    r = replay(e, manifest(e));
  assert.equal(r.rows.immediate.length, 1);
  assert.equal(r.rows.delayed.length, 1);
  assert.equal(
    evaluate({
      rules,
      startAt: e[0].startAt,
      decisionAt: now,
      quotes: quotes(),
    }).candidates[0].selection,
    "Fictional A",
  );
  assert.equal(r.rows.delayed[0].publishedAt, "2026-10-02T06:05:00.000Z");
});
test("no future snapshot look-ahead and archive gaps remain gaps", () => {
  const e = events();
  e[0].snapshots = e[0].snapshots.filter((x) => x.observedAt !== now);
  const r = replay(e, manifest(e));
  assert.equal(r.rows.immediate.length, 0);
  assert.ok(r.coverage.missingWindows > 0);
});
test("hash mismatches, missing rights and production evidence classes rejected", () => {
  const e = events();
  assert.throws(() => replay(e, { ...manifest(e), dataHash: "tampered" }));
  assert.throws(() => replay(e, { ...manifest(e), oddsRights: "" }));
  assert.throws(() =>
    replay(e, { ...manifest(e), evidence: "live_published" }),
  );
});
test("contaminated real-data reports labelled", () => {
  const e = events();
  assert.match(
    replay(e, {
      ...manifest(e),
      evidence: "retrospective_backtest",
      fixture: false,
      provider: {
        odds: "fictional-contract-test-only",
        results: "fictional-contract-test-only",
      },
      reviewedBy: "fixture-test",
      sourceResolutionSeconds: 300,
      freezeArtifactHash: hash("fictional-freeze"),
      datasetHashes: {
        canonical: hash(e),
        rawFiles: [{ name: "fictional-fixture-only", sha256: hash(e) }],
      },
    }).label,
    /CONTAMINATED/,
  );
});
test("quota forecast is shared rather than per-user", () =>
  assert.equal(
    forecastCredits({
      sports: 3,
      regions: 1,
      markets: 1,
      intervalMinutes: 5,
      hoursPerDay: 16,
      days: 30,
    }),
    17280,
  ));
test("provider will not call network without rights/budget", async () => {
  let calls = 0;
  const p = new TheOddsApi(
    {
      key: "fixture",
      rights: "test",
      remaining: 0,
      regions: "au",
      mapping: { bookmakers: {}, events: {} },
      allowPolling: true,
    },
    async () => {
      calls++;
      return new Response("{}");
    },
  );
  await assert.rejects(() => p.fetch("basketball_nba"), /Quota/);
  assert.equal(calls, 0);
});
