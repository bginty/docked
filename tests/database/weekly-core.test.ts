import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";

test("weekly Core SQL: admission, enrolment, catch-up, atomic opening, privacy and immutable receipts", async () => {
  const url = process.env.WEEKLY_CORE_TEST_DB;
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
        query: async <T>(text: string, args: unknown[] = []) => ({
          rows: (await sql.unsafe(text, args as any[])) as T[],
        }),
        close: async () => {
          await racing?.end();
          await sql.end();
        },
      }
    : new PGlite();
  const q = async (sql: string, args: unknown[] = []) =>
    (await pg.query<any>(sql, args)).rows;
  try {
    await pg.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
    // Only identity plumbing is stubbed in this disposable PostgreSQL runtime.
    await pg.exec(
      `create or replace function beta_fantasy.production_eligible() returns uuid language sql as $$select auth.uid()$$;create or replace function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$;create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null and banned_until is null)$$;update sports_feed.nfl_control set enabled=true;`,
    );
    const users = Array.from({ length: 4 }, () => randomUUID());
    for (const u of users) {
      await q(
        "insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp())",
        [u],
      );
      await q(
        "insert into beta_private.admissions(email,user_id,token_digest,request_id,expires_at) values($1,$2,md5(($2::uuid)::text)||md5(($2::uuid)::text),gen_random_uuid(),clock_timestamp()+interval '1 day')",
        [u + "@fixture.invalid", u],
      );
      await q(
        `update beta_private.admissions set status='accepted',accepted_at=clock_timestamp(),country='AU',state='NSW',age_attested=true,policy_digest=repeat('a',64),policy_versions='{"terms":"fixture"}' where user_id=$1`,
        [u],
      );
      await q(
        "insert into beta_public.profiles(id,country,state,age_attested,accepted_version)values($1,'AU','NSW',true,'fixture')",
        [u],
      );
      await q(
        "insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note)values($1,'tester','Synthetic weekly QA',true,'Isolated fixture')",
        [u],
      );
    }
    const read = async (u: string) => {
      await q("select set_config('request.jwt.claim.sub',$1,false)", [u]);
      return (await q("select sports_feed.my_weekly_core() s"))[0].s;
    };
    assert.equal((await read(users[0])).enabled, false);
    assert.equal(
      (await q("select count(*)::int n from sports_feed.weekly_core_packs"))[0]
        .n,
      0,
      "migration is inert",
    );
    await pg.exec("update sports_feed.weekly_core_control set enabled=true");
    let first = await read(users[0]);
    assert.equal(first.packs.length, 1);
    assert.equal(
      Date.parse(first.nextIssueAt) - Date.parse(first.enrolledAt),
      604800000,
    );
    assert.equal(first.packs[0].receipt, null);
    for (let i = 0; i < 5; i++)
      assert.equal(
        (await read(users[0])).packs.length,
        1,
        "reconciliation is idempotent",
      );
    if (racing) {
      const reads = await Promise.all(
        Array.from({ length: 6 }, () =>
          racing.begin(async (tx) => {
            await tx`set local role docked_beta_app`;
            await tx`select set_config('request.jwt.claim.sub',${users[0]},true)`;
            return (await tx`select sports_feed.my_weekly_core() s`)[0].s;
          }),
        ),
      );
      assert.ok(
        reads.every(
          (r) => r.packs.length === 1 && r.packs[0].id === first.packs[0].id,
        ),
        "simultaneous member requests reconcile once",
      );
    }
    assert.equal(
      (await q("select count(*)::int n from beta_fantasy.cards"))[0].n,
      0,
      "entitlements do not mint",
    );
    await q(
      "insert into sports_feed.weekly_core_schedules(user_id,enrolled_at)values($1,clock_timestamp()-interval '22 days')",
      [users[1]],
    );
    const offline = await read(users[1]);
    assert.equal(
      offline.packs.length,
      4,
      "enrolment + three due periods, no pre-enrolment grants",
    );
    const jobCount = racing
      ? (
          await Promise.all(
            Array.from({ length: 6 }, () =>
              racing.begin(async (tx) => {
                await tx`set local role docked_nfl_worker`;
                return Number(
                  (await tx`select sports_feed.weekly_core_job() n`)[0].n,
                );
              }),
            ),
          )
        ).reduce((a, b) => a + b, 0)
      : (await q("select sports_feed.weekly_core_job() n"))[0].n;
    assert.equal(jobCount, 2, "worker enrols the other eligible accounts once");
    assert.equal((await q("select sports_feed.weekly_core_job() n"))[0].n, 0);
    await q(
      "update credits_sandbox.access set enabled=false where user_id=$1",
      [users[3]],
    );
    assert.equal((await read(users[3])).enabled, false);
    await q(
      "update auth.users set banned_until=clock_timestamp()+interval '1 day' where id=$1",
      [users[2]],
    );
    assert.equal((await read(users[2])).enabled, false);
    await q("select set_config('request.jwt.claim.sub',$1,false)", [users[0]]);
    const raw = (
      await q(
        `insert into sports_feed.raw_revisions(provider,resource,body_hash,body,observed_at,rights_evidence,expires_at)values('synthetic','weekly','weekly','{}',clock_timestamp(),'isolated QA',clock_timestamp()+interval '1 day')returning id`,
      )
    )[0].id;
    let heldPlayer = "";
    for (const [i, pos] of ["QB", "RB", "WR", "TE", "K", "WR"].entries()) {
      const player = randomUUID(),
        edition = randomUUID();
      await q(
        "insert into beta_fantasy.players(id,name,sport,position,team,colour,shirt,first_season)values($1,$2,'nfl',$3,'TEST','#1677FF',1,'2026')",
        [player, `Synthetic weekly ${i}`, pos],
      );
      await q(
        "insert into beta_fantasy.editions(id,player_id,tier,season,kind,max_supply,status)values($1,$2,'CORE','2026','regular',1000000,'launched')",
        [edition, player],
      );
      await q(
        "insert into sports_feed.nfl_players values($1,$2,$3,'TEST','ACT',$4,clock_timestamp(),'TEST')",
        [player, `weekly-${i}`, edition, raw],
      );
      await q(
        "insert into nfl_roster.observations values($1,$2,'TEST',$3,$4,true,'https://www.nfl.com/',repeat('a',64),clock_timestamp(),'{}')",
        [
          player,
          `weekly-${i}`,
          pos,
          i === 5 ? "practice-squad" : i === 3 ? "reserve" : "active",
        ],
      );
      if (i === 3) heldPlayer = player;
    }
    await pg.exec("update nfl_roster.control set enabled=true");
    const pack = first.packs[0].id,
      request = randomUUID();
    const open = async (id = pack, key = request) =>
      (await q("select sports_feed.open_weekly_core($1,$2) r", [id, key]))[0].r;
    await assert.rejects(() => open(), /Four eligible Core players/);
    assert.equal(
      (await q("select count(*)::int n from beta_fantasy.cards"))[0].n,
      0,
      "incomplete official pool rolls all draws back",
    );
    assert.equal(
      (
        await q(
          "select receipt from sports_feed.weekly_core_packs where id=$1",
          [pack],
        )
      )[0].receipt,
      null,
    );
    await q(
      "insert into nfl_roster.observations values($1,'weekly-3','TEST','TE','active',true,'https://www.nfl.com/',repeat('b',64),clock_timestamp(),'{}')",
      [heldPlayer],
    );
    if (racing) {
      const opened = await Promise.all(
        Array.from({ length: 6 }, () =>
          racing.begin(async (tx) => {
            await tx`set local role docked_beta_app`;
            await tx`select set_config('request.jwt.claim.sub',${users[0]},true)`;
            return (
              await tx`select sports_feed.open_weekly_core(${pack},${request}) r`
            )[0].r;
          }),
        ),
      );
      assert.ok(
        opened.every((r) => JSON.stringify(r) === JSON.stringify(opened[0])),
        "concurrent opens return one receipt",
      );
    }
    const receipt = await open();
    assert.equal(receipt.cards.length, 4);
    assert.equal(new Set(receipt.cards.map((c: any) => c.player_id)).size, 4);
    assert.ok(
      receipt.cards.every(
        (c: any) =>
          c.tier === "CORE" &&
          ["QB", "RB", "WR", "TE"].includes(c.position) &&
          c.tradeable === false,
      ),
    );
    assert.deepEqual(await open(), receipt);
    assert.deepEqual(
      await open(pack, randomUUID()),
      receipt,
      "different request cannot reopen a pack",
    );
    first = await read(users[0]);
    assert.equal(
      Date.parse(first.nextIssueAt) - Date.parse(first.enrolledAt),
      604800000,
      "opening does not reset schedule",
    );
    assert.equal(
      (await q("select count(*)::int n from beta_fantasy.cards"))[0].n,
      4,
    );
    assert.equal(
      (await q("select count(*)::int n from beta_fantasy.ledger"))[0].n,
      0,
      "no wallet charge",
    );
    assert.equal(
      (await q("select count(*)::int n from sports_feed.nfl_allocations"))[0].n,
      0,
      "starter unchanged",
    );
    await read(users[1]);
    await assert.rejects(() => open(), /Pack unavailable/);
    assert.ok(!(await read(users[1])).packs.some((p: any) => p.id === pack));
    const ownedAgain = await open(offline.packs[0].id, randomUUID());
    const repeated = await open(offline.packs[1].id, randomUUID());
    assert.deepEqual(
      repeated.cards.map((c: any) => c.player_id).sort(),
      ownedAgain.cards.map((c: any) => c.player_id).sort(),
      "already-owned players remain eligible in later packs",
    );
    assert.deepEqual(
      ownedAgain.cards.map((c: any) => c.player_id).sort(),
      receipt.cards.map((c: any) => c.player_id).sort(),
      "same pool, no owned-player exclusion",
    );
    // Only three eligible players: any partial mints must roll back with the entire operation.
    await pg.exec(
      "update sports_feed.nfl_players set source_status='RET' where player_id=(select id from beta_fantasy.players where position='QB')",
    );
    const before = (
      await q("select count(*)::int n from beta_fantasy.cards")
    )[0].n;
    await assert.rejects(
      () => open(offline.packs[2].id, randomUUID()),
      /Four eligible Core/,
    );
    assert.equal(
      (await q("select count(*)::int n from beta_fantasy.cards"))[0].n,
      before,
    );
    assert.equal(
      (await read(users[1])).packs.find(
        (p: any) => p.id === offline.packs[2].id,
      ).openedAt,
      null,
    );
    await assert.rejects(
      () =>
        q(
          "update sports_feed.weekly_core_schedules set enrolled_at=clock_timestamp() where user_id=$1",
          [users[0]],
        ),
      /immutable/,
    );
    await assert.rejects(
      () =>
        q("update sports_feed.weekly_core_packs set receipt='{}' where id=$1", [
          pack,
        ]),
      /only open once/,
    );
    for (const role of ["anon", "authenticated", "docked_beta_app"]) {
      assert.equal(
        (
          await q(
            "select has_table_privilege($1,'sports_feed.weekly_core_packs','select') allowed",
            [role],
          )
        )[0].allowed,
        false,
      );
      assert.equal(
        (
          await q(
            "select has_function_privilege($1,'sports_feed.weekly_core_job()','execute') allowed",
            [role],
          )
        )[0].allowed,
        false,
      );
      assert.equal(
        (
          await q(
            "select has_function_privilege($1,'sports_feed.weekly_core_reconcile(uuid)','execute') allowed",
            [role],
          )
        )[0].allowed,
        false,
      );
    }
    assert.equal(
      (
        await q(
          "select has_function_privilege('docked_nfl_worker','sports_feed.weekly_core_job()','execute') allowed",
        )
      )[0].allowed,
      true,
    );
  } finally {
    await pg.close();
  }
});
