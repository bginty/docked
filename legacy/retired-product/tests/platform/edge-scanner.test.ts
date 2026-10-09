import test from "node:test";
import assert from "node:assert/strict";
import {
  scannerActionSchema,
  scannerCadence,
  scannerCandidateKey,
  scannerExpiry,
  scannerMetrics,
  scannerScheduleSchema,
  scannerSlot,
  scannerStrategyAllowed,
} from "../../src/core/edge-scanner";
import { scannerWorkerAuthorized } from "../../src/server/scanner-auth";
const at = "2026-10-03T00:00:00.000Z";
const schedule = scannerScheduleSchema.parse({
  id: "fixture-hourly",
  enabled: false,
  provider: "odds-papi",
  sport: "football",
  competition: "soccer_epl",
  strategyId: "fixture-strategy",
  regionPolicyId: "11111111-1111-4111-8111-111111111111",
  intervalSeconds: 900,
  nearEventSeconds: 7200,
  nearIntervalSeconds: 60,
  horizonSeconds: 86400,
  minQuotaRemaining: 10,
});
test("unrun or partially measured scans preserve unknowns rather than reporting zero performance", () => {
  assert.ok(Object.values(scannerMetrics(undefined)).every((v) => v === null));
  assert.equal(scannerMetrics({ events: 0, markets: 0 }).events, 0);
  assert.equal(scannerMetrics({ events: 0, markets: 0 }).stale, null);
  assert.equal(scannerMetrics({ fresh: NaN, stale: -1 }).fresh, null);
});
test("scanner cadence preserves unknown quota and only accelerates within the approved event horizon", () => {
  assert.equal(
    scannerCadence(schedule, at, "2026-10-03T01:00:00Z", null).intervalSeconds,
    900,
  );
  assert.equal(
    scannerCadence(schedule, at, "2026-10-03T01:00:00Z", 9).intervalSeconds,
    900,
  );
  assert.equal(
    scannerCadence(schedule, at, "2026-10-03T01:00:00Z", 10).intervalSeconds,
    60,
  );
  assert.equal(
    scannerCadence(schedule, at, "2026-10-03T00:05:00Z", 10).intervalSeconds,
    900,
  );
  assert.equal(
    scannerSlot("fixture", at, 900),
    scannerSlot("fixture", "2026-10-03T00:01:00Z", 900),
  );
});
test("candidate idempotency binds source snapshots and strategy window, not a refreshed observation clock", () => {
  const input = {
    marketId: "m",
    strategyId: "s",
    strategyHash: "h",
    selection: "A",
    purpose: "research" as const,
    sourceIds: ["b", "a"],
    windowSeconds: 3600,
    regionPolicyId: "r",
  };
  assert.equal(
    scannerCandidateKey(input),
    scannerCandidateKey({ ...input, sourceIds: ["a", "b"] }),
  );
  assert.notEqual(
    scannerCandidateKey(input),
    scannerCandidateKey({ ...input, windowSeconds: 21600 }),
  );
  assert.notEqual(
    scannerCandidateKey(input),
    scannerCandidateKey({ ...input, sourceIds: ["a", "c"] }),
  );
});
test("research lifecycle never grants paper or live approval and manual inputs cannot override the engine", () => {
  const state = {
    lifecycle: "RESEARCH",
    active: false,
    frozen: false,
    researchApproved: false,
    paperApproved: false,
    ownerApproved: false,
  };
  assert.equal(scannerStrategyAllowed("research", state), true);
  assert.equal(scannerStrategyAllowed("paper", state), false);
  assert.equal(scannerStrategyAllowed("live", state), false);
  assert.equal(
    scannerStrategyAllowed("live", {
      ...state,
      lifecycle: "APPROVED_FOR_LIVE",
      active: true,
      frozen: true,
      researchApproved: true,
      paperApproved: true,
      ownerApproved: false,
    }),
    false,
  );
  const manual = {
    action: "manual_candidate",
    marketId: "m",
    selection: "A",
    strategyId: "s",
    regionPolicyId: schedule.regionPolicyId,
    purpose: "research",
    reason: "Fictional isolated review",
  };
  assert.equal(scannerActionSchema.safeParse(manual).success, true);
  for (const field of ["odds", "probability", "minimumOdds", "edgePercent"])
    assert.equal(
      scannerActionSchema.safeParse({ ...manual, [field]: 2.5 }).success,
      false,
    );
  assert.equal(
    scannerScheduleSchema.safeParse({ ...schedule, provider: "oddspapi" })
      .success,
    false,
  );
});
test("candidate expiry is bounded by source age, pre-event cutoff and the review window", () => {
  assert.equal(
    scannerExpiry({
      sourceAt: "2026-10-02T23:57:30Z",
      startAt: "2026-10-03T01:00:00Z",
      scannedAt: at,
      maxAgeSeconds: 180,
      cutoffSeconds: 600,
    }),
    "2026-10-03T00:00:30.000Z",
  );
  assert.throws(() =>
    scannerExpiry({
      sourceAt: at,
      startAt: "2026-10-03T00:05:00Z",
      scannedAt: at,
      maxAgeSeconds: 180,
      cutoffSeconds: 600,
    }),
  );
});
test("worker authorization rejects Unicode byte-length mismatch without throwing and has no fallback credential", () => {
  const secret = "a".repeat(40);
  assert.equal(scannerWorkerAuthorized(secret, `Bearer ${secret}`), true);
  for (const value of [
    `Bearer ${"é".repeat(40)}`,
    `Bearer ${"a".repeat(39)}b`,
    "",
    null,
  ])
    assert.equal(scannerWorkerAuthorized(secret, value), false);
  assert.equal(scannerWorkerAuthorized(undefined, `Bearer ${secret}`), false);
  assert.equal(scannerWorkerAuthorized("short", "Bearer short"), false);
});
