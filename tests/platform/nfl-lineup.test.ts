import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formationFor,
  fieldSlots,
  lineupIssues,
  eligibleForPosition,
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
