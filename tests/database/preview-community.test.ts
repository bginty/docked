import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { previewCommunityPolicyQuery } from "../../src/server/preview-community-query";

const user = "a0000000-0000-4000-8000-000000000001";
const other = "a0000000-0000-4000-8000-000000000002";
const session = "a0000000-0000-4000-8000-000000000011";
const otherSession = "a0000000-0000-4000-8000-000000000012";
const policy = "a0000000-0000-4000-8000-000000000021";
const grant = "a0000000-0000-4000-8000-000000000031";
const profile = "a0000000-0000-4000-8000-000000000041";
let pg: PGlite;

before(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await pg.exec(`insert into auth.users(id,email_confirmed_at) values('${user}',now()),('${other}',now());
    insert into auth.sessions values('${session}','${user}',null),('${otherSession}','${other}',null);
    insert into public.profiles(id,country,state,age_attested,accepted_version) values
     ('${user}','AU','NSW',true,'fixture'),('${other}','AU','NSW',true,'fixture');
    insert into private.region_policies(id,country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence,preview_community_only)
     values('${policy}','XX','DOCKED_PREVIEW','fixture',now()-interval '1 minute',now()+interval '1 day',now()+interval '1 day',true,18,
      array['community_social','public_profiles'],'PREVIEW TEST ONLY: isolated test fixture, no legal approval.',true);
    insert into private.preview_tester_access(id,user_id,policy_id,project_ref,expires_at,granted_by,reason)
     values('${grant}','${user}','${policy}','bckkllmndoxzpzdqrevb',now()+interval '1 hour','test-operator','Isolated local regression only');
    insert into private.social_profiles(id,user_id,handle,display_name) values('${profile}','${user}','preview_reader','Preview Reader');`);
  await claims();
});
after(async () => pg?.close());

async function claims(
  id = user,
  sid = session,
  project = "bckkllmndoxzpzdqrevb",
) {
  await pg.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('docked.hosted_preview_project',$3,false)",
    [
      id,
      JSON.stringify({
        sub: id,
        session_id: sid,
        aal: "aal1",
        user_metadata: { preview: true, role: "admin" },
      }),
      project,
    ],
  );
}
async function allowed(feature = "community_social", id = user) {
  return (
    await pg.query<{ allowed: boolean }>(
      "select private.community_feature_allowed($1,$2) as allowed",
      [id, feature],
    )
  ).rows[0].allowed;
}
async function transaction(fn: () => Promise<void>) {
  await pg.exec("begin");
  try {
    await fn();
  } finally {
    await pg.exec("rollback");
  }
}

test("preview grant allows exact account through the actual app query and SQL actor, not same-region peers", async () => {
  assert.equal(
    (
      await pg.query<{ policy: string }>(previewCommunityPolicyQuery, [
        user,
        "community_social",
      ])
    ).rows[0].policy,
    policy,
  );
  assert.equal(await allowed(), true);
  assert.equal(await allowed("public_profiles"), true);
  assert.equal(await allowed("community_social", other), false);
  assert.equal(
    (
      await pg.query<{ id: string }>(
        "select private.community_actor($1,'community_social',true) id",
        [user],
      )
    ).rows[0].id,
    profile,
  );
  await claims(other, otherSession);
  assert.equal(
    (await pg.query(previewCommunityPolicyQuery, [user, "community_social"]))
      .rows.length,
    0,
  );
  await assert.rejects(
    () =>
      pg.query("select private.community_actor($1,'community_social',true)", [
        other,
      ]),
    /restricted/,
  );
  await claims();
  await transaction(async () => {
    await pg.exec(
      `insert into private.social_posts(author_id,kind,body) select private.community_actor('${user}','community_social',true),'discussion','Preview account discussion fixture';`,
    );
    assert.equal(
      (
        await pg.query<{ n: number }>(
          "select count(*)::int n from private.social_posts where author_id=$1",
          [profile],
        )
      ).rows[0].n,
      1,
    );
  });
});

