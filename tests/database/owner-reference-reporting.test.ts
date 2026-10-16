import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("owner reference SQL: independent registration totals, Sydney boundaries, role denial and redacted activity", async () => {
  const pg = new PGlite();
  const q = async (sql: string, args: unknown[] = []) =>
    (await pg.query<any>(sql, args)).rows;
  try {
    await pg.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`,
    );
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    // Local authentication adapter only. The real report's role and AAL checks
    // are exercised below, alongside existing full session/RLS regression suites.
    await pg.exec(
      `create or replace function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$;create or replace function beta_private.owner_gameplay_identity(p_user uuid) returns boolean language sql as $$select p_user is not null$$;create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select exists(select 1 from beta_private.admissions where user_id=p_user and status='accepted')$$;`,
    );
    const owner = randomUUID(),
      before = randomUUID(),
      atStart = randomUUID(),
      after = randomUUID(),
      atEnd = randomUUID();
    const dates = [
      "2026-10-01T10:00:00Z",
      "2026-10-01T13:59:59Z",
      "2026-10-01T14:00:00Z",
      "2026-10-02T14:00:00Z",
      "2026-10-03T14:00:00Z",
    ];
    for (const [i, id] of [owner, before, atStart, after, atEnd].entries()) {
      await q(
        "insert into auth.users(id,email_confirmed_at) values($1,clock_timestamp())",
        [id],
      );
      await q(
        "insert into beta_private.admissions(email,user_id,token_digest,request_id,expires_at) values($1,$2,md5(($2::uuid)::text)||md5(($2::uuid)::text),gen_random_uuid(),clock_timestamp()+interval '1 day')",
        [id + "@fixture.invalid", id],
      );
      await q(
        `update beta_private.admissions set status='accepted',accepted_at=clock_timestamp(),country='AU',state='NSW',age_attested=true,policy_digest=repeat('a',64),policy_versions='{"terms":"fixture"}' where user_id=$1`,
        [id],
      );
      await q(
        "insert into beta_public.profiles(id,country,state,age_attested,accepted_version,created_at) values($1,'AU','NSW',true,'fixture',$2)",
        [id, dates[i]],
      );
    }
    await q("insert into beta_private.roles(user_id,role) values($1,'owner')", [
      owner,
    ]);
    const set = async (id: string, aal: string) =>
      q(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
        [id, JSON.stringify({ sub: id, aal })],
      );
    const report = async (staff = false) =>
      (
        await q(
          "select beta_private.owner_reference_reporting('2026-10-01T14:00:00Z','2026-10-03T14:00:00Z',null,$1) value",
          [staff],
        )
      )[0].value;
    await set(owner, "aal1");
    await assert.rejects(report(), /Owner MFA/);
    await set(before, "aal2");
    await assert.rejects(report(), /Owner MFA/);
    await set(owner, "aal2");
    await pg.exec(
      "create or replace function beta_private.active_member_session() returns boolean language sql as $$select null::boolean$$",
    );
    await assert.rejects(
      report(),
      /Owner MFA/,
      "unknown session status fails closed",
    );
    await pg.exec(
      "create or replace function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$",
    );
    const result = await report();
    assert.equal(result.usersCurrent, 3);
    assert.equal(result.usersPrevious, 1);
    assert.equal(result.newUsersCurrent, 2);
    assert.equal(result.newUsersPrevious, 1);
    assert.deepEqual(result.registrations, [
      { day: "2026-10-02", registrations: 1, cumulative: 2 },
      { day: "2026-10-03", registrations: 1, cumulative: 3 },
    ]);
    const [independent] = await q(
      "select count(*)::int n from beta_public.profiles where created_at>='2026-10-01T14:00:00Z' and created_at<'2026-10-03T14:00:00Z' and id<>$1",
      [owner],
    );
    assert.equal(result.newUsersCurrent, independent.n);
    assert.equal((await report(true)).usersCurrent, 4);
    assert.equal(result.circulationCurrent, 0);
    assert.equal(result.circulationPrevious, 0);
    // Actual issued rows, not edition capacity, determine circulation. The normal
    // immutable card/supply trigger remains enabled for these local fixtures.
    await q(
      "insert into beta_fantasy.members(user_id,expires_at) values($1,'infinity')",
      [before],
    );
    const player = (
      await q(
        "insert into beta_fantasy.players(name,sport,position,team,colour,shirt,first_season) values('Reporting Fixture','football','GK','Fixture','#112233',1,'2026') returning id",
      )
    )[0].id;
    const edition = (
      await q(
        "insert into beta_fantasy.editions(player_id,tier,season,kind,max_supply,status,launch_at) values($1,'CORE','2026','regular',10000,'launched','2026-01-01') returning id",
        [player],
      )
    )[0].id;
    for (const [index, at] of [
      "2026-10-01T13:59:59Z",
      "2026-10-02T14:00:00Z",
    ].entries())
      await q(
        "insert into beta_fantasy.cards(edition_id,serial,owner_id,tradeable,created_at) values($1,$2,$3,false,$4)",
        [edition, index + 1, before, at],
      );
    const issued = await report();
    assert.equal(issued.circulationCurrent, 2);
    assert.equal(issued.circulationPrevious, 1);
    assert.equal(
      (
        await q(
          "select beta_private.owner_reference_reporting('2026-10-01T14:00:00Z','2026-10-03T14:00:00Z','nfl',false) value",
        )
      )[0].value.circulationCurrent,
      0,
    );
    assert.equal(
      (
        await q(
          "select count(*)::int n from beta_fantasy.cards where created_at<'2026-10-03T14:00:00Z'",
        )
      )[0].n,
      issued.circulationCurrent,
    );
    assert.ok(
      result.recent.every(
        (r: any) => !("email" in r) && !("actor" in r) && !("details" in r),
      ),
    );
    assert.equal(JSON.stringify(result).includes("@fixture.invalid"), false);
    assert.deepEqual(result.moderation, {
      content: 0,
      members: 0,
      listings: null,
    });
    const permission = (
      await q(
        "select has_function_privilege('anon','beta_private.owner_reference_reporting(timestamptz,timestamptz,text,boolean)','execute') anon,has_function_privilege('authenticated','beta_private.owner_reference_reporting(timestamptz,timestamptz,text,boolean)','execute') member,has_function_privilege('docked_beta_app','beta_private.owner_reference_reporting(timestamptz,timestamptz,text,boolean)','execute') app",
      )
    )[0];
    assert.deepEqual(permission, { anon: false, member: false, app: true });
    await assert.rejects(
      q(
        "select beta_private.owner_reference_reporting('2026-10-03','2026-10-01',null,false)",
      ),
      /Invalid reporting range/,
    );
    const counts = (
      await q(
        "select (select count(*) from credits_sandbox.lines)::int ledger,(select count(*) from sports_feed.weekly_core_packs)::int rewards",
      )
    )[0];
    assert.deepEqual(counts, { ledger: 0, rewards: 0 });
  } finally {
    await pg.close();
  }
});
