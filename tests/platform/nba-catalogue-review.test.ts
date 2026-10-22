import test from "node:test";
import assert from "node:assert/strict";
import { reviewNbaCatalogue } from "../../src/core/nba-catalogue-review";
const now = "2026-10-22T00:00:00.000Z";
function fixture() {
  return {
    policy: {
      sport: "basketball",
      season: "2027",
      provider: "fixture-reviewed",
      rightsEvidence: "https://example.test/isolated-rights",
      rightsExpiresAt: "2026-10-24T00:00:00.000Z",
      rosterUse: true,
      storage: true,
      fantasyUse: true,
      maxAgeHours: 72,
      permittedRegistrations: ["active"],
    },
    completeTeamIds: Array.from({ length: 30 }, (_, i) => `team-${i}`),
    bindings: Array.from({ length: 30 }, (_, i) => ({
      sport: "nba",
      season: "2027",
      provider: "fixture-reviewed",
      canonicalPlayerId: `canonical-${i}`,
      providerPlayerId: String(i),
      playerId: `existing-${i}`,
      canonicalTeamId: `source-team-${i}`,
      teamId: `team-${i}`,
      teamName: `Synthetic ${i}`,
      evidenceUrl: "https://example.test/isolated-roster",
    })),
    rows: Array.from({ length: 30 }, (_, i) => ({
      sport: "nba",
      season: "2027",
      provider: "fixture-reviewed",
      provider_id: String(i),
      player_id: `canonical-${i}`,
      team_id: `source-team-${i}`,
      name: `Synthetic Player ${i}`,
      synthetic: false,
      verified_at: Date.parse(now) / 1000,
      contract_status: "active_contracted",
      contract_evidence: "isolated-contract-evidence",
      availability: "injured",
      approved_positions: ["PG", "SG"],
      position_evidence: "isolated-position-evidence",
      jersey: null,
    })),
  };
}
test("NBA review requires full team coverage and stable reviewed identities without granting issuance", () => {
  const input = fixture(),
    report = reviewNbaCatalogue(input, now);
  assert.equal(report.readyForReview, 30);
  assert.equal(report.completeEligibleCoverage, true);
  assert.equal(report.positionCounts.PG, 30);
  assert.equal(report.positionCounts.SG, 30);
  assert.equal(report.activationAllowed, false);
  assert.equal(report.issuanceAllowed, false);
  assert.equal(report.rows[0].candidate?.playerId, "existing-0");
  assert.equal(report.rows[0].candidate?.jerseyNumber, null);
  assert.deepEqual(reviewNbaCatalogue(input, now), report);
});
test("unknown contracts and source positions cannot silently become eligible", () => {
  const input = fixture();
  input.rows[0].contract_evidence = "";
  input.rows[1].approved_positions = ["G"];
  const report = reviewNbaCatalogue(input, now);
  assert.equal(report.quarantined, 2);
  assert.equal(report.completeEligibleCoverage, false);
  assert.equal(report.teamCoverage["team-0"], 0);
});
test("duplicate bindings, incomplete fetches, synthetic sources and wrong sport are rejected", () => {
  for (const change of [
    (b: ReturnType<typeof fixture>) => {
      b.completeTeamIds.pop();
    },
    (b: ReturnType<typeof fixture>) => {
      b.completeTeamIds[1] = b.completeTeamIds[0];
    },
    (b: ReturnType<typeof fixture>) => {
      b.bindings[1].playerId = b.bindings[0].playerId;
    },
    (b: ReturnType<typeof fixture>) => {
      b.rows[0].synthetic = true;
    },
    (b: ReturnType<typeof fixture>) => {
      b.rows[0].sport = "nfl";
    },
    (b: ReturnType<typeof fixture>) => {
      b.bindings.shift();
    },
  ]) {
    const b = fixture();
    change(b);
    assert.throws(() => reviewNbaCatalogue(b, now));
  }
});
test("a team change preserves canonical player identity; historical sources cannot refresh eligibility", () => {
  const input = fixture();
  input.rows[0].team_id = "source-team-1";
  input.bindings[0].canonicalTeamId = "source-team-1";
  input.bindings[0].teamId = "team-1";
  const report = reviewNbaCatalogue(input, now);
  assert.equal(report.rows[0].candidate?.playerId, "existing-0");
  input.rows[0].verified_at -= 4 * 86400;
  assert.equal(reviewNbaCatalogue(input, now).rows[0].status, "quarantined");
});
