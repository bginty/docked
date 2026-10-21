import { test } from "node:test";
import assert from "node:assert/strict";
import {
  reviewRosterBatch,
  rosterReviewReport,
  type RosterCandidate,
} from "../../src/core/sport-roster-review";
const now = "2099-01-02T00:00:00Z";
const policy = {
  sport: "afl",
  season: "2099",
  provider: "qa-evidence",
  rightsEvidence: "https://example.invalid/qa-permit",
  rightsExpiresAt: "2099-02-01T00:00:00Z",
  rosterUse: true,
  storage: true,
  fantasyUse: true,
  maxAgeHours: 24,
  permittedRegistrations: ["active"],
};
const candidate: RosterCandidate = {
  sport: "afl",
  season: "2099",
  provider: "qa-evidence",
  playerId: "qa:p",
  providerPlayerId: "1",
  name: "Fictional QA",
  teamId: "qa:t",
  teamName: "Fictional QA Club",
  identityVerified: true,
  registration: "active",
  availability: "injured",
  positions: ["MID", "FWD"],
  positionsVerified: true,
  jerseyNumber: null,
  jerseyVerified: false,
  evidence: {
    url: "https://example.invalid/qa-roster",
    sha256: "a".repeat(64),
    observedAt: "2099-01-01T23:00:00Z",
  },
};
test("roster review preserves injured/suspended registrations and verified dual positions; unknown numbers stay blank", () => {
  for (const availability of ["injured", "suspended"] as const) {
    const r = rosterReviewReport(
      [{ ...candidate, availability }],
      policy,
      now,
      ["qa:t"],
    );
    assert.equal(r.readyForReview, 1);
    assert.equal(r.rows[0].candidate?.jerseyNumber, null);
    assert.equal(r.issuanceAllowed, false);
    assert.equal(r.activationAllowed, false);
  }
});
test("quarantine incomplete/stale/conflicting identity evidence without mutating originals", () => {
  const before = structuredClone(candidate);
  for (const patch of [
    { registration: "retired" },
    { registration: "loan" },
    { sport: "nrl" },
    { identityVerified: false },
    { positions: ["QB"] },
    { positionsVerified: false },
    { jerseyNumber: 12 },
    { evidence: { ...candidate.evidence, observedAt: "2098-12-01T00:00:00Z" } },
  ]) {
    assert.equal(
      reviewRosterBatch([{ ...candidate, ...patch }], policy, now, ["qa:t"])[0]
        .status,
      "quarantined",
    );
  }
  assert.equal(
    reviewRosterBatch([candidate], policy, now, [])[0].status,
    "quarantined",
  );
  assert(
    reviewRosterBatch([candidate, candidate], policy, now, ["qa:t"]).every(
      (r) => r.status === "quarantined",
    ),
  );
  assert.equal(reviewRosterBatch([{}], policy, now, [])[0].candidate, null);
  assert.deepEqual(candidate, before);
});
test("rights are required and explicit registration policies cannot authorise retired or unknown players", () => {
  assert.throws(() => reviewRosterBatch([candidate], {}, now, []));
  assert.throws(
    () =>
      reviewRosterBatch(
        [candidate],
        { ...policy, rightsExpiresAt: now },
        now,
        [],
      ),
    /rights/,
  );
  assert.throws(
    () =>
      reviewRosterBatch(
        [candidate],
        { ...policy, permittedRegistrations: ["retired"] },
        now,
        [],
      ),
    /Inactive/,
  );
});
