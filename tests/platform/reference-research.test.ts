import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { hash, strategyV1 } from "../../src/core/pricing";
import { buildMarketReference } from "../../src/core/market-reference";
import {
  evaluateReference,
  referenceStrategyV2,
  validateReferenceStrategy,
} from "../../src/core/reference-pricing";
import {
  toReferenceSources,
  validateReferenceDataset,
  type HistoricalReferenceEvent,
  type HistoricalReferenceSnapshot,
} from "../../src/research/reference-dataset";
import {
  replayReference,
  referenceSensitivity,
} from "../../src/research/reference-replay";
import type { Manifest } from "../../src/research/replay";
import { defaultStudySplits } from "../../src/research/dataset";
import {
  assertResearchFreeze,
  validateResearchFreeze,
  researchWorkflow,
} from "../../src/research/strategy";
import {
  referenceConfig,
  referenceSources,
  referenceStart,
} from "./market-reference-fixtures";
import { now, rules } from "./fixtures";

// Authored arithmetic fixtures only. These assertions neither load real history
// nor approve source rights, commercial eligibility, a strategy or performance.
const config = validateReferenceStrategy({
  ...referenceStrategyV2,
  marketReference: referenceConfig,
});
const interval = {
  knownAt: "2026-10-01T00:00:00.000Z",
  effectiveFrom: "2026-10-01T00:00:00.000Z",
  effectiveTo: "2026-10-03T00:00:00.000Z",
};
function snapshot(at = now): HistoricalReferenceSnapshot {
  return {
    observedAt: at,
    eventStatus: {
      status: "scheduled",
      knownAt: at,
      evidence: "Fictional contemporaneous event status observation",
    },
    sources: referenceSources().map((s) => ({
      id: `${s.id}-${at}`,
      provider: s.provider,
      bookmaker: s.bookmaker,
      sourceType: "bookmaker",
      prices: structuredClone(s.prices),
      sourceAt: at,
      snapshotAt: at,
      archiveAvailableAt: at,
      archiveRetrievedAt: "2026-10-03T01:00:00.000Z",
      availabilityEvidence:
        "Fictional archived publication-time receipt, not today's download",
      suspended: false,
      rights: {
        reference: "Authored fictional data only",
        ...interval,
        retention: true,
        research: true,
      },
      ownership: {
        operator: s.operator,
        reference: "Fictional independent operators",
        ...interval,
      },
      classification: {
        priceClass: "STANDARD_VERIFIED",
        version: "fixture-v1",
        evidence: "Fictional standard public price",
        promotionFlags: [],
        ...interval,
      },
      mapping: {
        reference: "Fictional canonical mapping",
        eventId: rules.eventId,
        rulesHash: hash(rules),
        ...interval,
      },
      eligibility: {
        reference: "Fictional dated eligibility",
        region: "XX:FIXTURE",
        ...interval,
      },
      feed: {
        healthy: true,
        observedAt: at,
        evidence: "Fictional contemporaneous feed state",
      },
    })),
  };
}
function events(): HistoricalReferenceEvent[] {
  return [
    {
      rules: structuredClone(rules),
      startAt: referenceStart,
      schedule: {
        knownAt: "2026-10-01T00:00:00.000Z",
        reference: "Fictional archived schedule announcement",
      },
      snapshots: [snapshot(), snapshot("2026-10-02T06:05:00.000Z")],
      result: {
        source: "fictional-results",
        sourceEventId: rules.eventId,
        revision: "fixture-v1",
        authorised: true,
        eventId: rules.eventId,
        status: "final",
        rules: structuredClone(rules),
        scores: { "Fictional A": 110, "Fictional B": 100 },
        observedAt: "2026-10-02T10:00:00.000Z",
      },
    },
  ];
}
function manifest(data: HistoricalReferenceEvent[]): Manifest {
  return {
    datasetId: "FICTIONAL-REFERENCE-RESEARCH-ONLY",
    evidence: "demo",
    fixture: true,
    oddsRights: "Authored arithmetic fixtures",
    resultsRights: "Authored arithmetic fixtures",
    retentionAllowed: true,
    configHash: hash(config),
    dataHash: hash(data),
    codeCommit: "fixture-only",
    seed: 17,
    split: "development",
    contaminated: true,
    frozenAt: "2026-10-01T00:00:00.000Z",
    from: "2026-10-02T00:00:00.000Z",
    to: "2026-10-03T00:00:00.000Z",
    historicalUniverseEvidence: "Fictional independently authored cohorts",
    sourceResolutionSeconds: 60,
    referenceRegion: "XX:FIXTURE",
  };
}

