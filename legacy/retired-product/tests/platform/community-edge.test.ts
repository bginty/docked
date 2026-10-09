import { test } from "node:test";
import assert from "node:assert/strict";
import {
  verifyCommunityQuote,
  communityRuleV1,
  communityMarketLabel,
  type CommunityQuoteEvidence,
} from "../../src/core/community-edge";
const now = "2026-10-03T10:00:00Z";
function quote(): CommunityQuoteEvidence {
  const rules = {
    eventId: "isolated-fictional-event",
    competition: "soccer_epl",
    participants: ["Fixture A", "Fixture B"],
    market: "football_1x2" as const,
    period: "full_game" as const,
    overtime: false,
    draw: true,
    line: null,
    settlement: "regulation_90_plus_stoppage",
    outcomes: ["Fixture A", "Draw", "Fixture B"],
  };
  return {
    snapshotId: "isolated-test",
    marketId: "test-market",
    sport: "football",
    competition: "soccer_epl",
    eventId: rules.eventId,
    eventLabel: "Fictional test only",
    startAt: "2026-10-03T11:00:00Z",
    selection: "Fixture A",
    bookmaker: "fixture-book",
    odds: "2.51",
    sourceAt: "2026-10-03T09:59:30Z",
    receivedAt: now,
    cutoffAt: "2026-10-03T10:50:00Z",
    classification: "STANDARD_VERIFIED",
    ruleVersion: communityRuleV1.version,
    provider: "fixture-provider",
    providerEventId: "fixture-event",
    snapshotAt: "2026-10-03T09:59:45Z",
    rules,
    canonicalRules: structuredClone(rules),
    observedStartAt: "2026-10-03T11:00:00Z",
    prices: { "Fixture A": "2.51", Draw: "3.1", "Fixture B": "2.8" },
    suspended: false,
    eventStatus: "scheduled",
    provenance: "docked_current_provider",
    licensed: true,
    providerClassification: "STANDARD_VERIFIED",
    classificationEvidence: "Isolated fictional classification evidence",
    classificationVersion: "fixture-v1",
    promotionFlags: [],
  };
}
const context = {
  now,
  regionAllowed: true,
  bookmakerAllowed: true,
  feedHealthy: true,
};
test("community market labels retain the canonical settlement distinction", () => {
  const rules = quote().canonicalRules;
  assert.equal(
    communityMarketLabel(rules),
    "Full-time result · regulation 90 plus stoppage",
  );
  assert.equal(
    communityMarketLabel({
      ...rules,
      market: "nba_moneyline",
      settlement: "full_game_including_overtime",
    }),
    "Moneyline · full game including overtime",
  );
  assert.equal(rules.settlement, "regulation_90_plus_stoppage");
});
test("standard observed quote verifies; ordinary account limits alone do not imply promotion", () => {
  assert.equal(verifyCommunityQuote(quote(), context).eligible, true);
  assert.equal(
    verifyCommunityQuote({ ...quote(), ordinaryAccountLimits: true }, context)
      .eligible,
    true,
  );
});
test("missing classification and each promotional mechanism fail closed", () => {
  assert.equal(
    verifyCommunityQuote({ ...quote(), providerClassification: null }, context)
      .classification,
    "UNKNOWN_REVIEW",
  );
  assert.equal(
    verifyCommunityQuote({ ...quote(), classificationEvidence: null }, context)
      .eligible,
    false,
  );
  for (const flag of [
    "boost",
    "personalised",
    "token",
    "VIP",
    "new_customer",
    "capped_enhancement",
  ])
    assert.equal(
      verifyCommunityQuote({ ...quote(), promotionFlags: [flag] }, context)
        .classification,
      "PROMOTIONAL_EXCLUDED",
    );
});
test("claimed larger price, demo, missing rights and provider outage cannot create verified record", () => {
  for (const change of [
    { odds: "5.5" },
    { provenance: "demo" as const },
    { licensed: false },
    { prices: { "Fixture A": "NaN", Draw: "3", "Fixture B": "2" } },
  ])
    assert.equal(
      verifyCommunityQuote({ ...quote(), ...change }, context).eligible,
      false,
    );
  for (const change of [
    { regionAllowed: false },
    { bookmakerAllowed: false },
    { feedHealthy: false },
  ])
    assert.equal(
      verifyCommunityQuote(quote(), { ...context, ...change }).eligible,
      false,
    );
});
test("cutoff is strict; timestamp freshness/order, event reschedule and complete mapping enforced", () => {
  assert.equal(
    verifyCommunityQuote(quote(), { ...context, now: "2026-10-03T10:50:00Z" })
      .classification,
    "POST_CUTOFF",
  );
  for (const change of [
    { sourceAt: "2026-10-03T09:56:59Z" },
    { receivedAt: "2026-10-03T10:00:01Z" },
    { snapshotAt: "2026-10-03T09:59:00Z" },
    { sourceAt: "invalid" },
    { observedStartAt: "2026-10-03T12:00:00Z" },
    { sport: "basketball" },
  ])
    assert.equal(
      verifyCommunityQuote({ ...quote(), ...change }, context).eligible,
      false,
    );
  const bad = quote();
  bad.rules = {
    ...bad.rules,
    outcomes: ["Fixture A", "Fake outcome", "Fixture B"],
  };
  bad.canonicalRules = bad.rules;
  assert.equal(
    verifyCommunityQuote(bad, context).classification,
    "MARKET_MISMATCH",
  );
});
