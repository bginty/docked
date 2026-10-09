import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMatchResearchFile,
  researchContentDraft,
  researchFactHash,
  researchFactAncestry,
  researchRightsStates,
  resolveResearchFacts,
  sourceUseDecision,
  validateResearchFact,
  validateResearchSource,
  type ResearchFact,
  type ResearchSource,
} from "../../src/core/research-engine";
import {
  assessResearchRecalculation,
  explainResearchFeatures,
  validateResearchFeature,
  researchFeatureDefinitionHash,
  researchFeatureHash,
  type ResearchFeature,
} from "../../src/core/research-features";
import {
  calculateResearchTrend,
  type ResearchTrendObservation,
  type ResearchTrendPolicy,
} from "../../src/core/research-trends";

// Authored fictional contract evidence only. These fixtures never enter a provider, model or database.
const asOfTime = "2026-10-04T12:00:00Z";
const source = (patch: Partial<ResearchSource> = {}): ResearchSource => ({
  schemaVersion: "research-source-v1",
  sourceId: "authored-test-source",
  version: "v1",
  name: "FICTIONAL contract source",
  domain: "example.com",
  category: "STRUCTURED_DATA",
  accessMethod: "DATASET",
  endpoint: "https://example.com/fictional.json",
  rightsState: "APPROVED_AUTOMATED",
  commercialUse: "ALLOWED",
  publicDisplay: "ALLOWED",
  storage: {
    permission: "ALLOWED",
    maxDays: 30,
    immutableEvidenceAllowed: true,
  },
  derivedUse: "ALLOWED",
  modelUse: "ALLOWED",
  automation: "ALLOWED",
  robots: "NOT_APPLICABLE",
  etiquette: { minimumIntervalSeconds: 86400, maximumRequestsPerDay: 1 },
  attribution: {
    label: "Fictional test attribution",
    url: "https://example.com/fictional",
  },
  dataTypes: [
    "PLAYER_INJURY",
    "PLAYER_RETURN",
    "CONFIRMED_LINEUP",
    "TEAM_STAT_UPDATE",
  ],
  reliability: "TIER_2_AUTHORISED_STRUCTURED",
  jurisdictions: ["XX:FIXTURE"],
  reviewedAt: "2026-10-01T00:00:00Z",
  reviewDueAt: "2026-11-01T00:00:00Z",
  effectiveFrom: "2026-10-01T00:00:00Z",
  effectiveTo: "2026-11-01T00:00:00Z",
  evidenceUrls: ["https://example.com/fictional-rights"],
  notes: "AUTHORED TEST ONLY",
  ...patch,
});
const fact = (patch: Partial<ResearchFact> = {}): ResearchFact => ({
  schemaVersion: "research-fact-v1",
  id: "f1",
  type: "PLAYER_INJURY",
  eventId: "FIXTURE-EVENT",
  teamId: "FIXTURE-HOME",
  playerId: "FIXTURE-PLAYER",
  value: { status: "OUT", reason: "INJURY" },
  sourceId: "authored-test-source",
  sourceVersion: "v1",
  sourceItemId: "item1",
  sourceRevision: "1",
  sourcePublishedAt: "2026-10-04T10:00:00Z",
  sourceObservedAt: "2026-10-04T10:01:00Z",
  ingestedAt: "2026-10-04T10:02:00Z",
  effectiveAt: "2026-10-04T10:00:00Z",
  expiresAt: "2026-10-05T00:00:00Z",
  confidence: "CONFIRMED",
  reliability: "TIER_2_AUTHORISED_STRUCTURED",
  evidenceUrl: "https://example.com/fact",
  evidenceHash: "a".repeat(64),
  supersedesId: null,
  recordState: "ASSERTED",
  correctionReason: null,
  ...patch,
});
const request = {
  purpose: "AUTOMATED_FETCH" as const,
  asOfTime,
  jurisdiction: "XX:FIXTURE",
};