test("reference replay uses the same configured core and retains publication benchmark accounting", () => {
  const data = events();
  const replay = replayReference(data, manifest(data), config);
  const direct = evaluateReference(
    {
      rules,
      startAt: referenceStart,
      decisionAt: now,
      sources: toReferenceSources(
        data[0].snapshots[0],
        rules,
        now,
        true,
        config,
        "XX:FIXTURE",
      ),
      evidenceMode: "research",
    },
    config,
  );
  assert.equal(replay.rows.immediate.length, 1);
  assert.equal(
    replay.rows.immediate[0].odds,
    direct.candidates[0].reference.decimalPrice,
  );
  assert.equal(replay.rows.immediate[0].odds, "2.02");
  assert.equal(replay.rows.immediate[0].stake, "1");
  assert.equal(replay.rows.immediate[0].result, "won");
  assert.equal(replay.strategy.configHash, hash(config));
  assert.equal(replay.rows.delayed.length, 1);
  assert.equal(replay.rows.delayed[0].publishedAt, "2026-10-02T06:05:00.000Z");
  assert.match(replay.label, /FICTIONAL/);
});

test("historical archive availability is explicit and later download never becomes prospective evidence", () => {
  const data = events();
  assert.equal(
    validateReferenceDataset(data, manifest(data), config).valid,
    true,
  );
  const sources = toReferenceSources(
    data[0].snapshots[0],
    rules,
    now,
    false,
    config,
    "XX:FIXTURE",
  );
  assert.equal(sources[0].receivedAt, now);
  assert.equal(sources[0].provenance, "historical");
  assert.equal(
    data[0].snapshots[0].sources[0].archiveRetrievedAt,
    "2026-10-03T01:00:00.000Z",
  );
  assert.equal(
    buildMarketReference(
      {
        rules,
        startAt: referenceStart,
        observedAt: now,
        selection: "Fictional A",
        sources,
      },
      referenceConfig,
    ).status,
    "UNAVAILABLE",
  );
  data[0].snapshots[0].sources[0].archiveAvailableAt =
    "2026-10-02T06:00:01.000Z";
  assert.equal(
    validateReferenceDataset(data, manifest(data), config).valid,
    false,
  );
});

test("future or expired rights, ownership, classification, mapping and eligibility cannot qualify", () => {
  for (const field of [
    "rights",
    "ownership",
    "classification",
    "mapping",
    "eligibility",
  ] as const) {
    for (const state of ["future", "expired", "future-known"]) {
      const data = events();
      for (const observation of data[0].snapshots)
        for (const source of observation.sources) {
          if (state === "future")
            source[field].effectiveFrom = "2026-10-02T06:30:00.000Z";
          else if (state === "expired") source[field].effectiveTo = now;
          else source[field].knownAt = "2026-10-02T06:30:00.000Z";
        }
      const replay = replayReference(data, manifest(data), config);
      assert.equal(replay.rows.immediate.length, 0, `${field} ${state}`);
    }
  }
});

test("missing historical metadata, future feed health and source-file/hash tampering fail closed", () => {
  const data = events();
  const incomplete = structuredClone(data);
  delete (
    incomplete[0].snapshots[0].sources[0] as Partial<
      (typeof incomplete)[0]["snapshots"][0]["sources"][0]
    >
  ).availabilityEvidence;
  assert.equal(
    validateReferenceDataset(incomplete, manifest(incomplete), config).valid,
    false,
  );
  const future = structuredClone(data);
  future[0].snapshots[0].sources[0].feed.observedAt =
    "2026-10-02T06:00:01.000Z";
  assert.equal(
    validateReferenceDataset(future, manifest(future), config).valid,
    false,
  );
  assert.equal(
    validateReferenceDataset(
      data,
      { ...manifest(data), dataHash: hash("different archive") },
      config,
    ).valid,
    false,
  );
  const real = {
    ...manifest(data),
    evidence: "retrospective_backtest" as const,
    fixture: false,
  };
  assert.equal(validateReferenceDataset(data, real, config).valid, false);
});

