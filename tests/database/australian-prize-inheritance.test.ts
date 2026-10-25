import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import {
  approvedAustralianLineup,
  approvedAustralianPrizes,
} from "../../src/core/approved-australian-rules";
test("future Australian rounds inherit inactive approved rewards; historical QA and NFL remain untouched", async () => {
  for (const cfg of [aflConfiguration, nrlConfiguration]) {
    const db = await multiSportDatabase(cfg);
    try {
      const before = await db.q(
        "select id,rules,prize from beta_fantasy.competitions order by id",
      );
      for (const mode of ["SALARY_CAP", "OPEN"] as const) {
        const id = randomUUID(),
          rules = {
            mode,
            lineup_version: approvedAustralianLineup(cfg.id as "afl" | "nrl")
              .version,
            inventory_scope: "isolated-multi-sport-v1",
            lock_policy: "round-wide-v1",
            scoring_version: "isolated-no-scoring-v1",
          };
        await db.q(
          "insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize) values($1,'Isolated future round',$2,'2099',9,'2099-02-01',$3,(select id from beta_fantasy.scoring_rules where version='isolated-no-scoring-v1'),'No cash prize')",
          [id, cfg.id, rules],
        );
        const row = (
          await db.q(
            "select rules from beta_fantasy.competitions where id=$1",
            [id],
          )
        )[0];
        assert.deepEqual(
          row.rules.round_reward_policy,
          approvedAustralianPrizes(cfg.id as "afl" | "nrl", mode),
        );
        assert.equal(
          (
            await db.q(
              "select count(*)::int n from beta_fantasy.prize_schedules where competition_id=$1",
              [id],
            )
          )[0].n,
          0,
        );
      }
      const after = await db.q(
        "select id,rules,prize from beta_fantasy.competitions where round<9 order by id",
      );
      assert.deepEqual(after, before);
    } finally {
      await db.pg.close();
    }
  }
});