test("preview grant fails closed without exact trusted hosted context or live same-user session", async () => {
  for (const context of ["", "other-project", "preview", "true"]) {
    await claims(user, session, context);
    assert.equal(await allowed(), false);
    await assert.rejects(
      () =>
        pg.query(
          "select private.community_assert_access($1,'community_social')",
          [user],
        ),
      /restricted/,
    );
  }
  await claims(user, otherSession);
  assert.equal(
    (await pg.query(previewCommunityPolicyQuery, [user, "community_social"]))
      .rows.length,
    0,
  );
  await assert.rejects(
    () =>
      pg.query(
        "select private.community_assert_access($1,'community_social')",
        [user],
      ),
    /session/,
  );
  await claims();
  await transaction(async () => {
    await pg.exec(`delete from auth.sessions where id='${session}'`);
    assert.equal(
      (await pg.query(previewCommunityPolicyQuery, [user, "community_social"]))
        .rows.length,
      0,
    );
    await assert.rejects(
      () =>
        pg.query(
          "select private.community_assert_access($1,'community_social')",
          [user],
        ),
      /session/,
    );
  });
});

test("tips, Edge accounting, leaderboards, marketing and commercial privileges never derive from a tester grant", async () => {
  for (const feature of [
    "tips",
    "community_edges",
    "leaderboards",
    "marketing",
    "paid_analysis",
    "competitions",
    "prizes",
    "deals",
    "sponsorship",
    "",
  ]) {
    assert.equal(await allowed(feature), false, feature);
    await assert.rejects(
      () =>
        pg.query("select private.community_assert_access($1,$2)", [
          user,
          feature,
        ]),
      /restricted/,
    );
  }
  const own = (
    await pg.query<{ country: string; state: string }>(
      "select country,state from public.profiles where id=$1",
      [user],
    )
  ).rows[0];
  assert.deepEqual(own, { country: "AU", state: "NSW" });
});

test("expiry, revocation, policy withdrawal and account revocation immediately deny preview access", async () => {
  await transaction(async () => {
    await pg.exec(
      `update private.preview_tester_access set revoked_at=clock_timestamp(),revoked_by='test-operator',revocation_reason='Test revocation only' where id='${grant}'`,
    );
    assert.equal(await allowed(), false);
    await assert.rejects(
      () =>
        pg.query(
          "select private.community_assert_access($1,'community_social')",
          [user],
        ),
      /restricted/,
    );
  });
  for (const change of [
    "approved=false",
    "review_at=now()-interval '1 second'",
    "effective_to=now()-interval '1 second'",
  ]) {
    await transaction(async () => {
      await pg.exec(
        `update private.region_policies set ${change} where id='${policy}'`,
      );
      assert.equal(await allowed(), false);
    });
  }
  await transaction(async () => {
    await pg.exec(
      `update public.profiles set disabled_at=clock_timestamp() where id='${user}'`,
    );
    assert.equal(await allowed(), false);
  });
  await transaction(async () => {
    await pg.exec(
      `delete from private.preview_tester_access where id='${grant}';insert into private.preview_tester_access(user_id,policy_id,project_ref,created_at,expires_at,granted_by,reason) values('${user}','${policy}','bckkllmndoxzpzdqrevb',now()-interval '2 hours',now()-interval '1 hour','test-operator','Expired isolated fixture only')`,
    );
    assert.equal(await allowed(), false);
  });
});

test("ordinary reviewed jurisdiction approvals retain their existing behavior without preview context", async () => {
  await transaction(async () => {
    await pg.exec(
      `insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence) values('AU','NSW','ordinary-fixture',now()-interval '1 day',now()+interval '1 day',now()+interval '1 day',true,18,array['community_edges'],'Isolated ordinary policy fixture')`,
    );
    await claims(other, otherSession, "");
    assert.equal(await allowed("community_edges", other), true);
    await pg.query(
      "select private.community_assert_access($1,'community_edges')",
      [other],
    );
    assert.equal(await allowed("community_social", other), false);
  });
  await claims();
});

