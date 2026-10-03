import { test } from "node:test";
import assert from "node:assert/strict";
import {
  awardTransition,
  commercialFlags,
  competitionDraftSchema,
  dealDraftSchema,
  entitlementAllowed,
  membershipSummary,
} from "../../src/core/membership";
import { config } from "../../src/server/config";
import { communityFeatureAllowed } from "../../src/core/community-policy";
import { analyticsInput, pageEvent } from "../../src/core/analytics";

test("all commercial flags reject activation, including Pro without billing", () => {
  for (const [flag, value] of Object.entries(commercialFlags)) {
    assert.equal(value, false);
    assert.throws(() => config({ [flag]: "true" }));
  }
});
test("free growth year uses recorded launch only and never auto converts or removes Free", () => {
  assert.equal(membershipSummary(null).growthYear, "NOT_STARTED");
  const leap = membershipSummary(
    "2024-02-29T12:30:00Z",
    "2025-02-28T12:29:59Z",
  );
  assert.equal(leap.freeYearEndsAt, "2025-02-28T12:30:00.000Z");
  assert.equal(leap.growthYear, "IN_PROGRESS");
  const ended = membershipSummary(
    "2024-02-29T12:30:00Z",
    "2025-02-28T12:30:00Z",
  );
  assert.equal(ended.growthYear, "ENDED");
  assert.equal(ended.plan, "FREE");
  assert.equal(ended.autoConversion, false);
  assert.equal(ended.paymentMethodRequired, false);
  assert.equal(entitlementAllowed("core_official_edges"), true);
  assert.equal(entitlementAllowed("leaderboard_advantage"), false);
  assert.equal(entitlementAllowed("verification_override"), false);
});
test("prize review cannot skip integrity/eligibility or silently substitute an awarded winner", () => {
  assert.equal(
    awardTransition("CALCULATED", "APPROVED", "A sufficient reason"),
    false,
  );
  assert.equal(
    awardTransition("CALCULATED", "INTEGRITY_REVIEW", "A sufficient reason"),
    true,
  );
  assert.equal(
    awardTransition(
      "INTEGRITY_REVIEW",
      "ELIGIBILITY_REVIEW",
      "A sufficient reason",
    ),
    true,
  );
  assert.equal(awardTransition("APPROVED", "AWARDED", "bad"), false);
  assert.equal(
    awardTransition("AWARDED", "CALCULATED", "Replace the winning member"),
    false,
  );
  assert.equal(
    awardTransition("DISQUALIFIED", "AWARDED", "Replace the winning member"),
    false,
  );
});
test("commercial drafts reject wagering volume mechanics, cash ranking and thin samples", () => {
  const draft = {
    title: "Fictional draft",
    description: "An isolated software test, never an activated competition.",
    country: "XX",
    state: "TEST",
    minimumAge: 18,
    membership: "FREE",
    startsAt: "2030-01-01T00:00:00Z",
    endsAt: "2030-02-01T00:00:00Z",
    entryCutoff: "2030-01-01T00:00:00Z",
    sports: ["football"],
    markets: ["h2h"],
    rankingRuleVersion: "test-v1",
    minimumSettled: 20,
    minimumActiveDays: 7,
    prize: "None offered in this fixture",
    prizeValue: null,
    currency: null,
    sponsor: "Fictional fixture",
    officialRulesVersion: "test-v1",
    entryLimit: 1,
    tieBreaker: "NET_UNITS_ROI_SETTLED_EARLIEST",
    exclusions: ["Promotional odds"],
    mechanics: "STANDARD_VERIFIED_PERFORMANCE",
    reason: "Isolated unit test only",
  };
  assert.equal(competitionDraftSchema.safeParse(draft).success, true);
  for (const change of [
    { mechanics: "CASH_WAGERED" },
    { minimumSettled: 1 },
    { minimumActiveDays: 0 },
    { entryCutoff: "2030-01-02T00:00:00Z" },
    { prizeValue: "10" },
    { tieBreaker: "FOLLOWERS" },
  ])
    assert.equal(
      competitionDraftSchema.safeParse({ ...draft, ...change }).success,
      false,
    );
  assert.equal(dealDraftSchema.safeParse({ cashStake: 100 }).success, false);
});
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
      { ...policy, features: ["community_edges"] },
      location,
      "community_edges",
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
  assert.equal(pageEvent("/top-docked"), "leaderboard_viewed");
  assert.equal(pageEvent("/profile/example"), "profile_viewed");
  assert.equal(
    analyticsInput.safeParse({ event: "community_edge_submitted" }).success,
    true,
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