test("later and closing snapshots cannot decide or reprice an earlier selection", () => {
  const data = events();
  const before = replayReference(data, manifest(data), config);
  const closing = snapshot("2026-10-02T06:48:00.000Z");
  for (const source of closing.sources.filter((s) =>
    s.bookmaker.startsWith("pricing-"),
  ))
    source.prices = { "Fictional A": "2.20", "Fictional B": "1.60" };
  data[0].snapshots.push(closing);
  const after = replayReference(data, manifest(data), config);
  assert.deepEqual(
    after.rows.immediate.map((r) => ({
      odds: r.odds,
      publishedAt: r.publishedAt,
      result: r.result,
    })),
    before.rows.immediate.map((r) => ({
      odds: r.odds,
      publishedAt: r.publishedAt,
      result: r.result,
    })),
  );
  const onlyLater = events();
  onlyLater[0].snapshots.shift();
  assert.equal(
    replayReference(onlyLater, manifest(onlyLater), config).rows.immediate
      .length,
    0,
  );
});

test("a later-known rescheduled start cannot generate an earlier historical decision", () => {
  const data = events();
  data[0].schedule.knownAt = "2026-10-02T06:00:01.000Z";
  const report = replayReference(data, manifest(data), config);
  assert.equal(report.rows.immediate.length, 0);
  assert.equal(report.rows.delayed.length, 0);
});

test("historical scheduled-state evidence is required and cancellation cannot silently reopen", () => {
  const knownCancelled = events();
  knownCancelled[0].snapshots[0].eventStatus.status = "cancelled";
  assert.equal(
    replayReference(knownCancelled, manifest(knownCancelled), config).rows
      .immediate.length,
    0,
  );
  const restored = events();
  const pause = snapshot("2026-10-02T06:01:00.000Z");
  pause.eventStatus.status = "postponed";
  restored[0].snapshots.splice(1, 0, pause);
  const report = replayReference(restored, manifest(restored), config);
  assert.equal(report.rows.immediate.length, 1);
  assert.equal(report.rows.delayed.length, 0);
  const future = events();
  future[0].snapshots[0].eventStatus.knownAt = "2026-10-02T06:00:01.000Z";
  assert.equal(
    validateReferenceDataset(future, manifest(future), config).valid,
    false,
  );
});

test("promotional and shared-ownership sources cannot become historical availability benchmarks", () => {
  for (const mutation of ["promotion", "shared-owner"]) {
    const data = events();
    for (const observation of data[0].snapshots)
      for (const source of observation.sources.filter((s) =>
        s.bookmaker.startsWith("market-"),
      )) {
        if (mutation === "promotion")
          source.classification.promotionFlags = ["fictional-promo"];
        else
          source.ownership.operator = observation.sources[0].ownership.operator;
      }
    assert.equal(
      replayReference(data, manifest(data), config).rows.immediate.length,
      0,
      mutation,
    );
  }
});

test("availability follows the frozen research region while approved pricing sources remain separate", () => {
  const wrongAvailability = events();
  for (const observation of wrongAvailability[0].snapshots)
    for (const source of observation.sources.filter((s) =>
      s.bookmaker.startsWith("market-"),
    ))
      source.eligibility.region = "XX:OTHER";
  assert.equal(
    replayReference(wrongAvailability, manifest(wrongAvailability), config).rows
      .immediate.length,
    0,
  );
  const otherPricingRegion = events();
  for (const observation of otherPricingRegion[0].snapshots)
    for (const source of observation.sources.filter((s) =>
      s.bookmaker.startsWith("pricing-"),
    ))
      source.eligibility.region = "XX:OTHER";
  assert.equal(
    replayReference(otherPricingRegion, manifest(otherPricingRegion), config)
      .rows.immediate.length,
    1,
  );
});

test("sparse delayed/availability data stays unknown and a price recovery cannot reopen a selection", () => {
  const data = events();
  const lowered = snapshot("2026-10-02T06:01:00.000Z");
  for (const source of lowered.sources.filter((s) =>
    s.bookmaker.startsWith("market-"),
  ))
    source.prices = { "Fictional A": "1.80", "Fictional B": "2.00" };
  data[0].snapshots.splice(1, 0, lowered);
  const recovered = replayReference(data, manifest(data), config);
  assert.equal(recovered.rows.immediate.length, 1);
  assert.equal(recovered.rows.delayed.length, 0);
  const sparse = events();
  sparse[0].snapshots = [snapshot(), snapshot("2026-10-02T06:06:01.000Z")];
  const report = replayReference(sparse, manifest(sparse), config);
  const five = report.availability.targets.find((t) => t.minutes === 5)!;
  assert.equal(five.measured, 0);
  assert.equal(five.rate, null);
});