test("preview marker and grant constraints prevent scope broadening or mutable enrollment", async () => {
  for (const change of [
    "features=array['tips']",
    "features=array['community_social','marketing']",
    "operators=array['operator']",
    "minimum_age=21",
    "country='AU'",
    "preview_community_only=false",
    "evidence='legal approval'",
  ])
    await assert.rejects(
      () =>
        pg.exec(
          `update private.region_policies set ${change} where id='${policy}'`,
        ),
      /preview_community_scope/,
    );
  for (const change of [
    "expires_at=now()+interval '1 day'",
    `user_id='${other}'`,
    "revoked_at=clock_timestamp()",
  ])
    await assert.rejects(() =>
      pg.exec(
        `update private.preview_tester_access set ${change} where id='${grant}'`,
      ),
    );
  await assert.rejects(() =>
    pg.exec(
      `insert into private.preview_tester_access(user_id,policy_id,project_ref,expires_at,granted_by,reason) values('${other}','${policy}','bckkllmndoxzpzdqrevb',now()+interval '8 days','test-operator','Too long isolated grant')`,
    ),
  );
  await transaction(async () => {
    await pg.exec(
      `update private.preview_tester_access set revoked_at=clock_timestamp(),revoked_by='test-operator',revocation_reason='First revocation fixture' where id='${grant}'`,
    );
    await assert.rejects(
      () =>
        pg.exec(
          `update private.preview_tester_access set revoked_at=null,revoked_by=null,revocation_reason=null where id='${grant}'`,
        ),
      /immutable/,
    );
  });
});

test("browser roles cannot enumerate or self-enroll, even with forged preview/admin metadata and GUC", async () => {
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`set role ${role}`);
    for (const sql of [
      "select * from private.preview_tester_access",
      `insert into private.preview_tester_access(user_id) values('${other}')`,
      `select private.preview_tester_policy('${user}','community_social')`,
      `select private.community_assert_access('${user}','community_social')`,
    ])
      await assert.rejects(() => pg.exec(sql), /permission denied/);
    await pg.exec("reset role");
  }
  assert.equal(
    (
      await pg.query<{ relrowsecurity: boolean }>(
        "select relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and relname='preview_tester_access'",
      )
    ).rows[0].relrowsecurity,
    true,
  );
  assert.equal(
    (
      await pg.query<{ n: number }>(
        "select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.prosecdef",
      )
    ).rows[0].n,
    1,
  );
});

test("hard deletion removes tester identity mapping while retaining minimal grant audit", async () => {
  await transaction(async () => {
    await pg.exec(
      `delete from auth.sessions where user_id='${user}';delete from auth.users where id='${user}'`,
    );
    assert.equal(
      (
        await pg.query<{ n: number }>(
          "select count(*)::int n from private.preview_tester_access where user_id=$1",
          [user],
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (
        await pg.query<{ n: number }>(
          "select count(*)::int n from private.audit_events where action='preview_tester_granted' and subject=$1",
          [grant],
        )
      ).rows[0].n,
      1,
    );
  });
});

test("session expiry uses wall clock even when transaction start remains before expiry", async () => {
  await transaction(async () => {
    await pg.exec(
      `update auth.sessions set not_after=clock_timestamp()+interval '150 milliseconds' where id='${session}'`,
    );
    assert.equal(
      (
        await pg.query<{ active: boolean }>(
          "select private.active_member_session() active",
        )
      ).rows[0].active,
      true,
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(
      (
        await pg.query<{ old_clock_allows: boolean }>(
          "select now()<not_after old_clock_allows from auth.sessions where id=$1",
          [session],
        )
      ).rows[0].old_clock_allows,
      true,
    );
    assert.equal(
      (
        await pg.query<{ active: boolean }>(
          "select private.active_member_session() active",
        )
      ).rows[0].active,
      false,
    );
    assert.equal(
      (await pg.query(previewCommunityPolicyQuery, [user, "community_social"]))
        .rows.length,
      0,
    );
    await assert.rejects(
      () =>
        pg.query(
          "select private.community_assert_access($1,'community_social')",
          [user],
        ),
      /session/,
    );
  });
});
