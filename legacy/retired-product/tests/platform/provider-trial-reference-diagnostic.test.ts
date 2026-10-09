import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMarketReference,
  marketReferenceV1,
} from "../../src/core/market-reference";
import {
  normalizeTrialReferenceDiagnostic,
  projectTrialReferenceDiagnostic,
} from "../../src/core/provider-trial-reference-diagnostic";
import { referenceConfig, referenceInput } from "./market-reference-fixtures";

const input = () => {
  const source = referenceInput();
  return {
    marketId: "isolated-market",
    selection: source.selection,
    methodVersion: referenceConfig.version,
    observedAt: source.observedAt,
    sourceIds: source.sources.map((s) => s.id),
    authorityAllowed: true,
    result: buildMarketReference(source, referenceConfig),
  };
};
const unknown = (d: ReturnType<typeof projectTrialReferenceDiagnostic>) => {
  for (const key of [
    "availabilityPrice",
    "availabilitySources",
    "pricingSources",
    "eligibleObservations",
    "excludedObservations",
    "staleObservations",
    "outliers",
    "sourceAgeSeconds",
  ] as const)
    assert.equal(d[key], null, key);
};
test("empty source cohorts do not convert market-level preflight failure into rejected/fresh source counts", () => {
  const d = projectTrialReferenceDiagnostic({
    ...input(),
    result: buildMarketReference(referenceInput(), marketReferenceV1),
  });
  assert.equal(d.status, "NOT_CONFIGURED");
  unknown(d);
});
test("missing policy or source authority hides unmeasured metrics even if a caller supplied a ready result", () => {
  const d = projectTrialReferenceDiagnostic({
    ...input(),
    authorityAllowed: false,
  });
  assert.equal(d.status, "UNAVAILABLE");
  unknown(d);
});
test("only actual source identities are counted once; market and pricing sentinels are never observations", () => {
  const value = input();
  const id = value.sourceIds[0];
  value.result.rejections.push(
    { sourceId: "market", reason: "stale" },
    { sourceId: "pricing", reason: "availability_outlier" },
    { sourceId: id, reason: "stale" },
    { sourceId: id, reason: "stale" },
  );
  const d = projectTrialReferenceDiagnostic(value);
  assert.equal(d.sourceMetricsMeasured, true);
  assert.equal(d.excludedObservations, 1);
  assert.equal(d.staleObservations, 1);
  assert.equal(d.outliers, 0);
});
test("cutoff preflight without source analysis leaves unmeasured counts null", () => {
  const d = projectTrialReferenceDiagnostic({
    ...input(),
    result: {
      status: "UNAVAILABLE",
      reference: null,
      rejections: [{ sourceId: "market", reason: "post_cutoff" }],
    },
  });
  unknown(d);
});
test("legacy immutable sentinel counts normalize on read without rewriting their stored values", () => {
  const legacy = {
    ...projectTrialReferenceDiagnostic(input()),
    status: "NOT_CONFIGURED" as const,
    sourceMetricsMeasured: undefined,
    excludedObservations: 1,
    staleObservations: 0,
    outliers: 0,
  };
  const before = structuredClone(legacy);
  unknown(normalizeTrialReferenceDiagnostic(legacy));
  assert.deepEqual(legacy, before);
});