test("all source rights states, explicit display permission, expiry and technical restrictions fail closed", () => {
  for (const rightsState of researchRightsStates)
    assert.equal(
      sourceUseDecision(source({ rightsState }), request).allowed,
      rightsState === "APPROVED_AUTOMATED",
    );
  assert.equal(
    sourceUseDecision(source({ rightsState: "APPROVED_MANUAL_ONLY" }), {
      ...request,
      purpose: "DISPLAY",
    }).allowed,
    true,
  );
  for (const patch of [
    { reviewDueAt: asOfTime },
    { reviewedAt: "2026-10-05T00:00:00Z" },
    { automation: "UNKNOWN" as const },
    { robots: "DISALLOWED" as const },
    { jurisdictions: ["OTHER"] },
    { commercialUse: "DENIED" as const },
    {
      storage: {
        permission: "ALLOWED" as const,
        maxDays: 30,
        immutableEvidenceAllowed: false,
      },
    },
  ])
    assert.equal(sourceUseDecision(source(patch), request).allowed, false);
  assert.equal(
    sourceUseDecision(source({ publicDisplay: "UNKNOWN" }), {
      ...request,
      purpose: "DISPLAY",
    }).allowed,
    false,
  );
  assert.equal(
    sourceUseDecision(source({ modelUse: "UNKNOWN" }), {
      ...request,
      purpose: "MODEL",
    }).allowed,
    false,
  );
  assert.equal(
    sourceUseDecision(source(), {
      ...request,
      retainUntil: "2026-12-01T00:00:00Z",
    }).allowed,
    false,
  );
  assert.equal(
    sourceUseDecision(source({ accessMethod: "PAGE" }), request).allowed,
    false,
  );
});

test("source URLs reject credentials, private hosts and query tokens; factual schema rejects prose/probabilities", () => {
  for (const endpoint of [
    "https://example.com/data?apiKey=fictional",
    "https://u:p@example.com/data",
    "https://127.0.0.1/data",
    "http://example.com/data",
    "https://other.example/data",
  ])
    assert.throws(() => validateResearchSource(source({ endpoint })));
  assert.throws(() =>
    validateResearchSource(
      source({
        attribution: {
          label: "x",
          url: "https://example.com/?token=fictional",
        },
      }),
    ),
  );
  assert.throws(() =>
    validateResearchFact(
      fact({
        value: { status: "OUT", reason: "INJURY", homeProbability: "0.6" },
      }),
    ),
  );
  assert.throws(() =>
    validateResearchFact({ ...fact(), prose: "Model should improve" }),
  );
  assert.throws(() => validateResearchFact(fact({ playerId: null })));
  assert.throws(() =>
    validateResearchFact(
      fact({
        type: "CONFIRMED_LINEUP",
        value: { playerIds: ["one"], formation: null },
      }),
    ),
  );
});

const factRequest = { asOfTime, jurisdiction: "XX:FIXTURE" };
test("unknown publication time remains unknown; knownAt boundaries prevent backdated and future facts", () => {
  const unknown = fact({ sourcePublishedAt: null });
  assert.equal(validateResearchFact(unknown).sourcePublishedAt, null);
  assert.equal(
    resolveResearchFacts([unknown], [source()], factRequest).facts.length,
    1,
  );
  const future = fact({
    ingestedAt: "2026-10-04T13:00:00Z",
    sourceObservedAt: "2026-10-04T13:00:00Z",
  });
  assert.equal(
    resolveResearchFacts([future], [source()], factRequest).rejected[0].reason,
    "FUTURE_EVIDENCE",
  );
  const laterReview = source({ reviewedAt: "2026-10-04T11:00:00Z" });
  assert.equal(
    resolveResearchFacts([fact()], [laterReview], factRequest).facts.length,
    0,
  );
  assert.throws(() =>
    validateResearchFact(fact({ sourceObservedAt: "2026-10-04T09:00:00Z" })),
  );
});

