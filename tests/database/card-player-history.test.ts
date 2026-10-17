import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { rulesets } from "../../src/core/scoring-v1";
test("card history SQL: admitted only, no ownership/entry leaks, current revisions and review holds", async () => {
  const pg = new PGlite(),
    q = async (s: string, a: unknown[] = []) =>
      (await pg.query<any>(s, a)).rows;
  try {
    await pg.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile("supabase/migrations/" + f, "utf8"));
    // Only admission transport is isolated; the actual history function/grants and scoring tables are exercised.
    await pg.exec(
      `create or replace function beta_fantasy.production_eligible() returns uuid language sql as $$select auth.uid()$$;create or replace function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null and current_setting('test.session',true)='active'$$;`,
    );
    const viewer = randomUUID(),
      player = randomUUID(),
      competition = randomUUID(),
      stream = "beta-real:card-history";
    await q(
      `insert into beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season)values($1,'Local Player','nfl','TE','ARI','#990033',1,'2026')`,
      [player],
    );
    const edition = randomUUID(),
      canonical = "nfl:verified-local-player";
    await q(
      `insert into beta_fantasy.editions(id,player_id,tier,season,kind,max_supply,status)values($1,$2,'CORE','2026','regular',11,'launched')`,
      [edition, player],
    );
    const raw = (
      await q(
        `insert into sports_feed.raw_revisions(provider,resource,body_hash,body,observed_at,rights_evidence,expires_at)values('nflverse','local-roster','hash','{}',clock_timestamp(),'isolated fixture',clock_timestamp()+interval '1 day') returning id`,
      )
    )[0].id;
    await q(
      `insert into sports_feed.nfl_players values($1,'local-verified-provider-id',$2,'ARI','ACT',$3,clock_timestamp(),'ARI')`,
      [player, edition, raw],
    );
    await q(
      `insert into credits_sandbox.permanent_players values($1,'nfl','nflverse','local-verified-provider-id','player','{}')`,
      [canonical],
    );
    await q(
      `insert into beta_fantasy.scoring_rules(version,rules) values('local-card-history',$1)`,
      [JSON.stringify(rulesets.nfl)],
    );
    await q(
      `insert into beta_fantasy.competitions(id,name,sport,season,round,opens_at,locks_at,rules,scoring_id,prize) values($1,'Local history','nfl','2026',1,'2026-01-01','2026-01-02','{}',(select id from beta_fantasy.scoring_rules where version='local-card-history'),'No cash prize')`,
      [competition],
    );
    await q(`insert into sports_feed.streams(id)values($1)`, [stream]);
    const fixture = {
      id: "authoritative-fixture",
      playerIds: [player],
      scheduledAt: "2026-01-02T00:00:00Z",
    };
    await q(
      `insert into sports_feed.nfl_rounds(competition_id,stream_id,purpose,fixtures)values($1,$2,'member',$3)`,
      [competition, stream, JSON.stringify([fixture])],
    );
    await q(
      `insert into sports_feed.postgame_mapping(stream_id,fixture_id,mapping_hash,mapping,actor)values($1,$2,'verified-game-map','{"gameId":"2026_01_LOCAL_GAME"}','local-test')`,
      [stream, fixture.id],
    );
    const state = {
      scope: "authorised-free-beta",
      period: { rules: rulesets.nfl, fixtures: [fixture] },
      entries: [{ member: "private-member", cards: ["private-card"] }],
      sources: [
        {
          fixtureId: fixture.id,
          revision: 1,
          status: "completed",
          observedAt: "2026-01-03T00:00:00Z",
          players: [
            { playerId: player, availability: "confirmed-dnp", stats: null },
            { playerId: "other-private", stats: { secret: 1 } },
          ],
        },
      ],
      finalisedAt: "2026-01-04T00:00:00Z",
    };
    await q(
      `insert into sports_feed.journal(stream_id,revision,previous_hash,state_hash,body,calculated) values($1,1,'before','one',$2,'{"rows":[{"member":"private-member"}]}')`,
      [stream, JSON.stringify(state)],
    );
    const load = async () =>
      (
        await q(`select sports_feed.card_player_history($1) records`, [player])
      )[0].records;
    await assert.rejects(load, /Active admitted/);
    await q(
      `select set_config('request.jwt.claim.sub',$1,false),set_config('test.session','active',false)`,
      [viewer],
    );
    await pg.exec("set role docked_beta_app");
    let records = await load();
    assert.equal(records.length, 1);
    assert.equal(records[0].position, "TE");
    assert.equal(records[0].source.availability, "confirmed-dnp");
    assert.equal(records[0].fixture, "2026_01_LOCAL_GAME");
    const legacyBridge = (
      await q(`select sports_feed.card_player_history($1) records`, [canonical])
    )[0].records;
    assert.deepEqual(
      legacyBridge,
      records,
      "Canonical player retains published legacy Core history before any purchase",
    );
    assert.ok(!JSON.stringify(records).includes("private-member"));
    assert.ok(!JSON.stringify(records).includes("private-card"));
    assert.ok(!JSON.stringify(records).includes("other-private"));
    await assert.rejects(
      () => q("select * from sports_feed.journal"),
      /permission denied/,
    );
    await pg.exec("reset role");
    const corrected = structuredClone(state);
    corrected.sources[0].revision = 2;
    corrected.sources[0].observedAt = "2026-01-05T00:00:00Z";
    await q(
      `insert into sports_feed.journal(stream_id,revision,previous_hash,state_hash,body,calculated) values($1,2,'one','two',$2,'{}')`,
      [stream, JSON.stringify(corrected)],
    );
    records = await load();
    assert.equal(records[0].revision, 2);
    await q(
      `insert into beta_fantasy.round_controls(competition_id,standings_visible) values($1,false)`,
      [competition],
    );
    records = await load();
    assert.equal(records[0].visible, false);
    assert.equal(records[0].source, null);
    await q(`select set_config('test.session','expired',false)`);
    await assert.rejects(load, /Active admitted/);
    for (const role of ["anon", "authenticated", "service_role", "docked_app"])
      assert.equal(
        (
          await q(
            `select has_function_privilege($1,'sports_feed.card_player_history(text)','EXECUTE') allowed`,
            [role],
          )
        )[0].allowed,
        false,
      );
    assert.equal(
      (await q("select count(*)::int n from beta_fantasy.entries"))[0].n,
      0,
    );
    assert.equal(
      (
        await q(
          `select body from sports_feed.journal where stream_id=$1 and revision=1`,
          [stream],
        )
      )[0].body.entries[0].member,
      "private-member",
    );
  } finally {
    await pg.close();
  }
});
