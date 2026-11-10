import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { multiSportDatabase } from "../fixtures/multi-sport-db";
import { sportConfigurations } from "../../src/core/sport-configuration";
import { nflSeven } from "../../src/core/nfl-seven";
import { sandboxRecommendation } from "../../src/core/sport-sandbox";

for (const sport of ["nfl", "afl", "nrl"])
  test(`${sport.toUpperCase()} public member: free Core without beta admission, strict policy and isolated rounds`, async () => {
    const d = await multiSportDatabase(
      sportConfigurations[sport],
      false,
      undefined,
      true,
    );
    try {
      const migration = await readFile(
        "supabase/migrations/20261102010001_public_customer_gameplay.sql",
        "utf8",
      );
      await d.pg.exec(migration); // Idempotent reapplication, not a second wrapper.
      await d.pg.exec(
        await readFile(
          "supabase/migrations/20261109232000_public_practice_phone_guards.sql",
          "utf8",
        ),
      );
      const u = randomUUID(),
        sid = randomUUID(),
        cid = randomUUID();
      await d.q(
        "insert into auth.users(id,email_confirmed_at,phone,phone_confirmed_at)values($1,now(),'61400000001',now());",
        [u],
      );
      await d.q("insert into auth.sessions(id,user_id)values($1,$2)", [sid, u]);
      await d.q(
        "insert into public.profiles(id,country,state,age_attested,accepted_version)values($1,'AU','NSW',true,'isolated-public-v1')",
        [u],
      );
      await d.q(
        "insert into private.consent_events(user_id,purpose,granted,version,actor) values($1,'privacy',true,'isolated-public-v1','isolated test')",
        [u],
      );
      await d.q(
        "insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,evidence) values('AU','NSW','isolated-public-v1','2020-01-01','2100-01-01','2100-01-01',true,18,'isolated synthetic acceptance; not regulatory approval')",
      );
      await d.q(
        "update public_gameplay.policy set enabled=true,terms_version='isolated-public-v1',privacy_version='isolated-public-v1',valid_until='2100-01-01',authority='isolated synthetic acceptance only'",
      );
      await d.q(
        "update public_gameplay.sports set visible=true,play_enabled=true where sport=$1",
        [sport],
      );
      let version = d.config.version;
      if (sport === "nfl") {
        const config = {
          ...nflSeven,
          version: "isolated-public-nfl-v1",
          inventoryScope: "isolated-multi-sport-v1",
          lockPolicy: "round-wide-v1",
        };
        await d.q(
          "insert into beta_fantasy.lineup_configurations values($1,$2)",
          [config.version, JSON.stringify(config)],
        );
        version = config.version;
      }
      await d.q(
        "insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id,prize,awards) select $1,'Public practice',sport,season,4,locks_at,rules||jsonb_build_object('synthetic',true,'public_access_policy','au-adult-free-play-v1','entry_fee_credits',0,'lineup_version',$3::text),scoring_id,'No cash prize','[]' from beta_fantasy.competitions where id=$2",
        [cid, d.rounds.SALARY_CAP1, version],
      );
      const fixtures = [
        {
          fixtureId: `sim:${sport}:public`,
          scheduledAt: "2099-02-02T00:00:00Z",
          status: "scheduled",
          synthetic: true,
          playerIds: d.inventories[d.user].map((c: any) => c.player_id),
        },
      ];
      await d.q(
        "insert into public_gameplay.rounds(competition_id,sport,enabled,rules_hash,fixtures,fixture_kind,source_reference) select c.id,c.sport,true,md5(c.rules::text),$2,'practice','isolated future fixture' from beta_fantasy.competitions c where c.id=$1",
        [cid, JSON.stringify(fixtures)],
      );
      for (const c of d.inventories[d.user]) {
        await d.q(
          "insert into beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season)values($1,$2,$3,$4,$5,'#1759a3',1,'2099')",
          [c.player_id, c.name, sport, c.position, c.team],
        );
        await d.q(
          "insert into sports_feed.free_core_roster values($1,$2,'2099',$3,'2099-03-01','https://example.invalid/isolated-roster',$4,true)",
          [
            c.player_id,
            sport,
            JSON.stringify(c.eligible_positions),
            "a".repeat(64),
          ],
        );
      }
      await d.q(
        "update sports_feed.free_core_programmes set enabled=true where sport=$1",
        [sport],
      );
      await d.q(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('docked.public_gameplay','enabled',false)",
        [u, JSON.stringify({ sub: u, aal: "aal1", session_id: sid })],
      );
      const read = async () =>
        (await d.q("select public_gameplay.read_state($1) state", [sport]))[0]
          .state;
      const state = await read();
      await d.q("update auth.users set phone_confirmed_at=null where id=$1", [
        u,
      ]);
      await assert.rejects(read(), /Verified phone required/);
      await d.q(
        "update auth.users set phone_confirmed_at=clock_timestamp() where id=$1",
        [u],
      );
      await assert.rejects(
        d.q(
          "insert into auth.users(id,phone,phone_confirmed_at)values($1,'61400000001',now())",
          [randomUUID()],
        ),
        /unique|duplicate/,
      );
      await assert.rejects(
        d.q(
          "update public_gameplay.rounds set fixture_kind='verified' where competition_id=$1",
          [cid],
        ),
      );
      await assert.rejects(
        d.q(
          "update beta_fantasy.competitions set name='Scored live round' where id=$1",
          [cid],
        ),
        /Practice|immutable/,
      );
      await assert.rejects(
        d.q(
          "update beta_fantasy.competitions set awards='[{\"credits\":100}]' where id=$1",
          [cid],
        ),
        /Practice|immutable/,
      );
      await assert.rejects(
        d.q(
          "update beta_fantasy.competitions set rules=jsonb_set(rules,'{synthetic}','false') where id=$1",
          [cid],
        ),
        /Practice|immutable/,
      );
      assert.equal(state.competitions.length, 1);
      assert.equal(
        state.cards.length,
        sportConfigurations[sport].slots.length + 1,
      );
      assert.ok(
        state.cards.every(
          (c: any) =>
            c.collectible_owned === false &&
            c.serial === null &&
            c.owner_id === u,
        ),
      );
      assert.equal(
        (
          await d.q(
            "select count(*)::int n from credits_sandbox.access where user_id=$1",
            [u],
          )
        )[0].n,
        0,
      );
      assert.equal(
        (
          await d.q(
            "select count(*)::int n from sports_feed.sport_sandbox_access where user_id=$1",
            [u],
          )
        )[0].n,
        0,
      );
      await d.q("select public_gameplay.name_team('PublicMember',$1)", [
        randomUUID(),
      ]);
      await d.pg.exec("set role docked_app");
      assert.equal(
        (await d.q("select public_gameplay.my_team_name() name"))[0].name,
        "PublicMember",
      );
      await d.pg.exec("reset role");
      const picks = sandboxRecommendation(state, cid).picks;
      const request = randomUUID();
      const command = (
        action: string,
        competition: string = cid,
        selections = picks,
        revision = 0,
        id = randomUUID(),
      ) =>
        d.q("select public_gameplay.command($1,$2,$3,$4) result", [
          sport,
          action,
          JSON.stringify({ competition_id: competition, selections, revision }),
          id,
        ]);
      await command("seven_draft");
      await command("seven_enter", cid, picks, 0, request);
      await command("seven_enter", cid, picks, 0, request);
      assert.equal((await read()).entries.length, 1);
      assert.equal(
        (await read()).entries[0].snapshot.length,
        sportConfigurations[sport].slots.length,
      );
      assert.equal(
        (
          await d.q(
            "select count(*)::int n from beta_fantasy.cards where owner_id=$1",
            [u],
          )
        )[0].n,
        0,
      );
      await assert.rejects(command("seven_enter", d.rounds.OPEN3));
      await assert.rejects(
        d.q("select public_gameplay.read_state('basketball')"),
      );
      await assert.rejects(
        d.q(
          "update public_gameplay.rounds set fixtures='[]' where competition_id=$1",
          [cid],
        ),
      );
      await d.q("update public.profiles set age_attested=false where id=$1", [
        u,
      ]);
      await assert.rejects(read(), /adult account/);
      await assert.rejects(
        d.q("select public_gameplay.my_team_name()"),
        /adult account/,
      );
      await d.q("update public.profiles set age_attested=true where id=$1", [
        u,
      ]);
      await d.q("insert into private.roles(user_id,role)values($1,'admin')", [
        u,
      ]);
      await assert.rejects(read(), /adult account/);
      await d.q("delete from private.roles where user_id=$1", [u]);
      await d.q(
        "update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1",
        [sid],
      );
      await assert.rejects(read(), /adult account/);
      // Runtime cannot read the private tables directly or bind extra competitions.
      await d.pg.exec("set role docked_app");
      await assert.rejects(
        d.q("select * from public_gameplay.policy"),
        /permission denied/,
      );
      await d.pg.exec("reset role");
    } finally {
      await d.pg.close();
    }
  });