test("immutable corrections resolve as-of and withdrawal does not resurrect prior fact", () => {
  const original = fact(),
    corrected = fact({
      id: "f2",
      sourceRevision: "2",
      supersedesId: "f1",
      correctionReason: "FICTIONAL correction",
      ingestedAt: "2026-10-04T11:00:00Z",
      value: { status: "AVAILABLE", reason: "RETURN" },
    });
  const hash = researchFactHash(original);
  assert.equal(
    resolveResearchFacts([original, corrected], [source()], {
      ...factRequest,
      asOfTime: "2026-10-04T10:30:00Z",
    }).facts[0].fact.id,
    "f1",
  );
  assert.equal(
    resolveResearchFacts([original, corrected], [source()], factRequest)
      .facts[0].fact.id,
    "f2",
  );
  const withdrawn = fact({
    ...corrected,
    id: "f3",
    sourceRevision: "3",
    supersedesId: "f2",
    recordState: "WITHDRAWN",
    ingestedAt: "2026-10-04T11:30:00Z",
  });
  assert.equal(
    resolveResearchFacts(
      [original, corrected, withdrawn],
      [source()],
      factRequest,
    ).facts.length,
    0,
  );
  assert.equal(researchFactHash(original), hash);
  const branch = { ...corrected, id: "branch" };
  assert.equal(
    resolveResearchFacts([original, corrected, branch], [source()], factRequest)
      .facts.length,
    0,
  );
});

test("corroboration deduplicates one factual grain; disagreement stays explicit including official preference", () => {
  const official = source({
    sourceId: "official",
    reliability: "TIER_1_CONFIRMED_OFFICIAL",
  });
  const same = fact({
    id: "official-fact",
    sourceId: "official",
    reliability: "TIER_1_CONFIRMED_OFFICIAL",
  });
  let result = resolveResearchFacts(
    [fact(), same],
    [source(), official],
    factRequest,
  );
  assert.equal(result.facts.length, 1);
  assert.equal(result.facts[0].corroboratingIds.length, 2);
  result = resolveResearchFacts(
    [fact(), { ...same, value: { status: "AVAILABLE", reason: "RETURN" } }],
    [source(), official],
    factRequest,
  );
  assert.equal(result.facts[0].status, "CONFLICTING_EVIDENCE");
  assert.equal(result.facts[0].preferredFactId, "official-fact");
  const revoked = source({
    version: "v2",
    rightsState: "PROHIBITED",
    reviewedAt: "2026-10-04T11:00:00Z",
  });
  assert.equal(
    resolveResearchFacts([fact()], [source(), revoked], factRequest).facts
      .length,
    0,
  );
});

const event = {
  eventId: "FIXTURE-EVENT",
  competitionId: "soccer_epl",
  homeTeam: "FICTIONAL HOME",
  awayTeam: "FICTIONAL AWAY",
  homeTeamId: "FIXTURE-HOME",
  awayTeamId: "FIXTURE-AWAY",
  startAt: "2026-10-04T18:00:00Z",
  venue: null,
  status: "scheduled" as const,
};
const policy = {
  version: "fixture-policy-v1",
  jurisdiction: "XX:FIXTURE",
  requiredFactTypes: ["PLAYER_INJURY" as const],
  maxFactAgeSeconds: 10800,
};
test("match files have explicit missing sections, deterministic hashes, no postmatch/foreign facts and safe draft projection", () => {
  const empty = buildMatchResearchFile({
    event,
    asOfTime,
    sources: [],
    facts: [],
    policy,
  });
  assert.equal(empty.status, "NOT_CONFIGURED");
  assert.equal(empty.modelStatus, "NOT_CONFIGURED");
  assert.equal(researchContentDraft(empty, "DOCKED_RESEARCH"), null);
  assert.ok(
    empty.sections.find(
      (s) => s.key === "HEAD_TO_HEAD" && s.status === "DATA_NOT_AVAILABLE",
    ),
  );
  const file = buildMatchResearchFile({
    event,
    asOfTime,
    sources: [source()],
    facts: [fact()],
    policy,
  });
  assert.equal(file.status, "READY");
  assert.equal(
    file.snapshotHash,
    buildMatchResearchFile({
      event,
      asOfTime,
      sources: [source()],
      facts: [fact()],
      policy,
    }).snapshotHash,
  );
  const draft = researchContentDraft(file, "DOCKED_RESEARCH")!;
  assert.equal(draft.status, "DRAFT_REQUIRES_REVIEW");
  assert.equal(draft.modelLabel, "DISPLAY_CONTEXT_ONLY");
  assert.equal("evidenceHash" in draft.facts[0], false);
  assert.throws(() =>
    buildMatchResearchFile({
      event,
      asOfTime: event.startAt,
      sources: [],
      facts: [],
      policy,
    }),
  );
  assert.throws(() =>
    buildMatchResearchFile({
      event: { ...event, competitionId: "OTHER" },
      asOfTime,
      sources: [],
      facts: [],
      policy,
    }),
  );
  assert.throws(() =>
    buildMatchResearchFile({
      event,
      asOfTime,
      sources: [source()],
      facts: [fact({ teamId: "OTHER" })],
      policy,
    }),
  );
});

