import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
const user = "d0000000-0000-4000-8000-000000000001",
  other = "d0000000-0000-4000-8000-000000000002",
  session = "d0000000-0000-4000-8000-000000000011",
  policy = "d0000000-0000-4000-8000-000000000021";
let pg: PGlite;
before(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
  await pg.exec(`insert into auth.users(id,email_confirmed_at) values('${user}',now()),('${other}',now());insert into auth.sessions values('${session}','${user}',null);
 insert into public.profiles(id,country,state,age_attested,accepted_version) values('${user}','AU','NSW',true,'fixture'),('${other}','AU','NSW',true,'fixture');
 insert into private.region_policies(id,country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence,preview_community_only)
 values('${policy}','XX','DOCKED_PREVIEW','fixture',now()-interval '1 minute',now()+interval '1 day',now()+interval '1 day',true,18,array['community_social','public_profiles'],'PREVIEW TEST ONLY: isolated fixture, no legal approval.',true);`);
  await claims();
});
after(async () => pg?.close());
async function claims(project = "bckkllmndoxzpzdqrevb", aal = "aal1") {
  await pg.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('docked.hosted_preview_project',$3,false)",
    [
      user,
      JSON.stringify({
        sub: user,
        session_id: session,
        aal,
        user_metadata: { preview: true, role: "admin" },
      }),
      project,
    ],
  );
}
async function rollback(fn: () => Promise<void>) {
  await pg.exec("begin");
  try {
    await fn();
  } finally {
    await pg.exec("rollback");
  }
}
async function grant(caps = ["community_social", "public_profiles"]) {
  return (
    await pg.query<{ id: string }>(
      `insert into private.preview_tester_access(user_id,policy_id,project_ref,expires_at,granted_by,reason,capabilities) values($1,$2,'bckkllmndoxzpzdqrevb',clock_timestamp()+interval '1 hour','fixture-operator','Isolated test authorization only',$3) returning id`,
      [user, policy, caps],
    )
  ).rows[0].id;
}
async function allowed(cap = "preview_market_fixtures", id = user) {
  return (
    await pg.query<{ ok: boolean }>(
      "select private.preview_tester_capability($1,$2) ok",
      [id, cap],
    )
  ).rows[0].ok;
}
async function invitation() {
  return (
    await pg.query<{ id: string }>(
      `insert into private.preview_beta_invitations(project_ref,policy_id,token_hash,email_hash,capabilities,expires_at,grant_hours,created_by,reason) values('bckkllmndoxzpzdqrevb',$1,$2,$3,array['community_social','public_profiles','preview_market_fixtures'],clock_timestamp()+interval '1 hour',1,'fixture-operator','Isolated invitation regression') returning id`,
      [policy, "a".repeat(64), "b".repeat(64)],
    )
  ).rows[0].id;
}
test("capabilities require an explicit grant, legal acceptance and privacy; genuine features never unlock", async () =>
  rollback(async () => {
    await grant();
    assert.equal(await allowed("community_social"), true);
    assert.equal(await allowed(), false);
    await grant([
      "community_social",
      "public_profiles",
      "preview_market_fixtures",
      "preview_top_docked",
    ]);
    assert.equal(await allowed(), false);
    await pg.query(
      "insert into private.consent_events(user_id,purpose,granted,version,actor) values($1,'privacy',true,'fixture','fixture')",
      [user],
    );
    assert.equal(await allowed(), true);
    assert.equal(await allowed("preview_top_docked"), true);
    assert.equal(await allowed("preview_market_fixtures", other), false);
    for (const cap of [
      "community_edges",
      "leaderboards",
      "tips",
      "marketing",
      "admin",
    ])
      assert.equal(await allowed(cap), false);
    await pg.query("select private.assert_preview_tester_capability($1,$2)", [
      user,
      "preview_market_fixtures",
    ]);
    await pg.query(
      "update public.profiles set age_attested=false where id=$1",
      [user],
    );
    assert.equal(await allowed(), false);
  }));
test("wrong project, no session, caller metadata and revoked grants cannot authorize", async () =>
  rollback(async () => {
    const id = await grant();
    await claims("unrelated");
    assert.equal(await allowed("community_social"), false);
    await claims();
    await pg.query(
      "update private.preview_tester_access set revoked_at=clock_timestamp(),revoked_by='fixture',revocation_reason='Regression revocation check' where id=$1",
      [id],
    );
    assert.equal(await allowed("community_social"), false);
    await grant();
    await pg.query("delete from auth.sessions where id=$1", [session]);
    assert.equal(await allowed("community_social"), false);
  }));
test("capability arrays cannot smuggle genuine permissions or mutate an existing grant", async () => {
  await assert.rejects(
    () => grant(["community_social", "public_profiles", "leaderboards"]),
    /check constraint/,
  );
  await rollback(async () => {
    const id = await grant();
    await assert.rejects(
      () =>
        pg.query(
          "update private.preview_tester_access set capabilities=array['community_social','public_profiles','preview_market_fixtures'] where id=$1",
          [id],
        ),
      /immutable/i,
    );
  });
});
test("invitation reservation is one-use and identity-bound; redemption removes credential hashes", async () =>
  rollback(async () => {
    const id = await invitation(),
      reservation = randomUUID();
    await pg.query(
      "update private.preview_beta_invitations set status='reserved',reservation_id=$1,reserved_user_id=$2 where id=$3",
      [reservation, user, id],
    );
    await pg.query(
      "update private.preview_beta_invitations set status='redeemed',redeemed_user_id=$1 where id=$2",
      [user, id],
    );
    const row = (
      await pg.query<{ status: string; token_hash: null; email_hash: null }>(
        "select status,token_hash,email_hash from private.preview_beta_invitations where id=$1",
        [id],
      )
    ).rows[0];
    assert.deepEqual(row, {
      status: "redeemed",
      token_hash: null,
      email_hash: null,
    });
    assert.equal(
      (
        await pg.query(
          "select id from private.preview_beta_invitations where token_hash=$1 and status='pending'",
          ["a".repeat(64)],
        )
      ).rows.length,
      0,
    );
  }));
