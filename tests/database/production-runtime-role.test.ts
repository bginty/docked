import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  persistSignupProfile,
  type SignupTransaction,
} from "../../src/server/signup-profile";
import {
  leaseDeletionJobQuery,
  recoverDeletionJobsQuery,
  communityRetentionQueries,
} from "../../src/server/community-maintenance-query";
let pg: PGlite;
const member = "00000000-0000-4000-8000-000000000601";
const other = "00000000-0000-4000-8000-000000000602";
const sid = "00000000-0000-4000-8000-000000000603";
let profileId: string;
let postId: string;
before(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon;create role authenticated;create role supabase_auth_admin;create schema auth;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,raw_app_meta_data jsonb default '{}',banned_until timestamptz,encrypted_password text);
  create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz,refresh_secret text);
  create table auth.refresh_tokens(token text);
  alter table auth.users enable row level security;alter table auth.sessions enable row level security;
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
  grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
  const migrations = (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const runtimeFile = "20261003214310_production_community_runtime_role.sql";
  // Establish the managed Auth ownership fixture immediately before migration 13,
  // then apply its successors in order; later ACL migrations depend on docked_app.
  for (const file of migrations.filter((f) => f < runtimeFile)) {
    await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await pg.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'production-role-fixture@example.invalid',now()),($2,'other-role-fixture@example.invalid',now())",
    [member, other],
  );
  await pg.query("insert into auth.sessions(id,user_id) values($1,$2)", [
    sid,
    member,
  ]);
  await pg.exec(`alter table auth.users owner to supabase_auth_admin;
    alter table auth.sessions owner to supabase_auth_admin;
    alter table auth.refresh_tokens owner to supabase_auth_admin;
    alter schema auth owner to supabase_auth_admin;
    grant usage on schema auth to postgres;
    grant select on auth.users,auth.sessions to postgres with grant option;
    grant insert,update,delete on auth.users,auth.sessions to postgres;
    create role migration_operator nologin nosuperuser createrole bypassrls;
    grant postgres to migration_operator;
    set role migration_operator;`);
  const runtimeMigration = await readFile(
    `supabase/migrations/${runtimeFile}`,
    "utf8",
  );
  await pg.exec(
    "begin;set role supabase_auth_admin;alter table auth.users drop column banned_until;set role migration_operator",
  );
  await assert.rejects(
    pg.exec(runtimeMigration),
    /Managed Auth user schema differs/,
  );
  await pg.exec("rollback;set role migration_operator");
  await pg.exec(runtimeMigration);
  for (const file of migrations.filter((f) => f > runtimeFile)) {
    await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await pg.exec(
    "insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence) values('XX','ROLE_TEST','isolated-test',now()-interval '1 day',now()+interval '1 day',now()+interval '1 day',true,18,array['community_social','public_profiles'],'Isolated PostgreSQL regression only; not a legal approval')",
  );
});
after(async () => {
  await pg?.close();
});
async function asApp() {
  await pg.exec("set role docked_app");
}
async function reset() {
  await pg.exec("set role migration_operator");
}
async function deny(sql: string) {
  await assert.rejects(
    pg.exec(sql),
    /permission denied|row-level security|not permitted|must be owner/,
  );
}
const tx: SignupTransaction = {
  query: async (sql, parameters) =>
    (await pg.query<Record<string, unknown>>(sql, parameters)).rows,
  savepoint: async (run) => {
    await pg.exec("savepoint signup_profile");
    try {
      await run(tx);
      await pg.exec("release savepoint signup_profile");
    } catch (error) {
      await pg.exec("rollback to savepoint signup_profile");
      throw error;
    }
  },
};
test("production runtime starts without login, elevated attributes, ownership, memberships or permanent DDL", async () => {
  assert.deepEqual(
    (
      await pg.query(
        "select rolsuper,rolbypassrls from pg_roles where rolname=current_user",
      )
    ).rows,
    [{ rolsuper: false, rolbypassrls: true }],
  );
  assert.equal(
    (
      await pg.query(
        "select 1 from pg_policy where polrelid in ('auth.users'::regclass,'auth.sessions'::regclass)",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await pg.query<{ allowed: boolean }>(
        "select has_table_privilege(current_user,'auth.sessions','DELETE WITH GRANT OPTION') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  await assert.rejects(
    pg.exec(
      "create policy forbidden_auth_policy on auth.sessions for select using(true)",
    ),
    /must be owner/,
  );
  assert.equal(
    (
      await pg.query<{ allowed: boolean }>(
        "select has_schema_privilege(current_user,'auth','USAGE WITH GRANT OPTION') allowed",
      )
    ).rows[0].allowed,
    false,
  );
  const role = (
    await pg.query<Record<string, boolean>>(
      "select rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit from pg_roles where rolname='docked_app'",
    )
  ).rows[0];
  assert.equal(Object.values(role).some(Boolean), false);
  assert.equal(
    (
      await pg.query(
        "select 1 from pg_auth_members where member=(select oid from pg_roles where rolname='docked_app')",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await pg.query(
        "select 1 from pg_class where relnamespace in('public'::regnamespace,'private'::regnamespace,'auth'::regnamespace) and relowner=(select oid from pg_roles where rolname='docked_app')",
      )
    ).rows.length,
    0,
  );
  await asApp();
  await deny("create table public.production_ddl_escape(id int)");
  await deny("create table private.production_ddl_escape(id int)");
  await deny("alter table public.profiles disable row level security");
  await reset();
});
test("browser table privileges remain unchanged and production server cannot read secrets/raw provider records", async () => {
  const publicPrivate = await pg.query(
    "select c.relname from pg_class c where c.relnamespace='private'::regnamespace and c.relkind='r' and (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') or has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'))",
  );
  assert.equal(publicPrivate.rows.length, 0);
  assert.deepEqual(
    (
      await pg.query(
        "select has_schema_privilege('docked_app','auth','USAGE') auth_usage,has_function_privilege('anon','private.runtime_uid()','EXECUTE') anon_claim,has_function_privilege('authenticated','private.runtime_uid()','EXECUTE') member_claim",
      )
    ).rows,
    [{ auth_usage: false, anon_claim: false, member_claim: false }],
  );
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`set role ${role}`);
    await deny("select * from private.runtime_auth_users");
    await deny("delete from private.runtime_auth_sessions");
    await reset();
  }
  await asApp();
  assert.equal(
    (
      await pg.query(
        "select id,email,email_confirmed_at from private.runtime_auth_users",
      )
    ).rows.length,
    2,
  );
  assert.deepEqual(
    (
      await pg.query(
        "select classification,count(*) observations from private.community_quote_evidence where created_at>=now()-interval '30 days' group by classification",
      )
    ).rows,
    [],
  );
  for (const sql of [
    "select encrypted_password from auth.users",
    "select * from auth.users",
    "delete from auth.sessions",
    "select refresh_secret from private.runtime_auth_sessions",
    "select encrypted_password from private.runtime_auth_users",
    "select * from auth.refresh_tokens",
    "select * from private.market_data_payloads",
    "select payload from private.odds_snapshots",
    "select * from private.community_quote_evidence",
    "select token_hash from private.preview_beta_invitations",
  ])
    await assert.rejects(pg.exec(sql), /permission denied|does not exist/);
  await reset();
});

test("runtime cannot escalate roles or execute privileged helper paths", async () => {
  const elevated = await pg.query<{ name: string; fixed_path: boolean }>(
    "select p.proname name,coalesce(p.proconfig @> array['search_path=\"\"'],false) fixed_path from pg_proc p where p.pronamespace='private'::regnamespace and p.prosecdef and has_function_privilege('docked_app',p.oid,'EXECUTE')",
  );
  assert.deepEqual(elevated.rows, [
    { name: "active_member_session", fixed_path: true },
  ]);
  await pg.exec("set session authorization docked_app");
  for (const sql of [
    "set role postgres",
    "alter role docked_app superuser",
    "grant authenticated to docked_app",
    "create function private.production_helper_escape() returns boolean language sql security definer as 'select true'",
    "update auth.users set email_confirmed_at=now()",
    "insert into private.roles(user_id,role) values('00000000-0000-4000-8000-000000000601','owner')",
    "select private.purge_expired_market_payloads()",
    "select private.scanner_assert_actor(true)",
    "select private.transition_strategy('unapproved','APPROVED_FOR_LIVE','00000000-0000-4000-8000-000000000601','denied','0000000000000000000000000000000000000000',null)",
  ])
    await deny(sql);
  await pg.exec(
    "select set_config('request.jwt.claim.sub','',false),set_config('request.jwt.claims','{}',false)",
  );
  assert.equal(
    (
      await pg.query<{ allowed: boolean }>(
        "select private.active_member_session() allowed",
      )
    ).rows[0].allowed,
    false,
  );
  // Restore the isolated harness owner explicitly; PGlite RESET may retain the
  // last session setting as its embedded connection baseline.
  await pg.exec("set session authorization postgres");
  await reset();
});
test("runtime cannot assign roles, approve regions, publish, settle, alter flags or edit immutable audit", async () => {
  await asApp();
  for (const sql of [
    "delete from private.roles",
    "update private.region_policies set approved=true",
    "update private.region_policies set id=id",
    "insert into private.tip_publications default values",
    "insert into private.settlement_events default values",
    "update private.feature_flags set enabled=true",
    "update private.audit_events set action='tampered'",
    "delete from private.consent_events",
    "select private.assert_preview_beta_admin()",
  ])
    await deny(sql);
  await reset();
});
test("restricted runtime can create account consent/preferences without password visibility", async () => {
  await asApp();
  await pg.exec("begin");
  try {
    assert.equal(
      (
        await persistSignupProfile(
          tx,
          member,
          {
            country: "XX",
            state: "ROLE_TEST",
            username: "role_fixture_member",
          },
          { terms: "test-approved-terms", privacy: "test-approved-privacy" },
        )
      ).created,
      true,
    );
    await pg.exec("commit");
  } catch (error) {
    await pg.exec("rollback");
    throw error;
  }
  profileId = (
    await pg.query<{ id: string }>(
      "select id from private.social_profiles where user_id=$1",
      [member],
    )
  ).rows[0].id;
  assert.equal(
    (
      await pg.query("select 1 from private.consent_events where user_id=$1", [
        member,
      ])
    ).rows.length,
    8,
  );
  await reset();
});
test("real actor/session and policy locks work while expired sessions are denied", async () => {
  await asApp();
  await pg.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [member, JSON.stringify({ sub: member, session_id: sid, aal: "aal1" })],
  );
  assert.equal(
    (
      await pg.query<{ id: string }>(
        "select private.community_actor($1,'community_social',true) id",
        [member],
      )
    ).rows[0].id,
    profileId,
  );
  await assert.rejects(
    pg.query("select private.community_actor($1,'community_social',true)", [
      other,
    ]),
    /Active authenticated session/,
  );
  await pg.query("update public.profiles set state='NO_APPROVAL' where id=$1", [
    member,
  ]);
  assert.equal(
    (
      await pg.query<{ allowed: boolean }>(
        "select private.community_feature_allowed($1,'community_social') allowed",
        [member],
      )
    ).rows[0].allowed,
    false,
  );
  await assert.rejects(
    pg.query("select private.community_actor($1,'community_social',true)", [
      member,
    ]),
    /Community feature restricted/,
  );
  await pg.query("update public.profiles set state='ROLE_TEST' where id=$1", [
    member,
  ]);
  await reset();
  await pg.query(
    "update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1",
    [sid],
  );
  await asApp();
  await assert.rejects(
    pg.query("select private.community_actor($1,'community_social',true)", [
      member,
    ]),
    /Active authenticated session/,
  );
  await reset();
  await pg.query("update auth.sessions set not_after=null where id=$1", [sid]);
});
test("ordinary social writes fan out durably but cannot impersonate official or ledger posts", async () => {
  await asApp();
  postId = (
    await pg.query<{ id: string }>(
      "insert into private.social_posts(author_id,kind,body) values($1,'discussion','Clearly fictional production-role regression') returning id",
      [profileId],
    )
  ).rows[0].id;
  assert.equal(
    (
      await pg.query(
        "select 1 from private.social_notification_jobs where post_id=$1",
        [postId],
      )
    ).rows.length,
    1,
  );
  await deny(
    "insert into private.social_posts(author_id,kind,body) values('00000000-0000-4000-8000-000000000001','official','Impersonation denied')",
  );
  await pg.query(
    "insert into private.social_comments(post_id,author_id,body,idempotency_key) values($1,$2,'A fictional reply',gen_random_uuid())",
    [postId, profileId],
  );
  await reset();
});

test("ordinary-region access rechecks wall-clock session expiry after authorization-row query waits", async () => {
  // A restrictive RLS predicate introduces a deterministic wait during the
  // policy-row query, after the initial session check and before its return.
  await pg.exec(
    "create function private.fixture_policy_wait() returns boolean language plpgsql volatile as $$begin perform pg_sleep(0.4);return true;end$$;grant execute on function private.fixture_policy_wait() to docked_app;create policy fixture_authorization_wait on private.region_policies as restrictive for select to docked_app using(private.fixture_policy_wait())",
  );
  await pg.query(
    "update auth.sessions set not_after=clock_timestamp()+interval '300 milliseconds' where id=$1",
    [sid],
  );
  await asApp();
  await assert.rejects(
    pg.query("select private.community_actor($1,'community_social',true)", [
      member,
    ]),
    /Community feature restricted/,
  );
  await reset();
  await pg.exec(
    "drop policy fixture_authorization_wait on private.region_policies;drop function private.fixture_policy_wait()",
  );
  await pg.query("update auth.sessions set not_after=null where id=$1", [sid]);
});
test("runtime queues cannot activate scanner/provider/publication jobs or external delivery", async () => {
  await asApp();
  for (const sql of [
    "insert into private.job_runs(dedupe_key,kind) values('forbidden','edge-scan')",
    "insert into private.outbox(dedupe_key,kind,payload,expires_at) values('forbidden','publication','{}',now()+interval '1 day')",
    "insert into private.delivery_attempts default values",
  ])
    await deny(sql);
  await reset();
});

test("maintenance leases only deletion jobs despite older unrelated work and expires only exhausted deletion leases", async () => {
  await pg.exec(
    "insert into private.job_runs(dedupe_key,kind,created_at) values('older-unrelated','edge-scan',now()-interval '1 day'); insert into private.job_runs(dedupe_key,kind,state,lease_until,attempts) values('exhausted-unrelated','edge-scan','leased',now()-interval '1 minute',5),('exhausted-deletion','account_deletion','leased',now()-interval '1 minute',5);insert into private.job_runs(dedupe_key,kind,payload) values('eligible-deletion','account_deletion','{}')",
  );
  await asApp();
  await pg.exec(recoverDeletionJobsQuery);
  assert.deepEqual(
    (
      await pg.query(
        "select dedupe_key,state from private.job_runs where dedupe_key like 'exhausted-%' order by dedupe_key",
      )
    ).rows,
    [
      { dedupe_key: "exhausted-deletion", state: "dead" },
      { dedupe_key: "exhausted-unrelated", state: "leased" },
    ],
  );
  const leased = await pg.query<{ id: string; lease_token: string }>(
    leaseDeletionJobQuery,
    ["00000000-0000-4000-8000-000000000604"],
  );
  assert.equal(leased.rows.length, 1);
  assert.equal(
    (
      await pg.query<{ kind: string }>(
        "select kind from private.job_runs where id=$1",
        [leased.rows[0].id],
      )
    ).rows[0].kind,
    "account_deletion",
  );
  assert.equal(
    (
      await pg.query(leaseDeletionJobQuery, [
        "00000000-0000-4000-8000-000000000605",
      ])
    ).rows.length,
    0,
  );
  await reset();
});

test("bounded retention works through restricted role without removing current inbox records", async () => {
  await pg.query(
    "insert into private.social_notifications(recipient_id,type,title,href,group_key,dedupe_key,expires_at) select $1,'system','Isolated retention fixture','/notifications','test','expired-'||n,clock_timestamp()-interval '1 second' from generate_series(1,1001)n",
    [profileId],
  );
  await pg.query(
    "insert into private.social_notifications(recipient_id,type,title,href,group_key,dedupe_key) values($1,'system','Current fixture','/notifications','test','current')",
    [profileId],
  );
  await asApp();
  for (const query of communityRetentionQueries) await pg.exec(query);
  assert.equal(
    (
      await pg.query(
        "select 1 from private.social_notifications where dedupe_key like 'expired-%'",
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await pg.query(
        "select 1 from private.social_notifications where dedupe_key='current'",
      )
    ).rows.length,
    1,
  );
  await reset();
});
test("restricted runtime account revocation preserves immutable consent and pseudonymizes social history", async () => {
  await asApp();
  await pg.query("select private.disable_account($1)", [member]);
  assert.equal(
    (
      await pg.query(
        "select 1 from private.runtime_auth_sessions where user_id=$1",
        [member],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await pg.query(
        "select 1 from public.profiles where id=$1 and disabled_at is not null",
        [member],
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await pg.query(
        "select 1 from private.social_profiles where id=$1 and user_id is null and status='deleted'",
        [profileId],
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await pg.query(
        "select 1 from private.social_posts where id=$1 and body='' and deleted_at is not null",
        [postId],
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await pg.query("select 1 from private.consent_events where user_id=$1", [
        member,
      ])
    ).rows.length,
    8,
  );
  await pg.query("delete from public.profiles where id=$1", [member]);
  assert.equal(
    (await pg.query("select 1 from public.profiles where id=$1", [member])).rows
      .length,
    0,
  );
  await reset();
});