const trendPolicy: ResearchTrendPolicy = {
  schemaVersion: "research-trend-policy-v1",
  version: "authored-test-v1",
  overlapPolicy: "DISJOINT",
  entityId: "TEAM",
  entityType: "TEAM",
  metric: "goals",
  unit: "count",
  competitionId: "soccer_epl",
  season: "fictional-season",
  venue: "ALL",
  opponentAdjustment: "UNADJUSTED",
  adjustmentVersion: null,
  recent: {
    from: "2026-09-01T00:00:00Z",
    to: "2026-10-01T00:00:00Z",
    lastN: null,
    halfLifeDays: null,
  },
  baseline: {
    from: "2026-08-01T00:00:00Z",
    to: "2026-09-01T00:00:00Z",
    lastN: null,
    halfLifeDays: null,
  },
  minimumMatches: 2,
  minimumMinutes: null,
  threshold: { kind: "ABSOLUTE", value: "0.5" },
};
function measurements(): ResearchTrendObservation[] {
  return ["2026-08-10", "2026-08-20", "2026-09-10", "2026-09-20"].map(
    (day, i) => ({
      id: `m${i}`,
      factId: `f${i}`,
      eventId: `e${i}`,
      entityId: "TEAM",
      entityType: "TEAM",
      metric: "goals",
      value: i < 2 ? "1" : "2",
      unit: "count",
      competitionId: "soccer_epl",
      season: "fictional-season",
      venue: "HOME",
      opponentAdjustment: "UNADJUSTED",
      adjustmentVersion: null,
      occurredAt: `${day}T00:00:00Z`,
      knownAt: `${day}T03:00:00Z`,
      ingestedAt: `${day}T04:00:00Z`,
      minutes: 90,
      sourceId: "fixture",
      sourceVersion: "v1",
    }),
  );
}
test("trends require compatible context and minimum sample; duplicates cannot inflate evidence", () => {
  const result = calculateResearchTrend(measurements(), trendPolicy, asOfTime);
  assert.equal(result.label, "ABOVE_BASELINE");
  assert.equal(result.absoluteDifference, "1");
  assert.equal(result.percentageDifference, "100");
  assert.equal(result.interpretation, "DESCRIPTIVE_ONLY");
  const missing = measurements();
  missing[3].competitionId = "OTHER";
  assert.equal(
    calculateResearchTrend(missing, trendPolicy, asOfTime).status,
    "INSUFFICIENT_SAMPLE",
  );
  assert.equal(
    calculateResearchTrend([], trendPolicy, asOfTime).recentValue,
    null,
  );
  assert.throws(() =>
    calculateResearchTrend(
      [...measurements(), { ...measurements()[0], id: "duplicate" }],
      trendPolicy,
      asOfTime,
    ),
  );
  assert.throws(() =>
    calculateResearchTrend(
      measurements(),
      { ...trendPolicy, minimumMatches: 0 },
      asOfTime,
    ),
  );
});
test("zero baseline gives no relative percent or fabricated comparison label; future knowledge is excluded", () => {
  const rows = measurements();
  rows[0].value = "0";
  rows[1].value = "0";
  const result = calculateResearchTrend(
    rows,
    { ...trendPolicy, threshold: { kind: "RELATIVE_PERCENT", value: "10" } },
    asOfTime,
  );
  assert.equal(result.status, "ZERO_BASELINE");
  assert.equal(result.percentageDifference, null);
  assert.equal(result.label, null);
  assert.equal(result.absoluteDifference, "2");
  rows[3].ingestedAt = "2026-10-05T00:00:00Z";
  assert.equal(
    calculateResearchTrend(rows, trendPolicy, asOfTime).status,
    "INSUFFICIENT_SAMPLE",
  );
  assert.throws(() =>
    calculateResearchTrend(
      rows,
      { ...trendPolicy, baseline: trendPolicy.recent },
      asOfTime,
    ),
  );
});