test("revoked invitation cannot reserve or reveal retained token/email hash", async () =>
  rollback(async () => {
    const id = await invitation();
    await pg.query(
      "update private.preview_beta_invitations set status='revoked' where id=$1",
      [id],
    );
    const row = (
      await pg.query<{ token_hash: null; email_hash: null }>(
        "select token_hash,email_hash from private.preview_beta_invitations where id=$1",
        [id],
      )
    ).rows[0];
    assert.deepEqual(row, { token_hash: null, email_hash: null });
    await assert.rejects(
      () =>
        pg.query(
          "update private.preview_beta_invitations set status='reserved',reservation_id=$1,reserved_user_id=$2 where id=$3",
          [randomUUID(), user, id],
        ),
      /lifecycle/,
    );
  }));
test("wall-clock expiry rejects reservation and capability inside an earlier transaction", async () =>
  rollback(async () => {
    const id = await invitation();
    await pg.query(
      "update private.region_policies set review_at=clock_timestamp()+interval '40 milliseconds' where id=$1",
      [policy],
    );
    await grant();
    await new Promise((r) => setTimeout(r, 70));
    assert.equal(await allowed("community_social"), false);
    await assert.rejects(
      () =>
        pg.query(
          "update private.preview_beta_invitations set status='reserved',reservation_id=$1,reserved_user_id=$2 where id=$3",
          [randomUUID(), user, id],
        ),
      /expired|restricted/,
    );
  }));
test("private tables are RLS-enabled with no browser read/write/function privilege", async () => {
  const rows = (
    await pg.query<{ relname: string; relrowsecurity: boolean }>(
      "select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and relname in ('app_onboarding','preview_beta_invitations')",
    )
  ).rows;
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.relrowsecurity));
  for (const role of ["anon", "authenticated"])
    for (const table of [
      "app_onboarding",
      "preview_beta_invitations",
      "preview_tester_access",
    ]) {
      const p = (
        await pg.query<{ ok: boolean }>(
          "select has_table_privilege($1,$2,$3) ok",
          [role, `private.${table}`, "SELECT,INSERT,UPDATE,DELETE"],
        )
      ).rows[0];
      assert.equal(p.ok, false);
    }
  for (const role of ["anon", "authenticated"])
    assert.equal(
      (
        await pg.query<{ ok: boolean }>(
          "select has_function_privilege($1,'private.assert_preview_tester_capability(uuid,text)','EXECUTE') ok",
          [role],
        )
      ).rows[0].ok,
      false,
    );
});
test("administrator operations require actual private role plus MFA, not metadata", async () => {
  await assert.rejects(
    () => pg.exec("select private.assert_preview_beta_admin()"),
    /MFA/,
  );
  await rollback(async () => {
    await pg.query(
      "insert into private.roles(user_id,role) values($1,'admin')",
      [user],
    );
    await assert.rejects(
      () => pg.exec("select private.assert_preview_beta_admin()"),
      /MFA/,
    );
  });
  await rollback(async () => {
    await pg.query(
      "insert into private.roles(user_id,role) values($1,'admin')",
      [user],
    );
    await claims("bckkllmndoxzpzdqrevb", "aal2");
    await pg.exec("select private.assert_preview_beta_admin()");
  });
  await claims();
});
test("erasure clears personal onboarding/grants and invitation FK even outside preview context", async () =>
  rollback(async () => {
    await grant();
    const id = await invitation();
    await pg.query(
      "update private.preview_beta_invitations set status='reserved',reservation_id=$1,reserved_user_id=$2 where id=$3",
      [randomUUID(), user, id],
    );
    await pg.query(
      "update private.preview_beta_invitations set status='redeemed',redeemed_user_id=$1 where id=$2",
      [user, id],
    );
    await pg.query(
      "insert into private.app_onboarding(user_id,interests) values($1,'both')",
      [user],
    );
    await claims("");
    await pg.query("select private.disable_account($1)", [user]);
    await pg.query("delete from public.profiles where id=$1", [user]);
    assert.equal(
      (await pg.query("select * from private.app_onboarding")).rows.length,
      0,
    );
    assert.equal(
      (await pg.query("select * from private.preview_tester_access")).rows
        .length,
      0,
    );
    assert.equal(
      (
        await pg.query<{ id: null }>(
          "select redeemed_user_id id from private.preview_beta_invitations where id=$1",
          [id],
        )
      ).rows[0].id,
      null,
    );
    assert.ok(
      (
        await pg.query(
          "select id from private.audit_events where action='preview_invitation_redeemed'",
        )
      ).rows.length,
    );
  }));
