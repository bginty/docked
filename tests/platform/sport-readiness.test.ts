import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateReadiness,
  activationGates,
} from "../../src/core/sport-readiness";
import { fixturePackage, readinessNow } from "../fixtures/readiness-package";
import { digest } from "../../src/core/scoring-engine";
test("every independent release gate requires current matching evidence; owner approval cannot substitute", () => {
  const p = fixturePackage(),
    hash = digest(p),
    decision = {
      packageHash: hash,
      action: "approve" as const,
      at: readinessNow,
    };
  assert.equal(evaluateReadiness(p, readinessNow, hash).readyForRelease, false);
  assert.equal(
    evaluateReadiness(p, readinessNow, hash, decision).readyForRelease,
    true,
  );
  assert.equal(
    evaluateReadiness(p, readinessNow, hash, decision).activated,
    false,
  );
  for (const gate of activationGates.slice(0, -1)) {
    const missing = {
      ...p,
      evidence: p.evidence.filter((e) => e.gate !== gate),
    };
    assert.equal(
      evaluateReadiness(missing, readinessNow, hash, decision).readyForRelease,
      false,
      gate,
    );
  }
  for (const patch of [
    { outcome: "blocked" },
    { expiresAt: readinessNow },
    { verifiedAt: "2099-01-02T00:00:01Z" },
    { catalogueHash: "f".repeat(64) },
  ]) {
    const bad = structuredClone(p);
    Object.assign(bad.evidence[0], patch);
    assert.equal(
      evaluateReadiness(bad, readinessNow, hash, decision).readyForRelease,
      false,
    );
  }
  for (const d of [
    { ...decision, packageHash: "f".repeat(64) },
    { ...decision, action: "suspend" as const },
  ])
    assert.equal(
      evaluateReadiness(p, readinessNow, hash, d).readyForRelease,
      false,
    );
  assert.throws(
    () =>
      evaluateReadiness(
        { ...p, evidence: [...p.evidence.slice(1), p.evidence[1]] },
        readinessNow,
        hash,
      ),
    /Duplicate/,
  );
});
test("Traditional needs its own approved cap; configured rules names or a different roster are insufficient", () => {
  const p = fixturePackage(),
    hash = digest(p);
  assert.equal(
    evaluateReadiness({ ...p, mode: "SALARY_CAP" }, readinessNow, hash)
      .readyForOwnerReview,
    false,
  );
  assert.equal(
    evaluateReadiness({ ...p, formatVersion: "old-18" }, readinessNow, hash)
      .readyForOwnerReview,
    false,
  );
  assert.equal(
    evaluateReadiness({ ...p, scoringVersion: "unknown" }, readinessNow, hash)
      .readyForOwnerReview,
    false,
  );
  assert.equal(
    evaluateReadiness({ ...p, evidence: [] }, readinessNow, hash)
      .readyForOwnerReview,
    false,
  );
});