const feature = (patch: Partial<ResearchFeature> = {}): ResearchFeature => ({
  schemaVersion: "research-feature-v1",
  featureId: "fictional-availability",
  version: "v1",
  state: "MODEL_ACTIVE",
  inputKind: "STRUCTURED_SPORTING_FACT",
  factTypes: ["PLAYER_INJURY"],
  transformId: "TEST_ONLY_NOT_IMPLEMENTED",
  transformVersion: "v1",
  modelVersion: "TEST_MODEL_NOT_INSTALLED",
  modelConfigHash: "b".repeat(64),
  causalRationale:
    "FICTIONAL contract rationale; no coefficient or effect is asserted.",
  limitations: "No implemented model or measured contribution",
  acceptedConfidence: ["CONFIRMED"],
  maxAgeSeconds: 10800,
  trainingCutoff: "2026-09-01T00:00:00Z",
  reviewedAt: "2026-10-01T00:00:00Z",
  effectiveFrom: "2026-10-01T00:00:00Z",
  effectiveTo: "2026-11-01T00:00:00Z",
  reviewReference: "FICTIONAL REVIEW ONLY",
  ...patch,
});
function recalculation() {
  return {
    eventId: event.eventId,
    startAt: event.startAt,
    asOfTime,
    jurisdiction: "XX:FIXTURE",
    modelVersion: feature().modelVersion!,
    modelConfigHash: feature().modelConfigHash!,
    modelAvailable: false,
    priorPredictionId: null,
    changedFactIds: ["f1"],
    facts: [fact()],
    sources: [source()],
    features: [feature()],
  };
}
test("display-only research cannot alter model, active changes need executor and create no probabilities", () => {
  const input = recalculation();
  assert.equal(
    assessResearchRecalculation({
      ...input,
      features: [feature({ state: "DISPLAY_ONLY" })],
    }).status,
    "NO_ACTIVE_FEATURE_CHANGE",
  );
  const unavailable = assessResearchRecalculation(input);
  assert.equal(unavailable.status, "MODEL_NOT_CONFIGURED");
  assert.equal(unavailable.probabilityOverride, false);
  assert.equal("probabilities" in unavailable, false);
  assert.equal(
    assessResearchRecalculation({ ...input, modelAvailable: true }).status,
    "ELIGIBLE_FOR_RECALCULATION",
  );
  assert.equal(
    explainResearchFeatures([feature()])[0].numericalContribution,
    null,
  );
  assert.throws(() =>
    validateResearchFeature({
      ...feature(),
      inputKind: "MARKET_ODDS",
      probability: "0.7",
    }),
  );
  assert.throws(() =>
    validateResearchFeature(feature({ modelConfigHash: null })),
  );
});
test("active inputs fail closed for stale, future, rumour, revoked rights and source conflict without mutating prior prediction", () => {
  const input = {
    ...recalculation(),
    priorPredictionId: "immutable-prediction",
  };
  for (const change of [
    { facts: [fact({ expiresAt: "2026-10-04T11:00:00Z" })] },
    { facts: [fact({ confidence: "RUMOUR" })] },
    { sources: [source({ modelUse: "DENIED" as const })] },
    { facts: [fact({ effectiveAt: "2026-10-04T13:00:00Z" })] },
    { asOfTime: event.startAt },
  ]) {
    const result = assessResearchRecalculation({ ...input, ...change });
    assert.equal(result.status, "BLOCKED_DATA");
    assert.equal(result.priorPredictionId, "immutable-prediction");
  }
  assert.equal(input.facts[0].value.status, "OUT");
  const contradicting = fact({
    id: "conflict",
    sourceId: "other",
    value: { status: "AVAILABLE", reason: "RETURN" },
  });
  assert.equal(
    assessResearchRecalculation({
      ...input,
      facts: [fact(), contradicting],
      sources: [source(), source({ sourceId: "other" })],
    }).status,
    "BLOCKED_DATA",
  );
});

test("model-use permission does not require public disclosure, but cannot produce a public match file", () => {
  const privateSource = source({ publicDisplay: "DENIED" });
  assert.equal(
    resolveResearchFacts([fact()], [privateSource], factRequest).facts.length,
    0,
  );
  assert.equal(
    resolveResearchFacts([fact()], [privateSource], {
      ...factRequest,
      purpose: "MODEL",
    }).facts.length,
    1,
  );
  assert.equal(
    assessResearchRecalculation({
      ...recalculation(),
      sources: [privateSource],
    }).status,
    "MODEL_NOT_CONFIGURED",
  );
});

