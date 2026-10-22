import { test } from "node:test";
import assert from "node:assert/strict";
import { previewSportIssuance } from "../../src/core/sport-issuance-preview";
test("issuance preview preserves lifetime caps, excludes Core from paid pools and never mints", () => {
  const now = "2099-01-01T00:00:00Z";
  const player = {
    sport: "afl",
    season: "2099",
    playerId: "qa:p",
    provider: "qa",
    providerPlayerId: "1",
    name: "Fictional QA",
    teamId: "qa:t",
    teamName: "QA",
    identityVerified: true,
    registration: "active",
    availability: "injured",
    positions: ["MID"],
    positionsVerified: true,
    jerseyNumber: null,
    jerseyVerified: false,
    evidence: {
      url: "https://example.invalid/roster",
      sha256: "a".repeat(64),
      observedAt: now,
    },
  };
  const policy = {
    sport: "afl",
    season: "2099",
    provider: "qa",
    rightsEvidence: "https://example.invalid/qa",
    rightsExpiresAt: "2099-01-03T00:00:00Z",
    rosterUse: true,
    storage: true,
    fantasyUse: true,
    maxAgeHours: 24,
    permittedRegistrations: ["active"],
  };
  const p = {
    sport: "afl",
    season: "2099",
    allocations: [
      {
        playerId: "qa:p",
        rarity: "ICON",
        proposedCount: 1,
        alreadyIssuedLifetime: 1,
        pool: "premium",
      },
      {
        playerId: "qa:p",
        rarity: "CORE",
        proposedCount: 4,
        alreadyIssuedLifetime: 0,
        pool: "standard",
      },
      {
        playerId: "qa:p",
        rarity: "RARE",
        proposedCount: 1,
        alreadyIssuedLifetime: 0,
        pool: "premium",
      },
      {
        playerId: "qa:p",
        rarity: "LEGENDARY",
        proposedCount: 2,
        alreadyIssuedLifetime: 48,
        pool: "premium",
      },
    ],
  };
  const r = previewSportIssuance(p, [player], policy, ["qa:t"], now);
  assert.equal(r.issuanceAllowed, false);
  assert.equal(r.proposedCards, 2);
  assert.equal(r.excludedAllocations, 3);
  assert.equal(r.allocations[3].missingVerifiedNumber, true);
  const duplicate = previewSportIssuance(
    { ...p, allocations: [p.allocations[3], p.allocations[3]] },
    [player],
    policy,
    ["qa:t"],
    now,
  );
  assert.equal(duplicate.proposedCards, 0);
  assert.equal(
    previewSportIssuance(p, [], policy, ["qa:t"], now).proposedCards,
    0,
  );
});
