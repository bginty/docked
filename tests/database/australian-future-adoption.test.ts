import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import { approvedAustralianLineup } from "../../src/core/approved-australian-rules";
test("Future salary adoption preserves historical, confirmed and draft snapshots; new rounds inherit approved rules without activation", async () => {
  if (process.env.AUSTRALIAN_SALARY_TEST_DB)
    assert.ok(
      ["afl", "nrl"].includes(process.env.AUSTRALIAN_SALARY_TEST_SPORT ?? ""),
      "Select an isolated native sport explicitly",
    );
  for (const sport of [aflConfiguration, nrlConfiguration]) {
    if (
      process.env.AUSTRALIAN_SALARY_TEST_DB &&
      sport.id !== process.env.AUSTRALIAN_SALARY_TEST_SPORT
    )
      continue;
    const db = await multiSportDatabase(sport);
    try {
      const picks = db.config.slots.map((s, i) => ({
        slot: s.id,
        card: db.inventories[db.user][i].id,
      }));
      await db.command("seven_enter", db.rounds.SALARY_CAP2, picks, 0);
      await db.command("seven_draft", db.rounds.SALARY_CAP3, picks, 0);
      const historical = randomUUID();
      await db.pg.exec(
        "select set_config('qa.now','2097-01-01',false); alter table beta_fantasy.competitions disable trigger australian_future_approved_salary;",
      );
      await db.q(
        `insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize) select $1,'Historical preserved',sport,season,99,'2098-01-01',rules,scoring_id,prize from beta_fantasy.competitions where id=$2`,
        [historical, db.rounds.SALARY_CAP1],
      );
      await db.pg.exec(
        "select set_config('qa.now','2099-01-01',false); alter table beta_fantasy.competitions enable trigger australian_future_approved_salary;",
      );
      const read = () =>
        db.q(
          "select id,rules,prize from beta_fantasy.competitions order by id",
        );
      const before = await read();
      const guard = (
        await db.q(
          "select pg_get_functiondef('sports_feed.australian_salary_transition_allowed(jsonb,jsonb)'::regprocedure) d",
        )
      )[0].d;
      const migration = (
        await readFile(
          "supabase/migrations/20261025234813_australian_future_salary_adoption.sql",
          "utf8",
        )
      ).replaceAll("clock_timestamp()", "qa.now()");
      await db.pg.exec(migration);
      const after = await read();
      for (const c of before) {
        const actual = after.find((a) => a.id === c.id)!;
        if (c.id === db.rounds.SALARY_CAP1)
          assert.equal(
            actual.rules.lineup_version,
            approvedAustralianLineup(sport.id as "afl" | "nrl").version,
          );
        else assert.deepEqual(actual, c);
        assert.equal(actual.prize, c.prize);
      }
      assert.equal(
        (
          await db.q(
            "select pg_get_functiondef('sports_feed.australian_salary_transition_allowed(jsonb,jsonb)'::regprocedure) d",
          )
        )[0].d,
        guard,
      );
      await db.pg.exec(migration);
      assert.deepEqual(await read(), after);
      const future = randomUUID();
      await db.q(
        `insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize) select $1,'New future round',sport,season,100,'2099-04-01',rules,scoring_id,prize from beta_fantasy.competitions where id=$2`,
        [future, db.rounds.SALARY_CAP2],
      );
      const created = (await read()).find((c) => c.id === future)!;
      assert.equal(
        created.rules.lineup_version,
        approvedAustralianLineup(sport.id as "afl" | "nrl").version,
      );
      assert.equal(created.rules.round_reward_policy.active, false);
      assert.equal(created.rules.round_reward_policy.tiePolicy, null);
      assert.equal(
        (
          await db.q(
            "select count(*)::int n from beta_private.audit_events where action='future_salary_adopted'",
          )
        )[0].n,
        1,
      );
    } finally {
      await db.pg.close();
    }
  }
});
