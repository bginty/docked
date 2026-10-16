import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("named admin admission preserves MFA, revocation, roster and owner boundaries", async () => {
  const pg = new PGlite();
  const owner = "00000000-0000-4000-8000-000000000001";
  const staff = "00000000-0000-4000-8000-000000000002";
  const member = "00000000-0000-4000-8000-000000000003";
  try {
    await pg.exec(`
      create role anon; create role authenticated; create role service_role;
      create role docked_app; create role docked_beta_app;
      create schema auth; create schema beta_private;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean,banned_until timestamptz);
      create table beta_private.roles(user_id uuid primary key,role text);
      create table beta_private.friends_roster(user_id uuid primary key,email text,enabled boolean);
      create table beta_private.friends_control(enabled boolean);
      create table beta_private.audit_events(actor text,action text,subject text,details jsonb);
      insert into auth.users values('${owner}','owner@example.invalid',now(),false,null),('${staff}','staff@example.invalid',now(),false,null),('${member}','member@example.invalid',now(),false,null);
      insert into beta_private.roles values('${owner}','owner'),('${staff}','admin');
      insert into beta_private.friends_roster values('${staff}','staff@example.invalid',true),('${member}','member@example.invalid',true);
      insert into beta_private.friends_control values(true);
      create function beta_private.owner_gameplay_identity(u uuid) returns boolean language sql as $$select u='${owner}'::uuid and coalesce(current_setting('fixture.owner_disabled',true),'')<>'true'$$;
      create function beta_private.beta_gameplay_identity(u uuid) returns boolean language sql as $$select beta_private.owner_gameplay_identity(u) or (u='${member}'::uuid and not exists(select 1 from beta_private.roles where user_id=u))$$;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function beta_private.admitted(u uuid) returns boolean language sql as $$select beta_private.beta_gameplay_identity(u) and coalesce(current_setting('fixture.suspended',true),'')<>'true'$$;
      create function beta_private.pre_admission_session() returns boolean language sql as $$select coalesce(current_setting('fixture.expired',true),'')<>'true'$$;
      create table beta_private.owner_gameplay_control(id boolean);
      insert into beta_private.owner_gameplay_control values(true);
      create function beta_private.gameplay_mfa_required(u uuid) returns boolean language sql as $$select exists(select 1 from beta_private.roles where user_id=u)$$;
      create function beta_private.active_member_session() returns boolean language sql as $$select false$$;
      grant usage on schema beta_private to docked_beta_app,anon,authenticated,service_role,docked_app;
    `);
    await pg.exec(
      await readFile(
        "supabase/migrations/20261010090152_two_person_owner_session_mfa.sql",
        "utf8",
      ),
    );
    await pg.exec(
      await readFile(
        "supabase/migrations/20261016233803_delegated_beta_admin_admission.sql",
        "utf8",
      ),
    );
    const identity = async (id: string) =>
      (
        await pg.query<{ allowed: boolean }>(
          "select beta_private.beta_gameplay_identity($1) allowed",
          [id],
        )
      ).rows[0].allowed;
    assert.equal(await identity(staff), false, "Role alone never admits staff");
    assert.equal(await identity(member), true);
    await pg.query(
      "insert into beta_private.delegated_admin_admissions(user_id,approved_by,authority,enabled) values($1,$2,'Explicit isolated owner approval for admin access',true)",
      [staff, owner],
    );
    assert.equal(
      await identity(staff),
      true,
      "Named grant permits enrolment identity",
    );
    const session = async (id: string, aal: string) => {
      await pg.query(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
        [id, JSON.stringify({ sub: id, aal })],
      );
      return (
        await pg.query<{ allowed: boolean }>(
          "select beta_private.active_member_session() allowed",
        )
      ).rows[0].allowed;
    };
    assert.equal(await session(staff, "aal1"), false);
    assert.equal(await session(staff, "aal2"), true);
    assert.equal(
      await session(member, "aal1"),
      true,
      "Ordinary members do not acquire MFA",
    );
    await pg.exec("set fixture.expired='true'");
    assert.equal(await session(staff, "aal2"), false);
    await pg.exec("set fixture.expired='false'; set fixture.suspended='true'");
    assert.equal(await session(staff, "aal2"), false);
    await pg.exec(
      "set fixture.suspended='false'; set fixture.owner_disabled='true'",
    );
    assert.equal(await identity(staff), false);
    await pg.exec("set fixture.owner_disabled='false'");
    for (const mutation of [
      `update beta_private.roles set role='auditor' where user_id='${staff}'`,
      `update beta_private.friends_roster set enabled=false where user_id='${staff}'`,
      `update auth.users set banned_until=now()+interval '1 day' where id='${staff}'`,
      `update auth.users set email='changed@example.invalid' where id='${staff}'`,
      `update beta_private.friends_control set enabled=false`,
      `update beta_private.delegated_admin_admissions set enabled=false where user_id='${staff}'`,
    ]) {
      await pg.exec("begin");
      await pg.exec(mutation);
      assert.equal(await identity(staff), false, mutation);
      await pg.exec("rollback");
    }
    await assert.rejects(
      pg.exec(
        `update beta_private.delegated_admin_admissions set authority='Changed approval evidence' where user_id='${staff}'`,
      ),
      /immutable/,
    );
    await assert.rejects(
      pg.exec("delete from beta_private.delegated_admin_admissions"),
      /permanent/,
    );
    await assert.rejects(
      pg.query(
        "insert into beta_private.delegated_admin_admissions(user_id,approved_by,authority,enabled) values($1,$2,'No valid role for this attempted approval',true)",
        [member, owner],
      ),
      /named verified admin/,
    );
    for (const role of [
      "anon",
      "authenticated",
      "service_role",
      "docked_app",
      "docked_beta_app",
    ]) {
      await pg.exec(`set role ${role}`);
      await assert.rejects(
        pg.query("select * from beta_private.delegated_admin_admissions"),
        /permission denied/,
      );
      await assert.rejects(
        pg.query(
          "select beta_private.beta_gameplay_identity_before_delegated_admin($1)",
          [staff],
        ),
        /permission denied/,
      );
      if (role === "docked_beta_app") assert.equal(await identity(staff), true);
      else await assert.rejects(identity(staff), /permission denied/);
      await pg.exec("reset role");
    }
    assert.equal(
      (
        await pg.query<{ n: number }>(
          "select count(*)::int n from beta_private.audit_events",
        )
      ).rows[0].n,
      1,
    );
    assert.equal(await identity(owner), true);
  } finally {
    await pg.close();
  }
});
