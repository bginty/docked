import { test } from "node:test";
import assert from "node:assert/strict";
import Decimal from "decimal.js";
import {
  buildMarketReference,
  marketReferenceV1,
  validateMarketReferenceConfig,
} from "../../src/core/market-reference";
import {
  evaluateReference,
  referenceEdgeStatus,
  referenceStrategyV2,
  validateReferenceStrategy,
} from "../../src/core/reference-pricing";
import {
  binaryPrice,
  evaluate,
  hash,
  strategyV1,
} from "../../src/core/pricing";
import { ledger } from "../../src/core/ledger";
import { observeReferencePublication } from "../../src/core/reference-observations";
import {
  referenceConfig,
  referenceInput,
  referenceSources,
  referenceStart,
} from "./market-reference-fixtures";
import { now, rules, quotes } from "./fixtures";
const ready = () => {
  const result = buildMarketReference(referenceInput(), referenceConfig);
  assert.equal(result.status, "READY");
  if (result.status !== "READY") throw new Error();
  return result.reference;
};
test("golden normal markets use independent lower median, separate fair probability and a reproducible evidence hash", () => {
  const r = ready();
  assert.equal(r.decimalPrice, "2.02");
  assert.equal(
    r.pricing?.probability,
    new Decimal("2.15").div("3.90").toString(),
  );
  assert.notEqual(r.decimalPrice, "2.04");
  const reversed = referenceInput();
  reversed.sources.reverse();
  assert.equal(
    buildMarketReference(reversed, referenceConfig).reference?.evidenceHash,
    r.evidenceHash,
  );
  assert.equal(r.evidenceMode, "research");
  assert.equal(r.methodologyVersion, "market-reference-v1.0.0");
});
test("golden missing, stale, suspended, promotional, exchange and outage sources are excluded without inventing availability", () => {
  for (const mutation of [
    "missing",
    "stale",
    "suspended",
    "promotion",
    "exchange",
    "outage",
    "unknown",
  ]) {
    const input = referenceInput();
    const source = input.sources[4];
    if (mutation === "missing") input.sources.pop();
    if (mutation === "stale") source.sourceAt = "2026-10-02T05:56:59.000Z";
    if (mutation === "suspended") source.suspended = true;
    if (mutation === "promotion") source.promotionFlags = ["boost"];
    if (mutation === "exchange") source.sourceKind = "exchange";
    if (mutation === "outage") source.feedHealthy = false;
    if (mutation === "unknown") source.priceClass = "UNKNOWN_REVIEW";
    const result = buildMarketReference(input, referenceConfig);
    assert.equal(result.reference?.decimalPrice, "2.00", mutation);
    input.sources[3].suspended = true;
    assert.equal(
      buildMarketReference(input, referenceConfig).status,
      "UNAVAILABLE",
      mutation,
    );
  }
});
test("golden outlier cannot become benchmark and divergent markets close instead of averaging disagreement away", () => {
  const input = referenceInput();
  input.sources[4].prices = { "Fictional A": "9", "Fictional B": "1.10" };
  const r = buildMarketReference(input, referenceConfig);
  assert.equal(r.reference?.decimalPrice, "2.00");
  assert.ok(r.rejections.some((x) => x.reason === "availability_outlier"));
  input.sources[4].prices = { "Fictional A": "2.25", "Fictional B": "1.65" };
  assert.equal(
    buildMarketReference(input, referenceConfig).status,
    "UNAVAILABLE",
  );
  const disputed = referenceInput();
  disputed.sources[1].prices = { "Fictional A": "2.15", "Fictional B": "1.75" };
  assert.equal(
    buildMarketReference(disputed, referenceConfig).reference?.pricing,
    null,
  );
});
test("golden complete three-way vector works and a missing draw outcome cannot establish its own market", () => {
  const input = referenceInput();
  input.rules = {
    ...input.rules,
    competition: "soccer_epl",
    market: "football_1x2",
    overtime: false,
    draw: true,
    settlement: "regulation_90_plus_stoppage",
    outcomes: [...input.rules.participants, "Draw"],
  };
  for (const source of input.sources) {
    source.rules = structuredClone(input.rules);
    source.prices = { "Fictional A": "2.2", "Fictional B": "3.3", Draw: "3.3" };
  }
  assert.equal(
    buildMarketReference(input, referenceConfig).reference?.decimalPrice,
    "2.20",
  );
  delete input.sources[3].prices.Draw;
  delete input.sources[4].prices.Draw;
  assert.equal(
    buildMarketReference(input, referenceConfig).status,
    "UNAVAILABLE",
  );
  input.rules.outcomes.pop();
  assert.equal(
    buildMarketReference(input, referenceConfig).status,
    "UNAVAILABLE",
  );
});
test("ownership exclusion, duplicate evidence, incomplete rights and future/look-ahead data fail closed", () => {
  const overlap = referenceInput();
  overlap.sources[3].operator = overlap.sources[0].operator;
  overlap.sources[4].operator = overlap.sources[1].operator;
  assert.equal(
    buildMarketReference(overlap, referenceConfig).status,
    "UNAVAILABLE",
  );
  const duplicate = referenceInput();
  duplicate.sources.push(duplicate.sources[3], duplicate.sources[4]);
  assert.equal(
    buildMarketReference(duplicate, referenceConfig).status,
    "UNAVAILABLE",
  );
  for (const kind of ["future", "rights", "mapping", "ownership"]) {
    const input = referenceInput();
    for (const s of input.sources) {
      if (kind === "future") s.receivedAt = "2026-10-02T06:00:01.000Z";
      if (kind === "rights") s.licensed = false;
      if (kind === "mapping") s.mappingVerified = false;
      if (kind === "ownership") s.ownershipEvidence = "";
    }
    assert.equal(
      buildMarketReference(input, referenceConfig).status,
      "UNAVAILABLE",
    );
  }
  assert.equal(
    buildMarketReference(
      { ...referenceInput(), evidenceMode: "current" },
      referenceConfig,
    ).status,
    "UNAVAILABLE",
  );
  assert.equal(
    buildMarketReference(referenceInput(), marketReferenceV1).status,
    "NOT_CONFIGURED",
  );
  assert.throws(() =>
    validateMarketReferenceConfig({
      ...referenceConfig,
      availabilityBookmakers: ["pricing-a"],
    }),
  );
});
test("official candidate uses fair/minimum/current/reference terminology and leaves the legacy evaluator unchanged", () => {
  const config = validateReferenceStrategy({
    ...referenceStrategyV2,
    marketReference: referenceConfig,
  });
  const result = evaluateReference(
    {
      rules,
      startAt: referenceStart,
      decisionAt: now,
      sources: referenceSources(),
      evidenceMode: "research",
    },
    config,
  );
  assert.equal(result.candidates.length, 1);
  const c = result.candidates[0];
  assert.equal(c.reference.decimalPrice, "2.02");
  assert.equal(c.minimumOdds, binaryPrice(c.probability, "2.02").minimumOdds);
  assert.equal(c.configHash, hash(config));
  assert.equal(c.reference.pricing?.fairPrice, c.fairOdds);
  assert.equal(
    evaluate(
      { rules, startAt: referenceStart, decisionAt: now, quotes: quotes() },
      strategyV1,
    ).candidates[0].offer.bookmaker,
    "offer",
  );
  assert.equal(
    evaluateReference({
      rules,
      startAt: referenceStart,
      decisionAt: now,
      sources: referenceSources(),
      evidenceMode: "research",
    }).candidates.length,
    0,
  );
});
test("golden price movement never rewrites the publication benchmark, cannot reactivate or duplicate a bet", () => {
  const publication = ready();
  const base = {
    minimumEdgePrice: "1.91",
    currentMarketReference: "2.02",
    previousStatus: "ACTIVE" as const,
    now,
    startAt: referenceStart,
    settled: false,
    available: true,
  };
  assert.equal(referenceEdgeStatus(base), "ACTIVE");
  assert.equal(
    referenceEdgeStatus({ ...base, currentMarketReference: "1.88" }),
    "PRICE BELOW MINIMUM",
  );
  assert.equal(
    referenceEdgeStatus({
      ...base,
      previousStatus: "PRICE BELOW MINIMUM",
      currentMarketReference: "2.05",
    }),
    "SUSPENDED",
  );
  assert.equal(
    referenceEdgeStatus({
      ...base,
      currentMarketReference: null,
      available: false,
    }),
    "SUSPENDED",
  );
  assert.equal(
    referenceEdgeStatus({ ...base, now: referenceStart }),
    "EXPIRED",
  );
  assert.equal(referenceEdgeStatus({ ...base, settled: true }), "SETTLED");
  const result = ledger(
    [
      {
        id: "fictional",
        eventId: rules.eventId,
        publishedAt: now,
        odds: publication.decimalPrice,
        stake: "1",
        evidence: "demo",
        result: "won",
        sport: "basketball",
        strategy: referenceStrategyV2.version,
      },
    ],
    "demo",
  );
  assert.equal(result.net, "1.02");
  assert.equal(publication.decimalPrice, "2.02"); // Current/minimum/closing values never enter accounting.
});
test("reference observation preserves captured accounting and probability, honours cutoff and leaves late samples missing", () => {
  const input = referenceInput();
  const publication = ready();
  const observed = "2026-10-02T06:05:00.000Z";
  for (const source of input.sources) {
    source.sourceAt = observed;
    source.snapshotAt = observed;
    source.receivedAt = observed;
  }
  for (const source of input.sources.filter((s) =>
    s.bookmaker.startsWith("market-"),
  ))
    source.prices = { "Fictional A": "1.80", "Fictional B": "2.10" };
  const fixture = {
    ...input,
    observedAt: observed,
    publishedAt: now,
    publicationMarketReference: publication.decimalPrice,
    publicationProbability: publication.pricing!.probability,
    minimumEdgePrice: "1.88",
    previousStatus: "ACTIVE" as const,
    resolutionSeconds: 300,
  };
  const observation = observeReferencePublication(fixture, referenceConfig);
  assert.equal(observation?.publicationMarketReference, "2.02");
  assert.equal(observation?.currentMarketReference, "1.80");
  assert.equal(observation?.status, "PRICE BELOW MINIMUM");
  assert.deepEqual(observation?.targets, [5]);
  const missingPricing = observeReferencePublication(
    {
      ...fixture,
      sources: fixture.sources.filter((source) =>
        referenceConfig.availabilityBookmakers.includes(source.bookmaker),
      ),
    },
    referenceConfig,
  );
  assert.equal(missingPricing?.status, "SUSPENDED");
  assert.equal(missingPricing?.publicationMarketReference, "2.02");
  assert.equal(missingPricing?.currentMarketReference, "1.80");
  assert.equal(
    observeReferencePublication(
      { ...fixture, startAt: "invalid" },
      referenceConfig,
    ),
    null,
  );
  assert.deepEqual(
    observeReferencePublication(
      { ...fixture, observedAt: "2026-10-02T06:07:00.000Z" },
      referenceConfig,
    )?.targets,
    [],
  );
  assert.equal(
    observeReferencePublication(
      { ...fixture, observedAt: "2026-10-02T06:50:00.000Z" },
      referenceConfig,
    )?.status,
    "EXPIRED",
  );
});
