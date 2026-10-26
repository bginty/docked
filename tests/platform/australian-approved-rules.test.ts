import test from "node:test";
import assert from "node:assert/strict";
import {
  approvedAustralianLineup,
  approvedAustralianPrizes,
} from "../../src/core/approved-australian-rules";
import { sevenIssues } from "../../src/core/nfl-seven";
import { prizeItems } from "../../src/core/prize-schedules";
test("Approved caps allow exact boundaries with legal formations; Open remains uncapped", () => {
  for (const sport of ["afl", "nrl"] as const) {
    const config = approvedAustralianLineup(sport);
    const cards = config.slots.map((slot, i) => ({
      id: String(i),
      player_id: String(i),
      sport,
      position: slot.positions[0],
      status: "active",
      listed: false,
      tier: i < (sport === "afl" ? 16 : 9) ? "RARE" : "ULTRA_RARE",
    }));
    const picks = config.slots.map((slot, i) => ({
      slot: slot.id,
      card: String(i),
    }));
    const exact = sevenIssues("SALARY_CAP", picks, cards, true, config);
    assert.equal(exact.remaining, 0);
    assert.deepEqual(exact.errors, []);
    assert.deepEqual(
      sevenIssues(
        "SALARY_CAP",
        picks,
        cards.map((c) => ({ ...c, tier: "CORE" })),
        true,
        config,
      ).errors,
      [],
    );
    assert.ok(
      sevenIssues("OPEN", picks.slice(1), cards, true, config).errors.length,
    );
    assert.ok(
      sevenIssues(
        "OPEN",
        picks,
        cards.map((c, i) => ({
          ...c,
          player_id: i === 1 ? cards[0].player_id : c.player_id,
        })),
        true,
        config,
      ).errors.some((e) => e.includes("one card")),
    );
    assert.ok(
      sevenIssues(
        "OPEN",
        picks,
        cards.map((c, i) => ({ ...c, position: i === 0 ? "WR" : c.position })),
        true,
        config,
      ).errors.some((e) => e.includes("requires")),
    );
    cards[0].tier = "ELITE";
    assert.ok(
      sevenIssues("SALARY_CAP", picks, cards, true, config).errors.some((e) =>
        e.includes("exceeds"),
      ),
    );
    assert.deepEqual(
      sevenIssues("OPEN", picks, cards, true, config).errors,
      [],
    );
    assert.deepEqual(
      sevenIssues(
        "SALARY_CAP",
        picks,
        cards.map((c) => ({ ...c, tier: "RARE" })),
        true,
        config,
      ).errors,
      [],
    );
    assert.ok(
      sevenIssues(
        "SALARY_CAP",
        picks,
        cards.map((c) => ({ ...c, tier: "ULTRA_RARE" })),
        true,
        config,
      ).errors.some((e) => e.includes("exceeds")),
    );
    for (const mode of ["SALARY_CAP", "OPEN"] as const) {
      const schedule = approvedAustralianPrizes(sport, mode);
      assert.equal(schedule.active, false);
      assert.equal(schedule.tiePolicy, null);
      assert.equal(prizeItems.safeParse(schedule.items).success, true);
      assert.equal(schedule.items.filter((p) => p.from === 2).length, 2);
      assert.ok(
        schedule.items
          .filter((p) => p.type === "pack")
          .every(
            (p) => p.amount === 5 && p.productVersion?.includes(`-9-${sport}-`),
          ),
      );
    }
  }
});