test("unlicensed results and pre-start cancellation stay pending until an explicit reviewed void", () => {
  const data = events();
  data[0].result!.authorised = false;
  assert.equal(
    replayReference(data, manifest(data), config).rows.immediate[0].result,
    "pending",
  );
  const cancelled = events();
  cancelled[0].result = {
    ...cancelled[0].result!,
    status: "cancelled",
    scores: {},
    observedAt: "2026-10-02T06:30:00.000Z",
  };
  assert.equal(
    validateReferenceDataset(cancelled, manifest(cancelled), config).valid,
    true,
  );
  assert.equal(
    replayReference(cancelled, manifest(cancelled), config).rows.immediate[0]
      .result,
    "pending",
  );
  cancelled[0].result = {
    ...cancelled[0].result!,
    status: "void",
    reason: "Fictional reviewed cancellation",
    settlementBasis: "Fictional market cancellation rule",
  };
  assert.equal(
    replayReference(cancelled, manifest(cancelled), config).rows.immediate[0]
      .result,
    "void",
  );
});

test("held-out reference replay permits fixed rules but refuses sensitivity and unapproved variants", () => {
  const data = events();
  const heldOut = { ...manifest(data), split: "held_out" as const };
  assert.equal(replayReference(data, heldOut, config).rows.immediate.length, 1);
  assert.throws(
    () => referenceSensitivity(data, heldOut, config),
    /held.out|development|validation/i,
  );
  assert.throws(
    () => replayReference(data, heldOut, config, 600),
    /held.out|delay|sensitivity/i,
  );
});

test("development stresses disclose every variant and preserve original archive lineage", () => {
  const data = events();
  const input = {
    ...manifest(data),
    datasetHashes: {
      canonical: hash(data),
      rawFiles: [
        {
          name: "fictional-authored-source.json",
          sha256: hash("fictional bytes"),
        },
      ],
    },
  };
  const stress = referenceSensitivity(data, input, config);
  assert.equal(stress.thresholds.length, 3);
  assert.equal(stress.delays.length, 3);
  assert.equal(stress.removedOperators.length, 5);
  for (const removal of stress.removedOperators) {
    assert.equal(removal.lineage.sourceDatasetHash, input.dataHash);
    assert.equal(removal.lineage.sourceManifestHash, hash(input));
    assert.deepEqual(removal.lineage.rawFiles, input.datasetHashes.rawFiles);
    assert.notEqual(removal.lineage.derivedDatasetHash, input.dataHash);
  }
  assert.equal(stress.strategy.configHash, hash(config));
});

test("freeze binds actual configuration, code, timestamp and exact study window", () => {
  const frozen = {
    config,
    configHash: hash(config),
    frozenAt: "2026-10-01T00:00:00.000Z",
    codeCommit: "a".repeat(40),
    studySplits: structuredClone(defaultStudySplits),
    status: "FROZEN_RULE_ARTIFACT_NOT_VALIDATION_APPROVAL" as const,
    referenceRegion: "XX:FIXTURE",
  };
  const input = {
    ...manifest(events()),
    configHash: frozen.configHash,
    freezeArtifactHash: hash(frozen),
    codeCommit: frozen.codeCommit,
    frozenAt: frozen.frozenAt,
    from: frozen.studySplits[0].from,
    to: frozen.studySplits[0].to,
  };
  assert.equal(hash(assertResearchFreeze(frozen, input, config)), hash(config));
  for (const tamper of [
    { ...input, from: "2022-02-01T00:00:00.000Z" },
    { ...input, to: "2024-02-01T00:00:00.000Z" },
    { ...input, frozenAt: "2026-09-01T00:00:00.000Z" },
    { ...input, codeCommit: "b".repeat(40) },
    { ...input, configHash: hash(strategyV1) },
    { ...input, referenceRegion: "XX:OTHER" },
  ])
    assert.throws(
      () => assertResearchFreeze(frozen, tamper, config),
      /provenance mismatch/,
    );
  assert.throws(
    () =>
      assertResearchFreeze(
        frozen,
        input,
        validateReferenceStrategy({ ...config, minEV: "0.05" }),
      ),
    /provenance mismatch/,
  );
  assert.throws(
    () =>
      validateResearchFreeze({
        ...frozen,
        config: { ...config, minEV: "0.05" },
      }),
    /configuration hash mismatch/,
  );
});

