import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";

test("prize publication, overlap rejection, locked names, admin MFA and immutable audits", async () => {
  const url = process.env.PREMIUM_MEMBER_TEST_DB;
  if (url) {
    const target = new URL(url);
    assert.equal(target.hostname, "127.0.0.1");
    assert.match(target.pathname, /^\/docked_free_play_test_\d+$/);
  }
  const sql = url ? postgres(url, { max: 1, onnotice: () => {} }) : null;
  const racing = url ? postgres(url, { max: 6, onnotice: () => {} }) : null;
  const pg = sql
    ? {
        exec: async (text: string) => {
          await sql.unsafe(text);
        },
        query: async <T>(text: string, params: any[] = []) => ({
          rows: (await sql.unsafe(text, params)) as T[],
        }),
        close: async () => {
          await racing?.end();
          await sql.end();
        },
      }
    : new PGlite();
  const q = async (s: string, p: any[] = []) =>
    (await pg.query<any>(s, p)).rows;
  try {
    await pg.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`,
    );
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      try {
        await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
      } catch (error) {
        console.error(
          file,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }
    await pg.exec(
      `create or replace function beta_fantasy.production_eligible() returns uuid language sql as $$select auth.uid()$$;create or replace function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$;update sports_feed.nfl_control set enabled=true;`,
    );
    const owner = randomUUID(),
      member = randomUUID();
    for (const u of [owner, member])
      await q(
        "insert into auth.users(id,email_confirmed_at) values($1,now())",
        [u],
      );
    await q("insert into beta_private.roles(user_id,role) values($1,'owner')", [
      owner,
    ]);
    if (racing) {
      const concurrent = randomUUID();
      await q(
        "insert into auth.users(id,email_confirmed_at) values($1,now())",
        [concurrent],
      );
      const saves = await Promise.allSettled(
        Array.from({ length: 6 }, (_, i) =>
          racing.begin(async (tx) => {
            await tx`set local role docked_beta_app`;
            await tx`select set_config('request.jwt.claim.sub',${concurrent},true)`;
            return tx`select beta_fantasy.name_team(${`Concurrent ${i}`},${randomUUID()}::uuid)`;
          }),
        ),
      );
      assert.equal(
        saves.filter((r) => r.status === "fulfilled").length,
        1,
        "exactly one concurrent first name wins",
      );
      assert.equal(
        (
          await q(
            "select count(*)::int n from beta_fantasy.team_names where user_id=$1",
            [concurrent],
          )
        )[0].n,
        1,
      );
    }
    const actor = async (u: string, aal = "aal1") => {
      await q(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
        [u, JSON.stringify({ sub: u, aal })],
      );
    };
    await actor(member);
    const request = randomUUID();
    await q("select beta_fantasy.name_team('Permanent Club',$1)", [request]);
    await q("select beta_fantasy.name_team('Permanent Club',$1)", [request]);
    await assert.rejects(
      () => q("select beta_fantasy.name_team('Other Club',$1)", [randomUUID()]),
      /permanent/,
    );
    await assert.rejects(
      () =>
        q(
          "update beta_fantasy.team_names set name='Bypassed' where user_id=$1",
          [member],
        ),
      /Administrator MFA/,
    );
    await assert.rejects(
      () =>
        q(
          "select beta_fantasy.admin_name_team($1,'Other Club','Permanent Club','Member attempt')",
          [member],
        ),
      /Administrator MFA/,
    );
    await actor(owner);
    await assert.rejects(
      () => q("select beta_fantasy.admin_prizes()"),
      /Administrator MFA/,
    );
    await actor(owner, "aal2");
    await q(
      "select beta_fantasy.admin_name_team($1,'Corrected Club','Permanent Club','Requested correction')",
      [member],
    );
    assert.equal(
      (
        await q("select name from beta_fantasy.team_names where user_id=$1", [
          member,
        ])
      )[0].name,
      "Corrected Club",
    );
    const audit = (
      await q(
        "select details from beta_private.audit_events where action='team_name_admin_changed'",
      )
    )[0].details;
    assert.deepEqual(audit, {
      previous: "Permanent Club",
      resulting: "Corrected Club",
      reason: "Requested correction",
    });
    await assert.rejects(
      () =>
        q(
          "select beta_fantasy.admin_name_team($1,'Race','Permanent Club','Stale')",
          [member],
        ),
      /refresh/,
    );
    const cid = randomUUID();
    await q(
      `insert into beta_fantasy.competitions(id,name,sport,season,round,locks_at,rules,scoring_id) values($1,'Local prize fixture','football','2026',6,now()+interval '1 day','{"mode":"SALARY_CAP"}',(select id from beta_fantasy.scoring_rules limit 1))`,
      [cid],
    );
    const items = [
      {
        from: 1,
        to: 3,
        description: "Isolated test reward",
        type: "credits",
        amount: 50,
      },
    ];
    const save = (
      content: any,
      publish = false,
      revision = 0,
      scope = "weekly",
    ) =>
      q(
        "select beta_fantasy.save_prize_schedule($1,$2,$3::text::jsonb,$4,$5,$6) value",
        [
          cid,
          scope,
          JSON.stringify(content),
          publish,
          revision,
          "Isolated test",
        ],
      );
    await save(items);
    assert.deepEqual(
      (await q("select beta_fantasy.member_prizes() value"))[0].value,
      [],
    );
    await assert.rejects(
      () => save([...items, { ...items[0], from: 3, to: 4 }], true, 1),
      /overlapping/,
    );
    await assert.rejects(
      () => save([{ ...items[0], amount: -1 }], true, 1),
      /Invalid/,
    );
    await assert.rejects(
      () => save([{ ...items[0], amount: null }], true, 1),
      /Invalid/,
    );
    await assert.rejects(() => save(items, true, 0), /refresh/);
    await save(items, true, 1);
    assert.equal(
      (await q("select beta_fantasy.member_prizes() value"))[0].value.length,
      1,
    );
    await save([{ ...items[0], amount: 75 }], false, 2);
    assert.equal(
      (await q("select beta_fantasy.member_prizes() value"))[0].value[0]
        .items[0].amount,
      50,
      "editing draft preserves published version",
    );
    await save(items, true, 0, "season");
    const before = (
      await q("select count(*)::int n from beta_fantasy.cards")
    )[0].n;
    await actor(member);
    await assert.rejects(() => save(items, true, 3), /Administrator MFA/);
    await pg.exec("set role authenticated");
    await assert.rejects(
      () => q("select beta_fantasy.admin_prizes()"),
      /permission denied/,
    );
    await assert.rejects(
      () => q("update beta_fantasy.team_names set name='Direct API'"),
      /permission denied/,
    );
    await assert.rejects(
      () => q("update beta_fantasy.prize_schedules set published='[]'"),
      /permission denied/,
    );
    await pg.exec("reset role");
    assert.equal(
      (await q("select count(*)::int n from beta_fantasy.cards"))[0].n,
      before,
    );
    await actor(owner, "aal2");
    assert.equal(
      (await q("select beta_fantasy.admin_prizes() value"))[0].value.schedules
        .length,
      2,
    );
    const migration = await readFile(
      "supabase/migrations/20261018234525_premium_member_release.sql",
      "utf8",
    );
    await pg.exec(migration);
    assert.equal(
      (
        await q("select name from beta_fantasy.team_names where user_id=$1", [
          member,
        ])
      )[0].name,
      "Corrected Club",
    );
    assert.equal(
      (await q("select count(*)::int n from sports_feed.weekly_core_packs"))[0]
        .n,
      0,
      "repeated install never activates",
    );
  } finally {
    await pg.close();
  }
});
