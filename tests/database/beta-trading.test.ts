import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
test("trading approval, restricted grants, member checks, MFA, emergency pause and idempotent audit", async () => {
  const pg = new PGlite(),
    owner = randomUUID(),
    member = randomUUID(),
    outsider = randomUUID();
  try {
    // Minimal auth contracts isolate this migration; existing auth/RLS suites test the actual session implementation.
    await pg.exec(`create role anon;create role authenticated;create role service_role;create role docked_beta_app;
      create schema auth;create schema beta_private;create schema beta_public;create schema credits_sandbox;
      create table auth.users(id uuid primary key);create table beta_public.profiles(id uuid primary key,disabled_at timestamptz);
      create table beta_private.roles(user_id uuid,role text);
      create table credits_sandbox.access(user_id uuid primary key,enabled boolean,kind text,label text);
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function beta_private.active_member_session() returns boolean language sql as $$select coalesce(current_setting('test.active',true),'false')='true'$$;
      create function beta_private.admitted(uuid) returns boolean language sql as $$select exists(select 1 from credits_sandbox.access where user_id=$1 and enabled)$$;
      grant usage on schema credits_sandbox to docked_beta_app,anon,authenticated,service_role;`);
    await pg.exec(
      await readFile(
        "supabase/migrations/20261018093956_reviewed_beta_marketplace_controls.sql",
        "utf8",
      ),
    );
    for (const id of [owner, member, outsider]) {
      await pg.query("insert into auth.users values($1)", [id]);
      await pg.query("insert into beta_public.profiles values($1,null)", [id]);
      await pg.query(
        "insert into credits_sandbox.access values($1,true,'member','LOCAL QA')",
        [id],
      );
    }
    await pg.query("insert into beta_private.roles values($1,'owner')", [
      owner,
    ]);
    const identity = async (id: string, aal = "aal2", active = true) => {
      await pg.query(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('test.active',$3,false)",
        [id, JSON.stringify({ aal }), String(active)],
      );
    };
    const access = async (id = member) =>
      (
        await pg.query<{
          v: { enabled: boolean; swap: boolean; combined: boolean };
        }>(
          "select credits_sandbox.trading_access($1,'private-beta-trading-v1') v",
          [id],
        )
      ).rows[0].v;
    const pause = (
      wanted: boolean,
      revision = 0,
      request = randomUUID(),
      reason = "LOCAL QA reason",
    ) =>
      pg.query("select credits_sandbox.trading_set_pause($1,$2,$3,$4)", [
        wanted,
        revision,
        request,
        reason,
      ]);
    await identity(owner);
    await pg.exec("set role docked_beta_app");
    assert.equal((await access()).enabled, false);
    await assert.rejects(() => pause(false), /approval/);
    for (const table of ["trading_control", "trading_members", "trading_audit"])
      await assert.rejects(
        () => pg.exec(`delete from credits_sandbox.${table}`),
        /permission/,
      );
    await pg.exec("reset role");
    await pg.exec(
      "update credits_sandbox.trading_control set approval_reference='LOCAL QA approval only',approved_at=now(),sale=true,swap=true,combined=false",
    );
    for (const id of [owner, member])
      await pg.query(
        "insert into credits_sandbox.trading_members values($1,true,'LOCAL QA approval only')",
        [id],
      );
    await pg.exec("set role docked_beta_app");
    await pause(false);
    assert.equal((await access()).enabled, true);
    assert.equal((await access()).swap, true);
    assert.equal((await access()).combined, false);
    assert.equal((await access(outsider)).enabled, false);
    await identity(outsider);
    assert.equal((await access()).enabled, false);
    await assert.rejects(() => pause(true), /Owner MFA/);
    await identity(owner, "aal1");
    await assert.rejects(() => pause(true), /Owner MFA/);
    await identity(owner, "aal2", false);
    assert.equal((await access()).enabled, false);
    await assert.rejects(() => pause(true), /Owner MFA/);
    await identity(owner);
    const req = randomUUID();
    await pause(true, 0, req);
    await pause(true, 0, req);
    assert.equal((await access()).enabled, false);
    await assert.rejects(() => pause(false, 0, req), /Request already used/);
    await assert.rejects(() => pause(false, 0), /current controls/);
    await pause(false, 2);
    await pg.exec("reset role");
    await pg.query(
      "update beta_public.profiles set disabled_at=now() where id=$1",
      [member],
    );
    await pg.exec("set role docked_beta_app");
    assert.equal((await access()).enabled, false);
    const report = (
      await pg.query<{
        v: { audit: unknown[]; control: { revision: number } };
      }>("select credits_sandbox.trading_report() v")
    ).rows[0].v;
    assert.equal(report.audit.length, 3);
    assert.equal(Number(report.control.revision), 3);
    await identity(member);
    await assert.rejects(
      () => pg.exec("select credits_sandbox.trading_report()"),
      /Owner MFA/,
    );
    for (const role of ["anon", "authenticated", "service_role"]) {
      await pg.exec(`reset role;set role ${role}`);
      await assert.rejects(() => access(), /permission/);
    }
  } finally {
    await pg.close();
  }
});
