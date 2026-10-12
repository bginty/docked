import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formationFor,
  fieldSlots,
  lineupIssues,
  eligibleForPosition,
  competitionCardEligible,
} from "../../src/core/fantasy-play";
import type { FantasyCard, FantasyCompetition } from "../../src/core/fantasy";
const comp = {
  id: "qa",
  name: "Isolated NFL test",
  round: 1,
  locks_at: "2099-01-01T00:00:00Z",
  scored_at: null,
  sport: "nfl",
  season: "2026",
  rules: { postgame: true, duplicates: false },
} as FantasyCompetition;
test("lifetime inventory stays out of free rounds; mapped rarity round accepts old artwork seasons and rejects byes/listed cards", () => {
  const card = {
    id: "c",
    player_id: "p",
    owner_id: "qa",
    tier: "ULTRA_RARE",
    position: "QB",
    sport: "nfl",
    season: "lifetime",
    status: "active",
    inventory_scope: "invited-nfl-test-v2",
  } as FantasyCard;
  const weighted = {
    ...comp,
    rules: { ...comp.rules, inventory_scope: "invited-nfl-test-v2" },
    eligible_player_ids: ["p"],
  };
  assert.equal(competitionCardEligible(card, comp), false);
  assert.equal(eligibleForPosition(card, "QB", weighted, "qa", []), true);
  const core = {
    ...card,
    id: "core",
    tier: "CORE",
    player_id: "old-uuid",
    canonical_player_id: "p",
    inventory_scope: undefined,
  } as FantasyCard;
  assert.equal(eligibleForPosition(core, "QB", weighted, "qa", []), true);
  assert.equal(
    eligibleForPosition(card, "QB", weighted, "qa", [core]),
    false,
    "Core and limited version of the same real player cannot occupy two slots",
  );
  assert.equal(
    eligibleForPosition({ ...card, listed: true }, "QB", weighted, "qa", []),
    false,
  );
  assert.equal(
    eligibleForPosition(
      { ...card, player_id: "bye" },
      "QB",
      weighted,
      "qa",
      [],
    ),
    false,
  );
  assert.equal(
    eligibleForPosition(
      { ...card, id: "other", tier: "ICON" },
      "QB",
      weighted,
      "qa",
      [card],
    ),
    false,
  );
  assert.equal(
    eligibleForPosition(
      { ...card, owner_id: "other" },
      "QB",
      weighted,
      "qa",
      [],
    ),
    false,
  );
});
test("NFL fixed positions and each permitted FLEX consume seven distinct owned players", () => {
  for (const flex of ["RB", "WR", "TE"]) {
    const cards = ["QB", "RB", "RB", "WR", "WR", "TE", flex].map(
      (position, i) => ({
        id: String(i),
        player_id: "p" + i,
        owner_id: "qa",
        sport: "nfl",
        season: "2026",
        position,
        status: "active",
        tier: "CORE",
      }),
    ) as FantasyCard[];
    assert.deepEqual(
      lineupIssues(
        cards,
        cards.map((c) => c.id),
        comp,
        "qa",
      ),
      [],
    );
    const slots = fieldSlots(cards, formationFor(comp)!);
    assert.equal(new Set(slots.map((s) => s.card?.id)).size, 7);
    assert.equal(slots.at(-1)?.position, "FLEX");
    assert.equal(eligibleForPosition(cards[0], "FLEX", comp, "qa", []), false);
    const invalid = structuredClone(cards);
    invalid[6].position = "K";
    assert.ok(
      lineupIssues(
        invalid,
        invalid.map((c) => c.id),
        comp,
        "qa",
      ).length,
    );
    invalid[6] = { ...cards[6], status: "unavailable" };
    assert.ok(
      lineupIssues(
        invalid,
        invalid.map((c) => c.id),
        comp,
        "qa",
      ).length,
    );
    assert.ok(
      lineupIssues(
        cards,
        cards.map((c) => c.id),
        comp,
        "other",
      ).length,
    );
  }
});
