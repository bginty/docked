import test from "node:test";
import assert from "node:assert/strict";
import { buildMarketReference } from "../../src/core/market-reference";
import { referenceMonitoringPrice } from "../../src/core/reference-monitoring";
import { referenceEdgeStatus } from "../../src/core/reference-pricing";
import { referenceInput, referenceConfig } from "./market-reference-fixtures";
function reference() {
  const result = buildMarketReference(referenceInput(), referenceConfig);
  assert.equal(result.status, "READY");
  if (result.status !== "READY") throw Error();
  return result.reference;
}
test("independent monitoring uses frozen model probability with availability-only current reference", () => {
  const r = { ...reference(), pricing: null };
  const input = {
    pricingModel: "football_independent_v1" as const,
    publicationProbability: "0.58",
    reference: r,
    minEV: "0.05",
    tick: "0.01",
    maxOdds: "5",
    maxEV: "0.5",
  };
  const result = referenceMonitoringPrice(input);
  assert.ok(result);
  assert.equal(result.price.probability, "0.58");
  assert.equal(result.price.ev, "0.1716");
  assert.equal(result.price.minimumOdds, "1.82");
  assert.equal(result.probability, "0.58");
  assert.equal(result.closingProbability, null);
  const changed = referenceMonitoringPrice({
    ...input,
    reference: { ...r, decimalPrice: "1.70", pricing: reference().pricing },
  });
  assert.equal(changed?.price.ev, "-0.014");
  assert.equal(changed?.probability, "0.58");
  assert.equal(changed?.closingProbability, null);
  assert.equal(input.publicationProbability, "0.58");
  assert.equal(r.decimalPrice, "2.02");
});
test("monitoring preserves legacy pricing-cohort requirement and fails closed on invalid or excessive current edge", () => {
  const r = reference(),
    input = {
      pricingModel: "market_reference_v1" as const,
      publicationProbability: "0.58",
      reference: r,
      minEV: "0.05",
      tick: "0.01",
      maxOdds: "5",
      maxEV: "0.5",
    };
  assert.equal(
    referenceMonitoringPrice(input)?.probability,
    r.pricing?.probability,
  );
  assert.equal(
    referenceMonitoringPrice(input)?.closingProbability,
    r.pricing?.probability,
  );
  assert.equal(
    referenceMonitoringPrice({ ...input, reference: { ...r, pricing: null } }),
    null,
  );
  assert.equal(
    referenceMonitoringPrice({
      ...input,
      pricingModel: "football_independent_v1",
      publicationProbability: "NaN",
    }),
    null,
  );
  assert.equal(
    referenceMonitoringPrice({
      ...input,
      pricingModel: "football_independent_v1",
      reference: { ...r, decimalPrice: "4" },
    }),
    null,
  );
  assert.equal(referenceMonitoringPrice({ ...input, reference: null }), null);
});
test("independent availability observation does not reactivate recovered or terminal publication", () => {
  const input = {
    minimumEdgePrice: "1.82",
    currentMarketReference: "2",
    previousStatus: "PRICE BELOW MINIMUM" as const,
    now: "2026-10-04T01:00:00Z",
    startAt: "2026-10-04T02:00:00Z",
    settled: false,
    available: true,
  };
  assert.equal(referenceEdgeStatus(input), "SUSPENDED");
  assert.equal(
    referenceEdgeStatus({ ...input, previousStatus: "EXPIRED" }),
    "EXPIRED",
  );
  assert.equal(
    referenceEdgeStatus({ ...input, previousStatus: "SETTLED" }),
    "SETTLED",
  );
  assert.equal(
    referenceEdgeStatus({
      ...input,
      previousStatus: "ACTIVE",
      available: false,
    }),
    "SUSPENDED",
  );
});