test("broken correction ancestry and source version rotation cannot restore eligibility", () => {
  const broken = fact({
    id: "broken",
    supersedesId: "missing",
    correctionReason: "fixture correction",
    sourceRevision: "2",
    ingestedAt: "2026-10-04T11:00:00Z",
  });
  const descendant = fact({
    id: "descendant",
    supersedesId: "broken",
    correctionReason: "fixture followup",
    sourceRevision: "3",
    ingestedAt: "2026-10-04T11:30:00Z",
  });
  assert.equal(
    resolveResearchFacts([broken, descendant], [source()], factRequest).facts
      .length,
    0,
  );
  assert.equal(
    resolveResearchFacts(
      [fact()],
      [source(), source({ version: "v2", reviewedAt: "2026-10-04T11:00:00Z" })],
      factRequest,
    ).facts.length,
    0,
  );
});

test("future facts cannot alter the earlier snapshot hash, and retention expiry stays unavailable", () => {
  const input = {
    event,
    asOfTime,
    sources: [source()],
    facts: [fact()],
    policy,
  };
  const future = fact({
    id: "future",
    sourceObservedAt: "2026-10-04T13:00:00Z",
    ingestedAt: "2026-10-04T13:00:00Z",
  });
  assert.equal(
    buildMatchResearchFile(input).snapshotHash,
    buildMatchResearchFile({ ...input, facts: [fact(), future] }).snapshotHash,
  );
  const overlong = fact({ expiresAt: "2026-12-01T00:00:00Z" });
  assert.equal(
    resolveResearchFacts([overlong], [source()], factRequest).rejected[0]
      .reason,
    "RETENTION_LIMIT_EXCEEDED",
  );
});

test("per-90 comparisons weight minutes and abstain when exposure is missing", () => {
  const rows = measurements().map((o, i) => ({
    ...o,
    metric: "goals_per_90" as const,
    unit: "per_90" as const,
    minutes: i === 3 ? 10 : 90,
    value: i === 3 ? "10" : "0",
  }));
  const p = {
    ...trendPolicy,
    metric: "goals_per_90" as const,
    unit: "per_90" as const,
  };
  assert.equal(calculateResearchTrend(rows, p, asOfTime).recentValue, "1");
  rows[3] = { ...rows[3], minutes: null } as unknown as (typeof rows)[number];
  assert.equal(
    calculateResearchTrend(rows, p, asOfTime).status,
    "INSUFFICIENT_SAMPLE",
  );
});

test("a target result cannot masquerade as pre-match research and negative sporting counts are rejected", () => {
  const result = fact({
    type: "MATCH_RESULT",
    teamId: null,
    playerId: null,
    value: {
      homeGoals: 1,
      awayGoals: 0,
      period: "REGULATION",
      status: "FINAL",
    },
  });
  assert.throws(() =>
    buildMatchResearchFile({
      event,
      asOfTime,
      sources: [source({ dataTypes: ["MATCH_RESULT"] })],
      facts: [result],
      policy,
    }),
  );
  assert.throws(() =>
    validateResearchFact(
      fact({
        type: "TEAM_STAT_UPDATE",
        playerId: null,
        value: {
          metric: "goals",
          value: "-1",
          unit: "count",
          competitionId: "soccer_epl",
          season: "test",
          venue: "ALL",
          periodStart: "2026-09-01T00:00:00Z",
          periodEnd: "2026-10-01T00:00:00Z",
          sampleMatches: 1,
          sampleMinutes: null,
          opponentAdjustment: "UNADJUSTED",
          adjustmentVersion: null,
        },
      }),
    ),
  );
});

