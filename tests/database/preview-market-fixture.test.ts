import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { buildPreviewFixture } from "../../src/core/preview-market-fixture";
import { hash } from "../../src/core/pricing";
const user = "c0000000-0000-4000-8000-000000000001",
  other = "c0000000-0000-4000-8000-000000000002";
const profile = "c0000000-0000-4000-8000-000000000011",
  otherProfile = "c0000000-0000-4000-8000-000000000012";
const session = "c0000000-0000-4000-8000-000000000021",
  policy = "c0000000-0000-4000-8000-000000000031";
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
    insert into auth.sessions values('${session}','${user}',null);
    insert into public.profiles(id,country,state,age_attested,accepted_version) values('${user}','AU','VIC',true,'fixture'),('${other}','AU','VIC',true,'fixture');
    insert into private.social_profiles(id,user_id,handle,display_name) values('${profile}','${user}','demo_reader','DEMO Reader'),('${otherProfile}','${other}','demo_other','DEMO Other');
    insert into private.region_policies(id,country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence,preview_community_only)
    values('${policy}','XX','DOCKED_PREVIEW','fixture',now()-interval '1 minute',now()+interval '1 day',now()+interval '1 day',true,18,array['community_social','public_profiles'],'PREVIEW TEST ONLY: local regression, no legal approval.',true);
    insert into private.preview_tester_access(user_id,policy_id,project_ref,expires_at,granted_by,reason,capabilities)
    values('${user}','${policy}','bckkllmndoxzpzdqrevb',now()+interval '1 hour','fixture-operator','Isolated local regression only',array['community_social','public_profiles','preview_market_fixtures']);
    insert into private.consent_events(user_id,purpose,granted,version,actor) values('${user}','privacy',true,'fixture','fixture');`);
  await claims();
});
after(async () => pg?.close());
async function claims(project = "bckkllmndoxzpzdqrevb") {
  await pg.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('docked.hosted_preview_project',$3,false)",
    [
      user,
      JSON.stringify({ sub: user, session_id: session, aal: "aal1" }),
      project,
    ],
  );
}
async function transaction(fn: () => Promise<void>) {
  await pg.exec("begin");
  try {
    await fn();
  } finally {
    await pg.exec("rollback");
  }
}
function fixture(age = 0) {
  return buildPreviewFixture(
    { fixtureId: "demo-football", selection: "DEMO Harbour FC" },
    randomUUID(),
    new Date(Date.now() - age).toISOString(),
  );
}
async function insert(built = fixture(), owner = profile) {
  await pg.query(
    "insert into private.preview_market_sessions(id,profile_id,fixture_id,selection,observed_at,expires_at,payload,payload_hash) values($1,$2,$3,$4,$5,$6,$7,$8)",
    [
      built.review.id,
      owner,
      built.review.fixtureId,
      built.review.selection,
      built.review.observedAt,
      built.review.expiresAt,
      JSON.stringify(built.payload),
      built.review.reviewToken,
    ],
  );
  return built;
}
async function submit(built: ReturnType<typeof fixture>, key = randomUUID()) {
  return pg.query(
    "insert into private.preview_fixture_edges(profile_id,session_id,idempotency_key,payload_hash) values($1,$2,$3,$4) returning id",
    [profile, built.review.id, key, built.review.reviewToken],
  );
}
test("preview entries are immutable, audited and structurally absent from all real ledgers", async () =>
  transaction(async () => {
    const built = await insert();
    const key = randomUUID();
    await submit(built, key);
    assert.equal(
      (await pg.query("select id from private.preview_fixture_edges")).rows
        .length,
      1,
    );
    for (const table of [
      "community_edges",
      "tip_publications",
      "market_references",
      "social_posts",
    ])
      assert.equal(
        (await pg.query(`select id from private.${table}`)).rows.length,
        0,
      );
    assert.equal(
      (
        await pg.query(
          "select id from private.audit_events where action='preview_fixture_submitted'",
        )
      ).rows.length,
      1,
    );
  }));
test("direct edits, deletes, duplicates, browser writes and cross-user reviews are rejected", async () => {
  const built = await insert();
  const key = randomUUID();
  await submit(built, key);
  await assert.rejects(() => submit(built, key), /duplicate key/);
  for (const table of ["preview_fixture_edges", "preview_market_sessions"]) {
    await assert.rejects(
      () => pg.exec(`delete from private.${table}`),
      /Append-only/,
    );
    await assert.rejects(
      () => pg.exec(`update private.${table} set profile_id='${otherProfile}'`),
      /Append-only/,
    );
  }
  await assert.rejects(() => insert(fixture(), otherProfile), /owner required/);
  await pg.exec("set role authenticated");
  try {
    await assert.rejects(
      () => pg.exec("select * from private.preview_fixture_edges"),
      /permission denied/,
    );
    await assert.rejects(
      () => pg.exec("insert into private.preview_fixture_edges default values"),
      /permission denied/,
    );
    await assert.rejects(
      () =>
        pg.exec(
          `select private.assert_preview_tester_capability('${user}','preview_market_fixtures')`,
        ),
      /permission denied/,
    );
  } finally {
    await pg.exec("reset role");
  }
});
test("wrong environment, revoked capability and tampered or current-labelled evidence fail closed", async () => {
  for (const project of ["", "production", "unrelated-project"]) {
    await claims(project);
    await assert.rejects(() => insert(), /preview session/);
  }
  await claims();
  const built = fixture();
  built.payload.reference.decimalPrice = "99.00";
  await assert.rejects(() => insert(built), /synthetic preview evidence/);
  const current = fixture();
  Object.assign(current.payload.reference, { evidenceMode: "current" });
  current.review.reviewToken = hash(current.payload);
  await assert.rejects(() => insert(current), /synthetic preview evidence/);
  await assert.rejects(
    () => insert(fixture(91000)),
    /synthetic preview evidence/,
  );
  await transaction(async () => {
    const reviewed = await insert();
    await pg.exec(
      `update private.preview_tester_access set revoked_at=clock_timestamp(),revoked_by='fixture-operator',revocation_reason='Local regression revocation' where user_id='${user}'`,
    );
    await pg.exec("savepoint denied");
    await assert.rejects(() => submit(reviewed), /capability unavailable/);
    await pg.exec("rollback to denied");
  });
});
test("account erasure retains immutable fixture evidence with only a pseudonymous owner", async () =>
  transaction(async () => {
    const built = await insert();
    const saved = await submit(built);
    const recordId = (saved.rows[0] as { id: string }).id;
    await pg.query("select private.disable_account($1)", [user]);
    await pg.query("delete from public.profiles where id=$1", [user]);
    assert.deepEqual(
      (
        await pg.query(
          "select user_id,display_name,bio,status from private.social_profiles where id=$1",
          [profile],
        )
      ).rows,
      [
        {
          user_id: null,
          display_name: "Deleted member",
          bio: "",
          status: "deleted",
        },
      ],
    );
    assert.equal(
      (
        await pg.query(
          "select id from private.preview_fixture_edges where id=$1 and profile_id=$2",
          [recordId, profile],
        )
      ).rows.length,
      1,
    );
    const retained = (
      await pg.query<{ payload: unknown }>(
        "select payload from private.preview_market_sessions where id=$1",
        [built.review.id],
      )
    ).rows[0].payload;
    assert.deepEqual(retained, built.payload);
    assert.equal(JSON.stringify(retained).includes(user), false);
    assert.equal(
      (
        await pg.query(
          "select id from private.preview_tester_access where user_id=$1",
          [user],
        )
      ).rows.length,
      0,
    );
    assert.equal(
      (await pg.query("select id from auth.sessions where user_id=$1", [user]))
        .rows.length,
      0,
    );
    assert.equal(
      (
        await pg.query<{ allowed: boolean }>(
          "select private.preview_tester_capability($1,'preview_market_fixtures') as allowed",
          [user],
        )
      ).rows[0].allowed,
      false,
    );
  }));
