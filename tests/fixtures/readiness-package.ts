import {
  activationGates,
  type ReadinessPackage,
} from "../../src/core/sport-readiness";
export const readinessNow = "2099-01-02T00:00:00Z";
/** Artificial acceptance evidence; never a real source/approval. */
export function fixturePackage(): ReadinessPackage {
  const hashes = {
    releaseHash: "a".repeat(64),
    catalogueHash: "b".repeat(64),
    rulesHash: "c".repeat(64),
    issuanceHash: "d".repeat(64),
  };
  return {
    schemaVersion: 1,
    sport: "afl",
    season: "2099-QA",
    mode: "OPEN",
    formatVersion: "docked-afl-22-v1",
    scoringVersion: "docked-afl-22-events-v1",
    ...hashes,
    salaryCap: null,
    provider: "qa-only",
    evidence: activationGates
      .filter((g) => g !== "owner-activation")
      .map((gate) => ({
        gate,
        ...hashes,
        reference: "https://example.invalid/isolated-acceptance",
        sha256: "e".repeat(64),
        verifiedAt: "2099-01-01T00:00:00Z",
        expiresAt: "2099-01-03T00:00:00Z",
        outcome: "passed",
      })),
  };
}
