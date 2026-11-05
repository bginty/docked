import test from "node:test";
import assert from "node:assert/strict";
import {
  publicPracticeLineup,
  publicPracticeRules,
} from "../../src/core/public-practice-configuration";
import { nflSeven } from "../../src/core/nfl-seven";

test("public practice uses approved sport formations and fantasy-dollar caps", () => {
  for (const [sport, size, cap] of [
    ["nfl", 7, 4400000],
    ["afl", 22, 13800000],
    ["nrl", 13, 8200000],
  ] as const) {
    const config = publicPracticeLineup(sport);
    assert.equal(config.slots.length, size);
    assert.equal(config.salaryCap, cap);
    assert.equal(config.salaries.CORE, 500000);
    assert(size * config.salaries.CORE <= cap);
    assert.equal(config.lockPolicy, "round-wide-v1");
  }
  assert.equal(nflSeven.lockPolicy, "individual-permanent");
});

test("a prize-bearing source cannot leak entry charges or prizes into public practice", () => {
  const source = {
    scoring_version: "saved-scoring",
    rules: {
      entry_fee_credits: 900,
      round_reward_policy: { active: true, items: [{ amount: 1000 }] },
      scoringPolicy: "existing-saved-rule",
      mode: "SALARY_CAP",
    },
  };
  for (const sport of ["nfl", "afl", "nrl"] as const)
    for (const mode of ["SALARY_CAP", "OPEN"] as const) {
      const rules = publicPracticeRules(
        source,
        sport,
        mode,
        "dated-fixture",
        "Owner-authorised dated practice only",
      );
      assert.equal(rules.mode, mode);
      assert.equal(rules.entry_fee_credits, 0);
      assert.deepEqual(rules.round_reward_policy, {
        version: "public-no-prizes-v1",
        active: false,
        items: [],
        tiePolicy: null,
      });
      assert.equal(rules.scoring_version, "saved-scoring");
      assert.equal(
        (rules as Record<string, unknown>).scoringPolicy,
        "existing-saved-rule",
      );
      assert.equal(rules.free_core_policy, "public-free-core-v1");
      assert.equal(rules.public_access_policy, "au-adult-free-play-v1");
      assert.equal(rules.synthetic, true);
    }
  assert.equal(source.rules.entry_fee_credits, 900);
  assert.equal(source.rules.round_reward_policy.active, true);
});
