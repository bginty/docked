import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("admin search: actual migration, scoped grants, MFA/session denial, safe data and pagination", async () => {
  const pg = new PGlite();
  const actor = "11111111-1111-4111-8111-111111111111";
  try {
    await pg.exec(`create role anon;create role authenticated;create role service_role;create role docked_app;create role docked_beta_app;create role docked_nfl_worker;
      create schema auth;create schema beta_public;create schema beta_private;create schema beta_fantasy;create schema credits_sandbox;create schema sports_feed;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      -- Isolated session adapter; full auth/session policy is covered by existing database suites.
      create function beta_private.active_member_session() returns boolean language sql as $$select coalesce(current_setting('fixture.active',true),'')='true'$$;
      create table beta_private.roles(user_id uuid,role text);
      insert into beta_private.roles values('${actor}','owner');
      create table beta_public.profiles(id text,disabled_at timestamptz);
      create table beta_private.social_profiles(user_id text,display_name text,handle text);
      create table beta_fantasy.players(id text,name text,sport text,position text);
      create table beta_fantasy.editions(id text,player_id text,tier text);
      create table beta_fantasy.cards(id text,edition_id text,serial int);
      create table beta_fantasy.pack_definitions(id text,name text);
      create table beta_fantasy.packs(id text,definition_id text,opened_at timestamptz);
      create table beta_fantasy.competitions(id text,name text,sport text,season text,round int,rules jsonb default '{}');
      create table beta_private.social_reports(id text,target_type text,status text,reason text);
      create table sports_feed.weekly_core_packs(id text,opened_at timestamptz);
      create table credits_sandbox.state(document jsonb);
      insert into beta_public.profiles values('member-record',null);
      insert into beta_private.social_profiles values('member-record','Fixture Member','fixture');
      insert into beta_fantasy.players values('p','Fixture Player','nfl','QB');
      insert into beta_fantasy.editions values('e','p','RARE');
      insert into beta_fantasy.cards values('card-record','e',4);
      insert into beta_fantasy.pack_definitions values('d','Fixture Starter');
      insert into beta_fantasy.packs values('legacy-pack','d',null);
      insert into beta_fantasy.competitions values('comp','Fixture Competition','nfl','2026',2,'{}');
      insert into beta_private.social_reports values('case','profile','open','Fixture report');
      insert into sports_feed.weekly_core_packs values('weekly',null);
      grant usage on schema beta_private to docked_beta_app,anon,authenticated;
      grant usage on schema beta_fantasy to docked_beta_app;`);
    await pg.exec(
      await readFile(
        "supabase/migrations/20261016125231_admin_search_projection.sql",
        "utf8",
      ),
    );
    await pg.query("insert into credits_sandbox.state values($1)", [
      JSON.stringify({
        economy: {
          players: { p: { name: "Fixture Current", sport: "nfl" } },
          instances: {
            "current-card": { playerId: "p", rarity: "ICON", serial: 1 },
          },
          packs: {
            "current-pack": {
              product: { name: "Fixture Premium" },
              openedAt: 123,
            },
          },
        },
        journal: [
          {
            id: "fixture-ledger",
            policy: "fixture-test",
            actor: "secret actor",
            reason: "private reason",
            lines: [{ account: "secret account", credits: 9 }],
          },
        ],
        privateSecret: "must-never-leave",
      }),
    ]);
    await pg.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('fixture.active','true',false)",
      [actor, JSON.stringify({ sub: actor, aal: "aal2" })],
    );
    const search = async (q = "fixture", category = "all", page = 1) => {
      const rows = await pg.query<{
        value: {
          id: string;
          category: string;
          title: string;
          detail: string;
        }[];
      }>("select beta_private.admin_search($1,$2,$3) value", [
        q,
        category,
        page,
      ]);
      return rows.rows[0].value;
    };
    await pg.exec("set role docked_beta_app");
    await assert.rejects(
      pg.query("select * from beta_fantasy.cards"),
      /permission denied/,
    );
    const owner = await search();
    assert.equal(owner.length, 8);
    assert.equal(new Set(owner.map((item) => item.category)).size, 6);
    assert.ok(
      owner.find((item) => item.id === "current-card")?.detail.includes("ICON"),
    );
    assert.ok(
      owner
        .find((item) => item.id === "current-pack")
        ?.detail.includes("Opened"),
    );
    assert.doesNotMatch(
      JSON.stringify(owner),
      /private reason|secret actor|secret account|must-never-leave/,
    );
    assert.equal((await search("weekly"))[0].title, "Weekly Core Pack");
    assert.equal((await search("%")).length, 0);
    assert.equal((await search("' OR true --")).length, 0);
    for (const page of [0, 101])
      await assert.rejects(search("fixture", "all", page), /Invalid search/);
    await assert.rejects(search("x".repeat(121)), /Invalid search/);
    await pg.exec("reset role");
    for (const [role, categories] of [
      ["analyst", ["competitions"]],
      ["editor", ["competitions", "moderation"]],
      ["admin", ["members", "cards", "packs", "competitions", "moderation"]],
      ["auditor", ["members", "cards", "packs", "competitions", "moderation"]],
    ] as const) {
      await pg.query("update beta_private.roles set role=$1", [role]);
      await pg.exec("set role docked_beta_app");
      assert.deepEqual(
        [...new Set((await search()).map((r) => r.category))].sort(),
        [...categories].sort(),
      );
      await assert.rejects(
        search("fixture", "transactions"),
        /Category denied/,
      );
      await pg.exec("reset role");
    }
    await pg.query("update beta_private.roles set role='member'");
    await assert.rejects(search(), /Role denied/);
    await pg.query("update beta_private.roles set role='owner'");
    await pg.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ aal: "aal1" }),
    ]);
    await assert.rejects(search(), /Staff MFA required/);
    await pg.query(
      "select set_config('request.jwt.claims',$1,false),set_config('fixture.active','false',false)",
      [JSON.stringify({ aal: "aal2" })],
    );
    await assert.rejects(search(), /Staff MFA required/);
    await pg.exec("select set_config('fixture.active','true',false)");
    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`set role ${role}`);
      await assert.rejects(search(), /permission denied/);
      await pg.exec("reset role");
    }
    await pg.exec(
      `insert into beta_fantasy.competitions select 'c'||n,'Batch Competition '||n,'nfl','2026',n,'{}'::jsonb from generate_series(1,45) n`,
    );
    const first = await search("batch", "competitions", 1),
      second = await search("batch", "competitions", 2);
    assert.equal(first.length, 21);
    assert.equal(second.length, 21);
    assert.ok(
      !first.slice(0, 20).some((a) => second.some((b) => a.id === b.id)),
    );
    assert.deepEqual(await search("batch", "competitions", 1), first);
    await pg.exec(
      `update beta_fantasy.competitions set name='Saved Salary Cap',rules='{"mode":"SALARY_CAP","lineup_version":"v1"}' where id='comp'`,
    );
    assert.equal(
      (await search("Traditional"))[0].title,
      "Traditional · 2026 · Week 2",
    );
  } finally {
    await pg.close();
  }
});
