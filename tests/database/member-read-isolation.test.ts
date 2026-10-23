import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { memberReadIsolation } from "../../src/server/member-read-isolation";

test("member snapshots support real admission row locks without weakening access", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);
      create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      grant usage on schema auth to authenticated;
    `);
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    // Use installed security functions unchanged: transport stubs missed this bug.
    const query = "select beta_private.admitted(null::uuid) allowed";
    await pg.exec("begin isolation level repeatable read read only");
    await assert.rejects(pg.query(query), { code: "25006" });
    await pg.exec("rollback");
    await pg.exec(
      `begin ${memberReadIsolation}; set local role docked_beta_app`,
    );
    assert.equal(
      (await pg.query<{ allowed: boolean }>(query)).rows[0].allowed,
      false,
    );
    await pg.query(
      "select credits_sandbox.trading_access(null::uuid,'private-beta-trading-v1')",
    );
    assert.equal(
      (
        await pg.query(
          "select * from credits_sandbox.access where enabled and beta_private.admitted(user_id)",
        )
      ).rows.length,
      0,
    );
    await pg.exec("rollback");
  } finally {
    await pg.close();
  }
});
