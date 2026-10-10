import { test } from "node:test";
import assert from "node:assert/strict";
import { rulesets, scorePlayer } from "../../src/core/scoring-v1";
import { currentRulesets, scoringRows } from "../../src/core/scoring-release";
import { packProducts, commerceReadiness } from "../../src/core/pack-products";
import {
  validateCatalogue,
  inventoryReplacementPlan,
} from "../../src/core/player-catalogue";
test("AFL new version uses owner weights and never mutates old competitions", () => {
  const stats = {
    kicks: 1,
    handballs: 1,
    goals: 1,
    marks: 0,
    tackles: 0,
    behinds: 0,
    hitouts: 0,
    freesFor: 0,
    freesAgainst: 0,
  };
  assert.equal(scorePlayer(currentRulesets.afl, "MID", stats).centipoints, 900);
  assert.equal(scorePlayer(rulesets.afl, "MID", stats).centipoints, 1100);
  assert.notEqual(currentRulesets.afl.version, rulesets.afl.version);
  assert.equal(
    scoringRows(currentRulesets.afl).find((r) => r.action.startsWith("kicks"))
      ?.points,
    "2",
  );
  assert.equal(
    scoringRows(currentRulesets.epl).find((r) => r.action === "Goal · GK")
      ?.points,
    "6",
  );
  assert.equal(
    scoringRows(currentRulesets.nfl).find((r) =>
      r.action.startsWith("passing yards"),
    )?.points,
    "0.04",
  );
});
test("Pack offers are server-priced, exactly one, no invented Premium mapping or activation", () => {
  assert.deepEqual(
    packProducts.map((p) => p.priceCents),
    [4900, 9900],
  );
  assert.ok(packProducts.every((p) => p.cards === 1 && p.currency === "AUD"));
  assert.equal(packProducts[0].inventoryTier, null);
  assert.equal(commerceReadiness.liveCharges, false);
  assert.equal(commerceReadiness.selectionMethod, null);
});
test("Catalogue fails closed on rights, stale sources, duplicates and non-EPL football", () => {
  const p = {
    id: "00000000-0000-4000-8000-000000000001",
    provider: "synthetic",
    providerId: "test1",
    name: "Test Player",
    sport: "epl",
    competition: "EPL",
    currentClubId: "test",
    currentClub: "Test club",
    position: "MID",
    firstEligibleSeason: "2026",
    observedAt: "2026-10-10T00:00:00Z",
    evidence: "https://example.invalid/test",
  };
  const m = {
    provider: "synthetic",
    version: "test-only",
    reviewedAt: p.observedAt,
    reviewExpiresAt: "2026-11-01T00:00:00Z",
    evidence: p.evidence,
    fantasyUse: true,
    storage: true,
    collectibleSales: false,
    playerLikeness: false,
    clubLogos: false,
    players: [p],
  };
  assert.equal(validateCatalogue(m, "2026-10-10T01:00:00Z").players.length, 1);
  for (const bad of [
    { ...m, fantasyUse: false },
    { ...m, players: [p, p] },
    { ...m, players: [{ ...p, competition: "La Liga" }] },
  ])
    assert.throws(() => validateCatalogue(bad, "2026-10-10T01:00:00Z"));
  assert.throws(() => validateCatalogue(m, "2026-10-20T00:00:00Z"));
  assert.equal(
    inventoryReplacementPlan(
      [{ id: "old", owner: "owner" }],
      [{ oldCardId: "old", newEditionId: p.id }],
      "Separate beta grant with preserved original history",
    )[0].preserveOriginal,
    true,
  );
});
