import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { AdminRecord } from "../../src/core/admin-record";

test("administrative details execute real projection with private-field, role, session and history boundaries", async () => {
  const pg = new PGlite();
  const actor = "11111111-1111-4111-8111-111111111111";
  const memberId = "22222222-2222-4222-8222-222222222222";
  try {
    await pg.exec(`
      create role anon; create role authenticated; create role service_role; create role docked_app; create role docked_beta_app; create role docked_nfl_worker;
      create schema auth; create schema beta_public; create schema beta_private; create schema beta_fantasy; create schema credits_sandbox; create schema sports_feed;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      -- Isolated session adapter. Full session validation remains in existing auth/RLS suites.
      create function beta_private.active_member_session() returns boolean language sql as $$ select current_setting('fixture.active',true)='true' $$;
      create table beta_private.roles(user_id uuid,role text);
      insert into beta_private.roles values('${actor}','owner');
      create table beta_public.profiles(id uuid,created_at timestamptz,disabled_at timestamptz);
      create table beta_private.social_profiles(id text,user_id uuid,display_name text,handle text,status text);
      create table beta_private.admissions(id text,user_id uuid,status text,created_at timestamptz,accepted_at timestamptz,email text,token_digest text);
      create table beta_private.admission_events(id int,admission_id text,action text,created_at timestamptz,details jsonb);
      create table beta_private.social_moderation_events(id text,target_id text,target_type text,report_id text,decision text,created_at timestamptz,reason text);
      create table beta_private.social_reports(id text,target_type text,status text,reason text,created_at timestamptz);
      create table beta_fantasy.players(id text,name text,sport text,position text);
      create table beta_fantasy.editions(id text,player_id text,tier text,max_supply int,issued int);
      create table beta_fantasy.cards(id text,edition_id text,serial int,owner_id text,created_at timestamptz,tradeable boolean);
      create table beta_fantasy.ownership_events(id text,card_id text,from_user text,to_user text,reason text,reference text,created_at timestamptz,acquisition_price bigint);
      create table beta_fantasy.pack_definitions(id text,name text);
      create table beta_fantasy.packs(id text,definition_id text,user_id text,created_at timestamptz,opened_at timestamptz);
      create table beta_fantasy.pack_items(pack_id text,card_id text);
      create table beta_fantasy.competitions(id text,name text,sport text,season text,round int,rules jsonb,opens_at timestamptz,locks_at timestamptz,scored_at timestamptz,scoring_id text);
      create table beta_fantasy.entries(competition_id text,snapshot jsonb);
      create table beta_fantasy.results(competition_id text);
      create table sports_feed.weekly_core_packs(id text,user_id text,sport text,period int,policy text,due_at timestamptz,issued_at timestamptz,opened_at timestamptz,receipt jsonb);
      create table credits_sandbox.state(document jsonb);
      insert into beta_public.profiles values('${memberId}','2026-10-01',null);
      insert into beta_private.social_profiles values('profile','${memberId}','Fixture Member','fixture','restricted');
      insert into beta_private.admissions values('admission','${memberId}','accepted','2026-10-01','2026-10-02','private@email.test','secret-token');
      insert into beta_private.admission_events select n,'admission','accepted','2026-10-02'::timestamptz+n*interval '1 second','{"private":"secret-admission"}' from generate_series(1,45) n;
      insert into beta_private.social_moderation_events values('enforce','profile','profile','report','restrict','2026-10-03','secret-enforcement');
      insert into beta_private.social_reports values('report','profile','open','spam','2026-10-03');
      insert into beta_fantasy.players values('player','Fixture Player','nfl','QB');
      insert into beta_fantasy.editions values('edition','player','RARE',100,1);
      insert into beta_fantasy.cards values('legacy-card','edition',1,'member','2026-10-02',true);
      insert into beta_fantasy.ownership_events values('transfer','legacy-card',null,'member','issued','ref','2026-10-02',987654);
      insert into beta_fantasy.pack_definitions values('pack-definition','Starter Pack');
      insert into beta_fantasy.packs values('legacy-pack','pack-definition','member','2026-10-02',null);
      insert into beta_fantasy.pack_items values('legacy-pack','secret-unrevealed-card');
      insert into sports_feed.weekly_core_packs values('weekly','member','nfl',2,'weekly-core-nfl-v1','2026-10-14','2026-10-14',null,'{"secret":"secret-receipt"}');
      insert into beta_fantasy.competitions values('competition','Saved label','nfl','2026',3,'{"lineup_version":"v1","mode":"SALARY_CAP"}','2026-01-01','2099-01-01',null,'rules');
      insert into beta_fantasy.entries values('competition','{"private":"secret-lineup"}');
      grant usage on schema beta_private to docked_beta_app,anon,authenticated,service_role,docked_app,docked_nfl_worker;
      grant usage on schema credits_sandbox to docked_beta_app;
    `);
    await pg.exec(
      await readFile(
        "supabase/migrations/20261016214339_admin_record_details.sql",
        "utf8",
      ),
    );
    await pg.query("insert into credits_sandbox.state values($1)", [
      JSON.stringify({
        private: "secret-root",
        economy: {
          players: { p: { name: "Current Player" } },
          instances: {
            "current-card": {
              playerId: "p",
              rarity: "ICON",
              serial: 1,
              lifetimeCap: 1,
              definition: "current-edition",
              mintedAt: 1000,
            },
          },
          definitions: {
            "current-edition": { playerId: "p", rarity: "ICON", issued: 1 },
          },
          packs: {
            "current-pack": {
              member: "member",
              product: {
                name: "Premium Pack",
                cards: 9,
                priceCredits: 1800,
                version: "v1",
              },
              configurationHash: "hash",
              cards: ["secret-draw"],
              createdAt: 2000,
              openedAt: null,
            },
          },
          products: {
            configuration: {
              name: "Premium Pack",
              version: "v2",
              cards: 9,
              priceCredits: 1800,
              sport: "nfl",
              status: "TEST_ONLY",
              duplicatePlayers: "deny",
              exhaustion: "FAIL_ENTIRE_PACK",
              effectiveAt: 0,
              expiresAt: null,
            },
          },
        },
        commerce: { cards: { "current-card": { owner: "member" } } },
        cards: {
          "current-card": {
            history: Array.from({ length: 43 }, (_, n) => ({
              from: n ? "previous" : null,
              to: "member",
              reference: `ref${n}`,
              at: 1000 + n,
            })),
          },
        },
        journal: [
          {
            id: "journal",
            at: 3000,
            actor: "secret-actor",
            reason: "secret-reason",
            policy: "test-v1",
            lines: [
              { account: "issuer", credits: -100 },
              { account: "member:available", credits: 100 },
            ],
            hash: "secret-hash",
          },
        ],
      }),
    ]);
    await pg.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('fixture.active','true',false)",
      [actor, JSON.stringify({ aal: "aal2" })],
    );
    const detail = async (category: string, id: string, page = 1) =>
      (
        await pg.query<{ record: AdminRecord | null }>(
          "select beta_private.admin_record_detail($1,$2,$3) record",
          [
            category,
            category === "members" && id === "member" ? memberId : id,
            page,
          ],
        )
      ).rows[0].record;
    await pg.exec("set role docked_beta_app");
    await assert.rejects(
      pg.exec("select * from credits_sandbox.state"),
      /permission denied/,
    );
    const member = (await detail("members", "member"))!;
    assert.equal(member.fields["Admission status"], "accepted");
    assert.equal(member.fields["Social status"], "restricted");
    assert.equal(member.history.length, 20);
    assert.equal(member.hasMore, true);
    const second = (await detail("members", "member", 2))!;
    assert.ok(
      !member.history.some((a) => second.history.some((b) => a.id === b.id)),
    );
    assert.equal((await detail("members", "member", 3))!.hasMore, false);
    for (const [category, id] of [
      ["cards", "legacy-card"],
      ["cards", "current-card"],
      ["cards", "current-edition"],
      ["packs", "legacy-pack"],
      ["packs", "current-pack"],
      ["packs", "configuration"],
      ["packs", "weekly"],
      ["competitions", "competition"],
      ["moderation", "report"],
      ["transactions", "journal"],
    ]) {
      const record = await detail(category, id);
      assert.ok(record, `${category}/${id}`);
      assert.equal(record.id, id);
      assert.doesNotMatch(
        JSON.stringify(record),
        /secret-|987654|private@email/,
      );
    }
    assert.doesNotMatch(JSON.stringify(member), /secret-|private@email/);
    const competition = (await detail("competitions", "competition"))!;
    assert.equal(competition.title, "Traditional · 2026 · Week 3");
    assert.equal(competition.fields["Entry count"], 1);
    assert.equal(competition.fields["Scored at"], null);
    const journal = (await detail("transactions", "journal"))!;
    assert.equal(journal.fields["Journal line total"], 0);
    assert.equal(journal.history.length, 2);
    assert.equal((await detail("cards", "current-card", 3))!.history.length, 3);
    assert.equal(await detail("cards", "current"), null); // exact key, not substring
    assert.equal(await detail("cards", "' OR true --"), null);
    await pg.exec("reset role");
    for (const role of ["admin", "auditor", "analyst", "editor"]) {
      await pg.query("update beta_private.roles set role=$1", [role]);
      await pg.exec("set role docked_beta_app");
      await assert.rejects(
        detail("transactions", "journal"),
        /Category denied/,
      );
      assert.ok(await detail("competitions", "competition"));
      if (["editor", "analyst"].includes(role))
        await assert.rejects(detail("members", "member"), /Category denied/);
      else assert.ok(await detail("cards", "legacy-card"));
      await pg.exec("reset role");
    }
    await pg.exec("update beta_private.roles set role='member'");
    await assert.rejects(detail("competitions", "competition"), /Role denied/);
    await pg.exec("update beta_private.roles set role='owner'");
    for (const [aal, active] of [
      ["aal1", "true"],
      ["aal2", "false"],
    ]) {
      await pg.query(
        "select set_config('request.jwt.claims',$1,false),set_config('fixture.active',$2,false)",
        [JSON.stringify({ aal }), active],
      );
      await assert.rejects(detail("members", "member"), /Staff MFA required/);
    }
    await pg.exec(
      `select set_config('request.jwt.claims','{"aal":"aal2"}',false),set_config('fixture.active','true',false)`,
    );
    for (const page of [0, 101])
      await assert.rejects(detail("members", "member", page), /Invalid record/);
    for (const id of ["", "x".repeat(161), "bad\nvalue"])
      await assert.rejects(detail("members", id), /Invalid record/);
    for (const role of [
      "anon",
      "authenticated",
      "service_role",
      "docked_app",
      "docked_nfl_worker",
    ]) {
      await pg.exec(`set role ${role}`);
      await assert.rejects(detail("members", "member"), /permission denied/);
      await pg.exec("reset role");
    }
  } finally {
    await pg.close();
  }
});