test("recent versus season-to-date uses explicit contained overlap and retains unique evidence IDs", () => {
  const policy: ResearchTrendPolicy = {
    ...trendPolicy,
    overlapPolicy: "RECENT_INCLUDED_IN_BASELINE",
    baseline: { ...trendPolicy.baseline, to: trendPolicy.recent.to },
  };
  const result = calculateResearchTrend(measurements(), policy, asOfTime);
  assert.equal(result.overlapPolicy, "RECENT_INCLUDED_IN_BASELINE");
  assert.equal(result.recentMatches, 2);
  assert.equal(result.baselineMatches, 4);
  assert.equal(result.baselineValue, "1.5");
  assert.equal(result.absoluteDifference, "0.5");
  assert.equal(result.factIds.length, 4);
  assert.throws(() =>
    calculateResearchTrend(
      measurements(),
      { ...policy, baseline: { ...policy.baseline, lastN: 1 } },
      asOfTime,
    ),
  );
  assert.throws(() =>
    calculateResearchTrend(
      measurements(),
      {
        ...policy,
        baseline: { ...policy.baseline, from: "2026-09-15T00:00:00Z" },
      },
      asOfTime,
    ),
  );
  assert.throws(() =>
    calculateResearchTrend(
      measurements(),
      { ...policy, overlapPolicy: "DISJOINT" },
      asOfTime,
    ),
  );
});

test("impossible percentages and empty weather do not create complete research", () => {
  assert.throws(() =>
    validateResearchFact(
      fact({
        type: "WEATHER_UPDATE",
        teamId: null,
        playerId: null,
        value: {
          temperatureCelsius: null,
          windKph: null,
          precipitationMm: null,
          forecastFor: event.startAt,
        },
      }),
    ),
  );
  const cold = validateResearchFact(
    fact({
      type: "WEATHER_UPDATE",
      teamId: null,
      playerId: null,
      value: {
        temperatureCelsius: "-3.5",
        windKph: null,
        precipitationMm: null,
        forecastFor: event.startAt,
      },
    }),
  );
  assert.equal(cold.value.temperatureCelsius, "-3.5");
  assert.throws(() =>
    validateResearchFact(
      fact({
        type: "TEAM_STAT_UPDATE",
        playerId: null,
        value: {
          metric: "possession_pct",
          value: "101",
          unit: "percent",
          competitionId: "soccer_epl",
          season: "test",
          venue: "ALL",
          periodStart: "2026-09-01T00:00:00Z",
          periodEnd: "2026-10-01T00:00:00Z",
          sampleMatches: 1,
          sampleMinutes: null,
          opponentAdjustment: "UNADJUSTED",
          adjustmentVersion: null,
        },
      }),
    ),
  );
});

test("model can freeze feature definition before activation without a circular hash dependency", () => {
  const eligible = feature({
    state: "MODEL_ELIGIBLE",
    modelConfigHash: "a".repeat(64),
  });
  const active = feature({
    state: "MODEL_ACTIVE",
    version: "v2",
    modelConfigHash: "b".repeat(64),
    reviewedAt: "2026-10-02T00:00:00Z",
  });
  assert.equal(
    researchFeatureDefinitionHash(eligible),
    researchFeatureDefinitionHash(active),
  );
  assert.notEqual(researchFeatureHash(eligible), researchFeatureHash(active));
  assert.notEqual(
    researchFeatureDefinitionHash(active),
    researchFeatureDefinitionHash({
      ...active,
      maxAgeSeconds: active.maxAgeSeconds + 1,
    }),
  );
});

test("lower-confidence corroboration cannot masquerade as a causal model input change", () => {
  const rumour = fact({
    id: "rumour",
    sourceId: "rumour-source",
    confidence: "RUMOUR",
    reliability: "TIER_4_UNCONFIRMED",
    ingestedAt: "2026-10-04T11:00:00Z",
  });
  // Tier4 is filtered from model evidence altogether: it cannot prompt a fitted executor.
  const result = assessResearchRecalculation({
    ...recalculation(),
    changedFactIds: [rumour.id],
    facts: [fact(), rumour],
    sources: [
      source(),
      source({ sourceId: "rumour-source", reliability: "TIER_4_UNCONFIRMED" }),
    ],
    modelAvailable: true,
  });
  assert.notEqual(result.status, "ELIGIBLE_FOR_RECALCULATION");
  const corroboration = fact({
    id: "corroboration",
    sourceId: "second",
    confidence: "REPORTED",
    ingestedAt: "2026-10-04T11:00:00Z",
  });
  assert.equal(
    assessResearchRecalculation({
      ...recalculation(),
      changedFactIds: [corroboration.id],
      facts: [fact(), corroboration],
      sources: [source(), source({ sourceId: "second" })],
      modelAvailable: true,
    }).status,
    "NO_ACTIVE_FEATURE_CHANGE",
  );
});

