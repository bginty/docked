import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAuthorisedScoring } from "../../src/core/authorised-scoring-feed";
test("Authorised feed boundary denies unknown rights, gaps, stale data and other football competitions", () => {
  const now = "2026-10-10T12:00:00Z",
    mapping = {
      sport: "epl" as const,
      fixtureId: "match-1",
      playerIds: ["player-1"],
    };
  const data = {
    provider: "contract-test",
    simulated: false,
    competition: "EPL",
    sport: "epl",
    fixtureId: "match-1",
    revision: 1,
    observedAt: now,
    status: "scheduled",
    endedAt: null,
    players: [{ playerId: "player-1", availability: "pending", stats: null }],
  };
  const approval = {
    provider: "contract-test",
    competition: "EPL",
    commercialFantasy: true,
    storage: true,
    evidence: "https://example.invalid/test-only",
    reviewExpires: "2026-10-11T12:00:00Z",
    maxAgeSeconds: 60,
  };
  assert.equal(
    validateAuthorisedScoring(data, approval, mapping, now).players[0].stats,
    null,
  );
  for (const bad of [
    { ...approval, commercialFantasy: false },
    { ...approval, reviewExpires: now },
    {},
  ])
    assert.throws(() => validateAuthorisedScoring(data, bad, mapping, now));
  for (const bad of [
    { ...data, players: [] },
    { ...data, competition: "Championship" },
    { ...data, observedAt: "2026-10-10T10:00:00Z" },
    {
      ...data,
      players: [{ playerId: "player-1", availability: "complete", stats: {} }],
    },
  ])
    assert.throws(() => validateAuthorisedScoring(bad, approval, mapping, now));
});
