import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { marketplaceFixture } from "../fixtures/marketplace-state";
import { executeCredits } from "../../src/core/credits-sandbox";
import { contextualCompetitionName } from "../../src/core/competition-display";
test("owner reporting: actual pack sources, date boundaries, private aggregates and MFA guard", async () => {
  const pg = new PGlite();
  const q = async (s: string, p: unknown[] = []) =>
    (await pg.query<any>(s, p)).rows;
  try {
    await pg.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
    // Isolated session/admission/owner designation plumbing; reporting's actual
    // role and AAL checks remain intact. Full auth/RLS tests cover these adapters.
    await pg.exec(
      `create or replace function beta_private.active_member_session() returns boolean language sql as $$select auth.uid() is not null$$;create or replace function beta_private.owner_gameplay_identity(p_user uuid) returns boolean language sql as $$select p_user is not null$$;create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select exists(select 1 from beta_private.admissions a where a.user_id=p_user and a.status='accepted')$$;`,
    );
    const owner = randomUUID(),
      member = randomUUID(),
      staff = randomUUID(),
      suspended = randomUUID(),
      notAdmitted = randomUUID();
    for (const u of [owner, member, staff, suspended, notAdmitted]) {
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
        "insert into beta_public.profiles(id,country,state,age_attested,accepted_version) values($1,'AU','NSW',true,'fixture')",
        [u],
      );
    }
    await q("insert into beta_private.roles(user_id,role) values($1,'owner')", [
      owner,
    ]);
    await q(
      "insert into beta_private.roles(user_id,role) values($1,'editor')",
      [staff],
    );
    await q(
      "update beta_public.profiles set disabled_at=clock_timestamp() where id=$1",
      [suspended],
    );
    await q(
      "update beta_private.admissions set status='revoked' where user_id=$1",
      [notAdmitted],
    );
    const set = async (u: string, aal: string) => {
      await q(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
        [u, JSON.stringify({ sub: u, aal })],
      );
    };
    const report = async (sport: string | null = null, includeStaff = false) =>
      (
        await q(
          "select beta_private.owner_command_centre('2026-10-01T14:00:00Z','2026-10-03T14:00:00Z',$1,$2) value",
          [sport, includeStaff],
        )
      )[0].value;
    await set(member, "aal2");
    await assert.rejects(report(), /Owner MFA/);
    await set(owner, "aal1");
    await assert.rejects(report(), /Owner MFA/);
    await set(owner, "aal2");
    const initial = await report();
    assert.equal(initial.centre.packsOpened, 0);
    assert.equal(initial.centre.daily.length, 2);
    assert.equal(initial.centre.weeklyEnabled, false);
    assert.ok(initial.centre.daily.every((d: any) => d.packs === 0));
    const competitionId = randomUUID();
    await q(
      `insert into beta_fantasy.competitions(id,name,sport,season,round,opens_at,locks_at,rules,scoring_id,prize)
       select $1,'Salary Cap saved label',sport,'2026',987,'2026-10-01T14:00:00Z','2026-10-02T14:00:00Z',
       '{"mode":"SALARY_CAP","lineup_version":"isolated-display-fixture"}',scoring_id,prize
       from beta_fantasy.competitions limit 1`,
      [competitionId],
    );
    const competition = (await report()).competitions.find(
      (c: any) => c.id === competitionId,
    );
    assert.equal(
      contextualCompetitionName(competition.name, competition.display),
      "Traditional · 2026 · Week 987",
    );
    assert.equal(
      (
        await q("select name from beta_fantasy.competitions where id=$1", [
          competitionId,
        ])
      )[0].name,
      "Salary Cap saved label",
      "report projection never renames historical records",
    );
    // Insert a sealed reward using actual immutable schema; reporting must not enrol or open it.
    await q(
      "insert into sports_feed.weekly_core_schedules(user_id,enrolled_at) values($1,'2026-10-01T15:00:00Z')",
      [member],
    );
    await q(
      "insert into sports_feed.weekly_core_packs(user_id,period,due_at,issued_at) values($1,0,'2026-10-01T15:00:00Z','2026-10-01T15:00:00Z')",
      [member],
    );
    assert.equal((await report()).centre.packsOpened, 0);
    // Actual current economy shape and authoritative domain commands, in this isolated DB only.
    const start = Date.parse("2026-10-01T14:00:00Z"),
      end = Date.parse("2026-10-03T14:00:00Z");
    let state = marketplaceFixture(
      start,
      [owner, member, staff, suspended, notAdmitted].map((id) => ({
        id,
        role: "member" as const,
      })),
    );
    for (const [key, opened] of [
      ["end-before", end - 1],
      ["end-exact", end],
      ["sealed", null],
    ] as const) {
      state = executeCredits(
        state,
        { id: member, role: "member" },
        key,
        {
          kind: "buy-pack",
          product: "standard-nine-seven-test-v2",
          configuration: "standard-nine-seven-test-v2",
          policy: state.policy.version,
          confirmed: true,
        },
        start,
      ).state;
      if (opened !== null)
        state = executeCredits(
          state,
          { id: member, role: "member" },
          key + "-open",
          { kind: "open-pack", entitlement: key },
          opened,
        ).state;
    }
    await q("insert into credits_sandbox.state values(true,0,$1)", [state]);
    for (const product of Object.values(state.economy!.products))
      await q("insert into credits_sandbox.pack_configuration values($1,$2)", [
        product.version,
        product,
      ]);
    assert.equal(
      (await report("nfl")).centre.packsOpened,
      2,
      "start inclusive/end exclusive; sealed and nonmember/staff excluded",
    );
    assert.equal(
      (await report("nfl", true)).centre.packsOpened,
      4,
      "owner and editor activity included only on explicit staff filter",
    );
    assert.equal(
      (await report()).metrics.admitted,
      1,
      "disabled, revoked and staff are not active admitted members",
    );
    assert.equal((await report(null, true)).metrics.admitted, 3);
    assert.equal(
      (await report("football")).centre.packsOpened,
      0,
      "NFL packs cannot become EPL activity",
    );
    await q(
      "update sports_feed.weekly_core_packs set opened_at='2026-10-02T15:00:00Z',receipt=$2 where user_id=$1",
      [member, { fixture: true }],
    );
    await q(
      "insert into sports_feed.weekly_core_schedules(user_id,enrolled_at) values($1,'2026-10-01T15:00:00Z')",
      [owner],
    );
    await q(
      "insert into sports_feed.weekly_core_packs(user_id,period,due_at,issued_at,opened_at,receipt) values($1,0,'2026-10-01T15:00:00Z','2026-10-01T15:00:00Z','2026-10-02T15:00:00Z',$2)",
      [owner, { fixture: true }],
    );
    await q(
      "insert into beta_fantasy.members(user_id,expires_at) values($1,'infinity')",
      [member],
    );
    const legacy = (
      await q(
        "insert into beta_fantasy.pack_definitions(name,slots,pool,weights,price,max_quantity,tradeable) values('Isolated legacy report fixture','[{}]',$1,'{}',0,10,false) returning id",
        [[randomUUID()]],
      )
    )[0].id;
    await q(
      "insert into beta_fantasy.packs(user_id,definition_id,request_id,opened_at) values($1,$2,$3,'2026-10-02T15:00:00Z')",
      [member, legacy, randomUUID()],
    );
    const all = await report(),
      nflReport = await report("nfl");
    assert.equal(
      all.centre.packsOpened,
      4,
      "legacy + current economy + weekly packs counted once",
    );
    assert.equal(
      all.metrics.packsOpened,
      4,
      "legacy/export summary agrees with current centre",
    );
    assert.equal(
      nflReport.centre.packsOpened,
      3,
      "unknown-sport legacy pack is not guessed NFL",
    );
    assert.equal((await report(null, true)).centre.packsOpened, 7);
    assert.equal(all.centre.activeMembers, 1);
    assert.deepEqual(
      all.centre.daily.map((d: any) => [d.day, d.packs]),
      [
        ["2026-10-02", 1],
        ["2026-10-03", 3],
      ],
    );
    assert.equal(
      all.centre.daily.reduce((sum: number, d: any) => sum + d.packs, 0),
      all.centre.packsOpened,
    );
    for (const u of [member, owner, staff])
      await q(
        "insert into credits_sandbox.pack_failures(member,request,product,category,recorded_at) values($1,$2,'standard-nine-seven-test-v2','SUPPLY','2026-10-02T15:00:00Z')",
        [u, randomUUID()],
      );
    assert.equal((await report("nfl")).centre.packFailures.length, 1);
    assert.equal((await report("nfl", true)).centre.packFailures.length, 3);
    assert.equal(
      (await report("football", true)).centre.packFailures.length,
      0,
    );
    const permission = (
      await q(
        "select has_function_privilege('authenticated','beta_private.owner_command_centre(timestamptz,timestamptz,text,boolean)','execute') member,has_function_privilege('anon','beta_private.owner_command_centre(timestamptz,timestamptz,text,boolean)','execute') anon,has_function_privilege('docked_beta_app','beta_private.owner_command_centre(timestamptz,timestamptz,text,boolean)','execute') app",
      )
    )[0];
    assert.deepEqual(permission, { member: false, anon: false, app: true });
    await assert.rejects(
      q(
        "select beta_private.owner_command_centre('2026-10-02','2026-10-01',null,false)",
      ),
      /Invalid reporting range/,
    );
    assert.equal(
      (
        await q(
          "select count(*)::int n from sports_feed.weekly_core_packs where opened_at is not null",
        )
      )[0].n,
      2,
      "reporting never adds an opening",
    );
    assert.equal(
      (await q("select count(*)::int n from credits_sandbox.lines"))[0].n,
      0,
    );
  } finally {
    await pg.close();
  }
});