test("canonical participant labels with spaces are accepted exactly, never guessed or normalised", () => {
  const named = fact({ teamId: "FICTIONAL Home United" });
  assert.equal(validateResearchFact(named).teamId, "FICTIONAL Home United");
  assert.equal(
    buildMatchResearchFile({
      event: {
        ...event,
        homeTeamId: "FICTIONAL Home United",
        homeTeam: "FICTIONAL Home United",
      },
      asOfTime,
      sources: [source()],
      facts: [named],
      policy,
    }).status,
    "READY",
  );
  assert.throws(() =>
    validateResearchFact(fact({ teamId: " FICTIONAL Home United" })),
  );
  assert.throws(() =>
    validateResearchFact(fact({ teamId: "FICTIONAL\nHome United" })),
  );
});

test("retained withdrawal tombstones prevent resurrection after licensed successor payload expires", () => {
  const original = fact();
  const withdrawn = fact({
    id: "withdrawal",
    sourceRevision: "2",
    supersedesId: original.id,
    recordState: "WITHDRAWN",
    correctionReason: "AUTHORED withdrawal",
    ingestedAt: "2026-10-04T11:00:00Z",
    expiresAt: "2026-10-04T11:30:00Z",
  });
  const ancestry = [original, withdrawn].map(researchFactAncestry);
  assert.equal(
    resolveResearchFacts([original], [source()], factRequest, ancestry).facts
      .length,
    0,
  );
  assert.equal(
    resolveResearchFacts(
      [original],
      [source()],
      { ...factRequest, asOfTime: "2026-10-04T10:30:00Z" },
      ancestry,
    ).facts[0].fact.id,
    original.id,
  );
  const file = buildMatchResearchFile({
    event,
    asOfTime,
    sources: [source()],
    facts: [original],
    ancestry,
    policy,
  });
  assert.equal(file.factIds.length, 0);
  assert.equal(file.sections.flatMap((s) => s.facts).length, 0);
  assert.equal(
    assessResearchRecalculation({
      ...recalculation(),
      changedFactIds: [withdrawn.id],
      facts: [original],
      ancestry,
      modelAvailable: true,
    }).status,
    "BLOCKED_DATA",
  );
});

test("new correction remains usable using lawful hash-only ancestry after old payload/source version retires", () => {
  const original = fact();
  const corrected = fact({
    id: "fresh",
    sourceVersion: "v2",
    sourceRevision: "2",
    supersedesId: original.id,
    correctionReason: "AUTHORED updated source review",
    ingestedAt: "2026-10-04T11:00:00Z",
    value: { status: "AVAILABLE", reason: "RETURN" },
  });
  const reviewed = source({
    version: "v2",
    reviewedAt: "2026-10-04T10:30:00Z",
  });
  const ancestry = [original, corrected].map(researchFactAncestry);
  const result = resolveResearchFacts(
    [corrected],
    [reviewed],
    factRequest,
    ancestry,
  );
  assert.equal(result.facts[0].fact.id, corrected.id);
  assert.equal(result.timeline.length, 1);
  assert.equal(result.ancestry.length, 2);
  assert.equal("value" in result.ancestry[0], false);
  const corrupt = ancestry.map((a) =>
    a.id === original.id ? { ...a, factKey: "f".repeat(64) } : a,
  );
  assert.equal(
    resolveResearchFacts([corrected], [reviewed], factRequest, corrupt).facts
      .length,
    0,
  );
  assert.throws(() =>
    resolveResearchFacts([corrected], [reviewed], factRequest, [
      { ...researchFactAncestry(corrected), sourceId: "wrong" },
    ]),
  );
  const equivalentClock = {
    ...researchFactAncestry(corrected),
    effectiveAt: "2026-10-04T20:00:00+10:00",
  };
  assert.equal(
    resolveResearchFacts([corrected], [reviewed], factRequest, [
      researchFactAncestry(original),
      equivalentClock,
    ]).facts.length,
    1,
  );
});
