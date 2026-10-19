import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectionCsv,
  csvCell,
  type ExportCard,
} from "../../src/core/collection-export";
import { nflScoringReference } from "../../src/core/nfl-scoring-reference";
import { nflPostgameWeights } from "../../src/core/nfl-postgame-policy";
import { roundProgress, playerScoreStatus } from "../../src/core/round-status";
import { socialAttachments } from "../../src/core/social-attachment";
test("CSV exports every instance, keeps unlimited supply blank and neutralises Excel formulas", () => {
  const cards: ExportCard[] = Array.from({ length: 1501 }, (_, i) => ({
    id: `card-${i}`,
    player_id: `player-${i}`,
    name: i === 0 ? ' =HYPERLINK("unsafe")' : 'Line, "Two"\nThree',
    sport: i % 2 ? "nfl" : "football",
    team: "Test",
    position: "WR",
    tier: i % 2 ? "RARE" : "CORE",
    serial: i % 2 ? i : null,
    max_supply: i % 2 ? 10000 : null,
    season: "2026",
    edition_id: "edition",
    acquired_at: "2026-10-19T10:00:00+11:00",
    listing_price: i === 1 ? 100 : null,
  }));
  const csv = collectionCsv(cards);
  assert.ok(csv.startsWith('\uFEFF"card_instance_id"'));
  for (const c of cards) assert.ok(csv.includes(`"${c.id}"`));
  assert.ok(csv.includes("' =HYPERLINK"));
  assert.ok(csv.includes('"Core","1","",""'));
  assert.ok(csv.includes('"2026-10-18T23:00:00.000Z"'));
  assert.ok(csv.includes('"Yes","100"'));
  assert.equal(csvCell("\t+1"), '"\'\t+1"');
  assert.equal(csvCell(-12), '"-12"');
  assert.throws(() => collectionCsv([cards[0], cards[0]]), /Duplicate/);
});
test("rules reference uses the exact game-log weights and exposes saved-rule differences", () => {
  const rows = nflScoringReference({ ...nflPostgameWeights, receptions: 50 });
  assert.equal(rows.find((r) => r.statistic === "receptions")?.base, "1");
  assert.equal(rows.find((r) => r.statistic === "receptions")?.saved, "0.50");
  assert.deepEqual(
    rows.filter((r) => r.differs).map((r) => r.statistic),
    ["receptions"],
  );
  assert.equal(
    5 * nflPostgameWeights.receptions + 76 * nflPostgameWeights.receiving_yards,
    1260,
  );
  assert.equal(
    250 * nflPostgameWeights.passing_yards +
      2 * nflPostgameWeights.passing_touchdowns +
      nflPostgameWeights.interceptions_thrown,
    1600,
  );
  assert.equal(
    100 * nflPostgameWeights.rushing_yards +
      nflPostgameWeights.rushing_touchdowns,
    1600,
  );
  assert.equal(nflPostgameWeights.fumbles_lost, -200);
  assert.equal(nflPostgameWeights.receiving_two_point_conversions, 200);
});
test("round status never labels unstarted fixtures final or missing scores zero", () => {
  const now = Date.parse("2026-10-19T00:00:00Z");
  const fixture = (hours: number, status = "scheduled") => ({
    scheduledAt: new Date(now + hours * 3600000).toISOString(),
    status,
  });
  const input = {
    now,
    closesAt: new Date(now - 1).toISOString(),
    finalised: false,
    fixtures: [fixture(-3), fixture(4)],
  };
  assert.equal(
    roundProgress(input).label,
    "Entries closed · round in progress",
  );
  assert.equal(roundProgress({ ...input, finalised: true }).provisional, true);
  assert.equal(
    roundProgress({ ...input, closesAt: new Date(now + 1).toISOString() })
      .label,
    "Entries open",
  );
  assert.equal(
    roundProgress({ ...input, fixtures: [fixture(-3)] }).label,
    "Awaiting player statistics",
  );
  assert.equal(
    roundProgress({ ...input, fixtures: [fixture(-3)], completeScores: true })
      .label,
    "Results under review",
  );
  assert.equal(
    roundProgress({
      ...input,
      fixtures: [fixture(-3)],
      finalised: true,
      completeScores: true,
    }).label,
    "Final results",
  );
  assert.equal(
    roundProgress({
      ...input,
      fixtures: [fixture(-3)],
      finalised: true,
      completeScores: false,
    }).label,
    "Awaiting player statistics",
  );
  assert.equal(playerScoreStatus("pending-data"), "Awaiting player statistics");
  assert.equal(playerScoreStatus("dnp"), "Did not play");
  assert.equal(
    roundProgress({
      ...input,
      fixtures: [fixture(-1, "live")],
      finalised: true,
      completeScores: true,
    }).provisional,
    true,
  );
  assert.equal(playerScoreStatus("bye"), "Bye");
});
test("historical card attachment identity is retained without a name/caption fallback", () => {
  const saved = {
    id: "saved-card",
    player_id: "saved-player",
    edition_id: "saved-edition",
    name: "Historical Player",
    sport: "football",
    position: "GK",
    team: "Saved Club",
    tier: "CORE",
  };
  const projected = socialAttachments([
    saved,
    null,
    { name: "Different Player" },
    saved,
  ]);
  assert.deepEqual(projected.cards, [saved]);
  assert.equal(projected.unavailable, 3);
  assert.equal(
    projected.cards[0],
    saved,
    "thumbnail and viewer receive the same immutable snapshot",
  );
});
