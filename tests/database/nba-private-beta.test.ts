import { test } from "node:test";
import assert from "node:assert/strict";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import { nbaWeeklyConfiguration } from "../../src/core/sport-configuration";
import { sandboxRecommendation } from "../../src/core/sport-sandbox";
test("NBA private beta allowlist preserves confirmation, session, member MFA, sport and inventory boundaries", async () => {
  const db = await multiSportDatabase(nbaWeeklyConfiguration, true);
  try {
    // Transport fixture only: the reviewed NBA SQL verifies each account/session.
    await db.pg
      .exec(`create or replace function beta_private.beta_gameplay_identity(p_user uuid) returns boolean language sql as $$select true$$;
    create or replace function beta_private.gameplay_mfa_required(p_user uuid) returns boolean language sql as $$select p_user='${db.other}'::uuid$$;`);
    await db.q("select set_config('docked.nba_private_beta','enabled',false)");
    await assert.rejects(db.state(), /NBA beta access/);
    await db.q(
      "insert into sports_feed.nba_beta_control values(true,true,'Owner isolated acceptance',clock_timestamp())",
    );
    await db.q(
      "insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at) values($1,true,'Owner testing','infinity')",
      [db.user],
    );
    await db.q("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({
        sub: db.user,
        aal: "aal1",
        session_id: db.sessions[db.user],
      }),
    ]);
    assert.equal(
      (await db.q("select sports_feed.nba_beta_capability() ok"))[0].ok,
      true,
    );
    const state = await db.state();
    assert.equal(state.competitions.length, 6);
    const picks = sandboxRecommendation(state, db.rounds.SALARY_CAP1).picks;
    const call = () =>
      db.q("select sports_feed.sport_sandbox_command('seven_enter',$1,$2)", [
        JSON.stringify({
          competition_id: db.rounds.SALARY_CAP1,
          revision: 0,
          selections: picks,
        }),
        crypto.randomUUID(),
      ]);
    await call();
    assert.equal((await db.state()).entries.length, 1);
    await db.q("update auth.users set email_confirmed_at=null where id=$1", [
      db.user,
    ]);
    await assert.rejects(db.state(), /NBA beta access/);
    await db.q(
      "update auth.users set email_confirmed_at=now(),banned_until='infinity' where id=$1",
      [db.user],
    );
    await assert.rejects(db.state(), /NBA beta access/);
    await db.q("update auth.users set banned_until=null where id=$1", [
      db.user,
    ]);
    await db.q("update auth.sessions set not_after='2000-01-01' where id=$1", [
      db.sessions[db.user],
    ]);
    await assert.rejects(db.state(), /NBA beta access/);
    await db.asUser(db.other);
    await assert.rejects(db.state(), /NBA beta access/);
    await db.q(
      "insert into sports_feed.nba_beta_access(user_id,enabled,authority,expires_at) values($1,true,'Owner testing','infinity')",
      [db.other],
    );
    await db.q("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({
        sub: db.other,
        aal: "aal1",
        session_id: db.sessions[db.other],
      }),
    ]);
    await assert.rejects(
      db.state(),
      /NBA beta access/,
      "Owner/admin still require MFA",
    );
    await db.asUser(db.other);
    assert.equal(
      (await db.state()).entries.length,
      0,
      "Pre-lock selections stay private",
    );
    await db.q(
      "update sports_feed.nba_beta_access set enabled=false where user_id=$1",
      [db.other],
    );
    await assert.rejects(db.state(), /NBA beta access/);
    for (const role of ["anon", "authenticated", "service_role"]) {
      assert.equal(
        (
          await db.q(
            "select has_function_privilege($1,'sports_feed.nba_beta_capability()','EXECUTE') ok",
            [role],
          )
        )[0].ok,
        false,
      );
    }
    assert.equal(
      (
        await db.q(
          "select has_table_privilege('docked_beta_app','sports_feed.nba_beta_access','INSERT') ok",
        )
      )[0].ok,
      false,
    );
  } finally {
    await db.pg.close();
  }
});