test("freeze rejects overlapping or relabelled holdout periods", () => {
  const frozen = {
    config,
    configHash: hash(config),
    frozenAt: "2026-10-01T00:00:00.000Z",
    codeCommit: "a".repeat(40),
    studySplits: structuredClone(defaultStudySplits),
    status: "FROZEN_RULE_ARTIFACT_NOT_VALIDATION_APPROVAL" as const,
    referenceRegion: "XX:FIXTURE",
  };
  frozen.studySplits[1].from = "2023-12-01T00:00:00.000Z";
  assert.throws(() => validateResearchFreeze(frozen), /nonoverlapping/);
  frozen.studySplits = structuredClone(defaultStudySplits);
  frozen.studySplits[1].split = "held_out";
  frozen.studySplits[2].split = "validation";
  assert.throws(() => validateResearchFreeze(frozen), /chronological/);
});

test("research dispatch keeps reference and legacy source schemas distinct", () => {
  const data = events(),
    input = manifest(data);
  const quality = researchWorkflow("validate-data", data, input, config);
  assert.equal(quality.engine, "market_reference_v1");
  assert.ok("validation" in quality && quality.validation?.valid);
  const legacyInput = { ...input, configHash: hash(strategyV1) };
  const rejected = researchWorkflow(
    "validate-data",
    data,
    legacyInput,
    strategyV1,
  );
  assert.equal(rejected.engine, "legacy_offered_book");
  assert.ok("validation" in rejected && rejected.validation?.valid === false);
  assert.throws(() =>
    researchWorkflow("replay", data, input, { ...config, method: "unknown" }),
  );
});

test("reference CLI validates, replays, stresses and reports only explicit private fixtures", async () => {
  const root = await realpath(process.cwd());
  const outputRoot = path.join(root, "research-output");
  await mkdir(outputRoot, { recursive: true });
  const directory = await mkdtemp(
    path.join(outputRoot, "reference-fixture-cli-"),
  );
  try {
    const data = events();
    const input = path.join(directory, "fixture.json");
    const metadata = path.join(directory, "manifest.json");
    const strategy = path.join(directory, "config.json");
    const audit = path.join(directory, "audit.json");
    const replay = path.join(directory, "replay.json");
    const stress = path.join(directory, "stress.json");
    const report = path.join(directory, "report.md");
    await Promise.all([
      writeFile(input, JSON.stringify(data)),
      writeFile(metadata, JSON.stringify(manifest(data))),
      writeFile(strategy, JSON.stringify(config)),
    ]);
    const run = (...args: string[]) =>
      execFileSync(
        process.execPath,
        ["--import", "tsx", "scripts/research.ts", ...args],
        {
          cwd: root,
          encoding: "utf8",
          env: { ...process.env, APP_ENV: "preview" },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
    run("validate-data", input, metadata, audit, strategy);
    const quality = JSON.parse(await readFile(audit, "utf8"));
    assert.equal(quality.engine, "market_reference_v1");
    assert.equal(quality.validation.valid, true);
    assert.equal(quality.rows, undefined);
    run("replay", input, metadata, replay, strategy);
    const replayed = JSON.parse(await readFile(replay, "utf8"));
    assert.equal(replayed.engine, "market_reference_v1");
    assert.equal(replayed.rows.immediate[0].odds, "2.02");
    assert.match(replayed.label, /FICTIONAL/);
    run("stress-test", input, metadata, stress, strategy);
    assert.equal(
      JSON.parse(await readFile(stress, "utf8")).thresholds.length,
      3,
    );
    run("report", replay, report);
    assert.match(
      await readFile(report, "utf8"),
      /FICTIONAL REFERENCE SOFTWARE FIXTURE/,
    );
    assert.throws(
      () => run("replay", input, metadata, replay, strategy),
      /EEXIST/,
    );
    replayed.rows.immediate[0].odds = "99";
    await writeFile(replay, JSON.stringify(replayed));
    assert.throws(
      () => run("report", replay, path.join(directory, "tampered.md")),
      /integrity mismatch/,
    );
  } finally {
    const resolved = await realpath(directory);
    assert.ok(resolved.startsWith(outputRoot + path.sep));
    await rm(resolved, { recursive: true });
  }
});
