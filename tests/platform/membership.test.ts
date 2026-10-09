import { test } from "node:test";
import assert from "node:assert/strict";
import { communityFeatureAllowed } from "../../src/core/community-policy";
import { analyticsInput, pageEvent } from "../../src/core/analytics";
test("community policy cannot inherit a tips-only approval, expired review or unknown region", () => {
  const location = { country: "XX", state: "TEST", ageAttested: true };
  const policy = {
    ...location,
    approved: true,
    evidence: "Isolated reviewed fixture",
    version: "fixture",
    minimumAge: 18,
    effectiveFrom: "2026-01-01",
    effectiveTo: "2027-01-01",
    reviewAt: "2026-12-01",
    features: ["tips"],
    operators: [],
  };
  assert.equal(
    communityFeatureAllowed(policy, location, "community_edges", "2026-10-03"),
    false,
  );
  assert.equal(
    communityFeatureAllowed(
      { ...policy, features: ["community_social"] },
      location,
      "community_social",
      "2026-10-03",
    ),
    true,
  );
  assert.equal(
    communityFeatureAllowed(
      { ...policy, features: ["community_edges"] },
      location,
      "community_edges",
      "2026-12-01",
    ),
    false,
  );
  assert.equal(
    communityFeatureAllowed(null, location, "leaderboards", "2026-10-03"),
    false,
  );
  assert.equal(
    communityFeatureAllowed(
      { ...policy, features: ["community_edges"], minimumAge: 21 },
      location,
      "community_edges",
      "2026-10-03",
    ),
    false,
  );
});
test("social analytics taxonomy excludes cash, loss targeting and arbitrary private payloads", () => {
  assert.equal(pageEvent("/top-docked"), null);
  assert.equal(pageEvent("/profile/example"), "profile_viewed");
  assert.equal(
    analyticsInput.safeParse({ event: "community_edge_submitted" }).success,
    false,
  );
  assert.equal(
    analyticsInput.safeParse({ event: "community_edge_submitted", stake: 100 })
      .success,
    false,
  );
  assert.equal(
    analyticsInput.safeParse({ event: "loss_chasing" }).success,
    false,
  );
});
