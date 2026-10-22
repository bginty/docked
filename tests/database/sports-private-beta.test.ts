import test from "node:test";
import assert from "node:assert/strict";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import {
  aflConfiguration,
  nrlConfiguration,
} from "../../src/core/sport-configuration";
import { sandboxRecommendation } from "../../src/core/sport-sandbox";
for (const config of [aflConfiguration, nrlConfiguration])
  test(`${config.label} private beta requires independent gate and preserves slot/round/privacy isolation`, async () => {
    const db = await multiSportDatabase(config, true);
    try {
      await db.pg
        .exec(`create or replace function beta_private.beta_gameplay_identity(p_user uuid) returns boolean language sql as $$select true$$;
   create or replace function beta_private.gameplay_mfa_required(p_user uuid) returns boolean language sql as $$select false$$;`);
      await db.q(
        "insert into sports_feed.nba_beta_control values(true,true,'Local test',clock_timestamp())",
      );
      for (const u of [db.user, db.other])
        await db.q(
          "insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at) values($1,true,'Local test','infinity')",
          [u],
        );
      await db.q(
        "select set_config('docked.nba_private_beta','enabled',false),set_config('docked.sports_private_beta','enabled',false),set_config('docked.private_beta_sport',$1,false)",
        [config.id],
      );
      await assert.rejects(db.state(), /Sport private beta/);
      await db.q(
        "update sports_feed.private_beta_sports set enabled=true,authority='Isolated fixture test' where sport=$1",
        [config.id],
      );
      const state = await db.state();
      const picks = sandboxRecommendation(state, db.rounds.SALARY_CAP1).picks;
      assert.equal(picks.length, config.slots.length);
      assert.deepEqual(
        picks.map((p) => p.slot).sort(),
        config.slots.map((s) => s.id).sort(),
      );
      await db.command("seven_enter", db.rounds.SALARY_CAP1, picks, 0);
      assert.equal((await db.state()).entries.length, 1);
      await db.asUser(db.other);
      assert.equal((await db.state()).entries.length, 0);
      await assert.rejects(
        db.q("select sports_feed.sport_sandbox_state('basketball')"),
        /Sport context mismatch/,
      );
      await db.q(
        "select set_config('docked.private_beta_sport','football',false)",
      );
      await assert.rejects(db.state(), /Sport private beta/);
      await db.q("select set_config('docked.private_beta_sport',$1,false)", [
        config.id,
      ]);
      await db.q(
        "update sports_feed.nba_beta_access set enabled=false where user_id=$1",
        [db.other],
      );
      await assert.rejects(db.state(), /NBA beta access/);
      for (const role of [
        "anon",
        "authenticated",
        "service_role",
        "docked_beta_app",
      ])
        assert.equal(
          (
            await db.q(
              "select has_table_privilege($1,'sports_feed.private_beta_sports','UPDATE') ok",
              [role],
            )
          )[0].ok,
          false,
        );
      assert.equal(
        (
          await db.q(
            "select count(*)::int n from sports_feed.private_beta_sport_audit where sport=$1",
            [config.id],
          )
        )[0].n,
        2,
      );
    } finally {
      await db.pg.close();
    }
  });
