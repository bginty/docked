import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  persistSignupProfile,
  type SignupTransaction,
} from "../../src/server/signup-profile";
let pg: PGlite;
let savepointId = 0;
const ids = Array.from(
  { length: 5 },
  (_, i) => `00000000-0000-4000-8000-000000000${501 + i}`,
);
const versions = {
  terms: "terms-production-reviewed-test-v1",
  privacy: "privacy-production-reviewed-test-v2",
};
const profile = { country: "XX", state: "TEST", username: "signup_person" };
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
  for (const id of ids)
    await pg.query("insert into auth.users(id) values($1)", [id]);
});
after(async () => {
  await pg?.close();
});
const tx: SignupTransaction = {
  query: async (text, parameters) =>
    (await pg.query<Record<string, unknown>>(text, parameters)).rows,
  savepoint: async (run) => {
    const name = `signup_test_${++savepointId}`;
    await pg.exec(`savepoint ${name}`);
    try {
      const result = await run(tx);
      await pg.exec(`release savepoint ${name}`);
      return result;
    } catch (error) {
      await pg.exec(`rollback to savepoint ${name}`);
      throw error;
    }
  },
};
async function transaction<T>(run: () => Promise<T>) {
  await pg.exec("begin");
  try {
    const result = await run();
    await pg.exec("commit");
    return result;
  } catch (error) {
    await pg.exec("rollback");
    throw error;
  }
}

test("new signup persists exact separate approved policy versions and optional consents remain false", async () => {
  assert.deepEqual(
    await transaction(() =>
      persistSignupProfile(tx, ids[0], profile, versions),
    ),
    { created: true, usernameRequired: false },
  );
  const rows = (
    await pg.query<{ purpose: string; granted: boolean; version: string }>(
      "select purpose,granted,version from private.consent_events where user_id=$1 order by purpose",
      [ids[0]],
    )
  ).rows;
  assert.equal(rows.length, 8);
  assert.equal(
    rows.find((r) => r.purpose === "terms")?.version,
    versions.terms,
  );
  assert.equal(
    rows.find((r) => r.purpose === "privacy")?.version,
    versions.privacy,
  );
  for (const row of rows.filter(
    (r) => !["terms", "privacy", "age_attestation"].includes(r.purpose),
  ))
    assert.equal(row.granted, false);
});
test("retrying signup cannot append consent or change an existing profile", async () => {
  const before = await pg.query(
    "select * from private.consent_events where user_id=$1 order by id",
    [ids[0]],
  );
  assert.deepEqual(
    await transaction(() =>
      persistSignupProfile(
        tx,
        ids[0],
        { ...profile, country: "AU", analytics: true, marketing: true },
        versions,
      ),
    ),
    { created: false, usernameRequired: false },
  );
  assert.deepEqual(
    (
      await pg.query(
        "select * from private.consent_events where user_id=$1 order by id",
        [ids[0]],
      )
    ).rows,
    before.rows,
  );
  assert.equal(
    (
      await pg.query<{ country: string }>(
        "select country from public.profiles where id=$1",
        [ids[0]],
      )
    ).rows[0].country,
    "XX",
  );
});
test("a concurrent taken handle preserves account and legal evidence for username onboarding", async () => {
  assert.deepEqual(
    await transaction(() =>
      persistSignupProfile(tx, ids[1], profile, versions),
    ),
    { created: true, usernameRequired: true },
  );
  assert.equal(
    (await pg.query("select 1 from public.profiles where id=$1", [ids[1]])).rows
      .length,
    1,
  );
  assert.equal(
    (
      await pg.query("select 1 from private.consent_events where user_id=$1", [
        ids[1],
      ])
    ).rows.length,
    8,
  );
  assert.equal(
    (
      await pg.query("select 1 from private.social_profiles where user_id=$1", [
        ids[1],
      ])
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await pg.query<{ user_id: string }>(
        "select user_id from private.social_profiles where handle=$1",
        [profile.username],
      )
    ).rows[0].user_id,
    ids[0],
  );
});
test("a historical handle race also preserves the new account without stealing the name", async () => {
  await pg.query(
    "update private.social_profiles set handle='signup_person_new' where user_id=$1",
    [ids[0]],
  );
  assert.deepEqual(
    await transaction(() =>
      persistSignupProfile(tx, ids[2], profile, versions),
    ),
    { created: true, usernameRequired: true },
  );
  assert.equal(
    (await pg.query("select 1 from public.profiles where id=$1", [ids[2]])).rows
      .length,
    1,
  );
  assert.equal(
    (
      await pg.query("select 1 from private.social_profiles where user_id=$1", [
        ids[2],
      ])
    ).rows.length,
    0,
  );
});
test("other integrity errors are not disguised as username collisions", async () => {
  await assert.rejects(
    transaction(() =>
      persistSignupProfile(
        tx,
        ids[3],
        { ...profile, username: "docked_official" },
        versions,
      ),
    ),
    /Protected identity/,
  );
  assert.equal(
    (await pg.query("select 1 from public.profiles where id=$1", [ids[3]])).rows
      .length,
    0,
  );
  assert.equal(
    (
      await pg.query("select 1 from private.consent_events where user_id=$1", [
        ids[3],
      ])
    ).rows.length,
    0,
  );
  assert.equal(
    (await pg.query("select 1 from auth.users where id=$1", [ids[3]])).rows
      .length,
    1,
    "Auth identities are never deleted as compensation",
  );
});
