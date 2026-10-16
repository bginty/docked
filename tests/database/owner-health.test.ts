import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("owner health evidence: real migration, MFA/current-role guard, private storage and retry idempotency", async () => {
  const pg = new PGlite();
  const actor = "11111111-1111-4111-8111-111111111111",
    request = "22222222-2222-4222-8222-222222222222";
  try {
    await pg.exec(`create role anon;create role authenticated;create role service_role;create role docked_app;create role docked_beta_app;create schema auth;create schema beta_private;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function beta_private.active_member_session() returns boolean language sql as $$select current_setting('fixture.active',true)='true'$$;
 create function beta_private.owner_gameplay_identity(uuid) returns boolean language sql as $$select true$$;
 create table beta_private.roles(user_id uuid,role text);insert into beta_private.roles values('${actor}','owner');grant usage on schema beta_private to docked_beta_app,anon,authenticated;`);
    await pg.exec(
      await readFile(
        "supabase/migrations/20261016214620_owner_health_observations.sql",
        "utf8",
      ),
    );
    await pg.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('fixture.active','true',false)",
      [actor, JSON.stringify({ aal: "aal2" })],
    );
    await pg.exec("set role docked_beta_app");
    const rows = ["api", "web"].map((service) => ({
      service,
      status: "passed",
      code: "matched",
      statusCode: 200,
      durationMs: 20,
    }));
    const write = (id = request, data = rows) =>
      pg.query("select beta_private.owner_health_record($1,$2)", [
        id,
        JSON.stringify(data),
      ]);
    await write();
    const first = (
      await pg.query<{ value: unknown[] }>(
        "select beta_private.owner_health_read() value",
      )
    ).rows[0].value;
    assert.equal(first.length, 2);
    await write(
      request,
      rows.map((r) => ({ ...r, status: "failed" })),
    );
    assert.deepEqual(
      (
        await pg.query<{ value: unknown[] }>(
          "select beta_private.owner_health_read() value",
        )
      ).rows[0].value,
      first,
    );
    await assert.rejects(
      pg.query("select * from beta_private.service_health_observations"),
      /permission denied/,
    );
    await assert.rejects(
      pg.query(
        "update beta_private.service_health_observations set status='passed'",
      ),
      /permission denied/,
    );
    await assert.rejects(
      write("33333333-3333-4333-8333-333333333333", [
        ...rows.slice(0, 1),
        { ...rows[1], service: "android" },
      ]),
      /check constraint/,
    );
    await pg.query(
      "select set_config('request.jwt.claims','{\"aal\":\"aal1\"}',false)",
    );
    await assert.rejects(write(), /Owner MFA/);
    await pg.query(
      "select set_config('request.jwt.claims','{\"aal\":\"aal2\"}',false),set_config('fixture.active','false',false)",
    );
    await assert.rejects(
      pg.query("select beta_private.owner_health_read()"),
      /Owner MFA/,
    );
    await pg.exec("reset role;set role anon");
    await assert.rejects(
      pg.query("select beta_private.owner_health_read()"),
      /permission denied/,
    );
  } finally {
    await pg.close();
  }
});
