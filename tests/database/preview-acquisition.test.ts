import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { acquisitionAccountsQuery } from "../../src/server/acquisition-query";
test("actual acquisition projection excludes retained operator and synthetic seeds without changing their identity metadata", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`create schema auth;create table auth.users(id integer primary key,email text,email_confirmed_at timestamptz,raw_app_meta_data jsonb);create table public.profiles(id integer primary key,disabled_at timestamptz,onboarding_completed_at timestamptz);
 insert into auth.users values(1,'owner@example.invalid',now(),'{}'),(2,'seed@normal.example',now(),'{"preview_fixture":true}'),(3,'invited@normal.example',now(),'{"preview_invitation_confirmed":true,"email_ownership_verified":false}'),(4,'verified@normal.example',now(),'{}'),(5,'unverified@normal.example',null,'{}'),(6,'deleted@normal.example',now(),'{}');
 insert into public.profiles select id,case when id=6 then now() end,now() from auth.users;`);
    const row = (
      await pg.query<{ signups: string; verified: string; activated: string }>(
        acquisitionAccountsQuery,
      )
    ).rows[0];
    assert.deepEqual(row, { signups: 3, verified: 1, activated: 3 });
    assert.deepEqual(
      (await pg.query("select raw_app_meta_data from auth.users where id=1"))
        .rows[0],
      { raw_app_meta_data: {} },
    );
  } finally {
    await pg.close();
  }
});
