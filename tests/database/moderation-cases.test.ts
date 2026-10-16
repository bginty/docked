import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type {
  ModerationCase,
  ModerationCaseMutation,
  ModerationCaseView,
} from "../../src/core/moderation-cases";
test("moderation case SQL: role/assignment authority, atomic metadata/audit, reversible holds and competing reports", async () => {
  const pg = new PGlite(),
    owner = randomUUID(),
    editor = randomUUID(),
    other = randomUUID(),
    auditor = randomUUID(),
    member = randomUUID(),
    post = randomUUID(),
    report = randomUUID(),
    secondReport = randomUUID();
  try {
    await pg.exec(`create role anon;create role authenticated;create role service_role;create role docked_app;create role docked_beta_app;
      create schema auth;create schema beta_private;create schema beta_public;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function beta_private.active_member_session() returns boolean language sql as $$select coalesce(current_setting('fixture.active',true),'')='true'$$;
      create table beta_private.roles(user_id uuid primary key,role text);
      create table beta_public.profiles(id uuid primary key,disabled_at timestamptz);
      create table beta_private.social_profiles(user_id uuid,display_name text);
      create table beta_private.social_reports(id uuid primary key,target_type text,target_id uuid,status text,closed_at timestamptz);
      create table beta_private.social_posts(id uuid primary key,body text,moderation_status text,deleted_at timestamptz,updated_at timestamptz);
      create table beta_private.social_comments(id uuid primary key,body text,moderation_status text,deleted_at timestamptz);
      insert into beta_private.roles values('${owner}','owner'),('${editor}','editor'),('${other}','editor'),('${auditor}','auditor'),('${member}','member');
      insert into beta_public.profiles(id) select user_id from beta_private.roles;
      insert into beta_private.social_profiles values('${owner}','Fixture owner');
      insert into beta_private.social_reports values('${report}','post','${post}','open',null),('${secondReport}','post','${post}','open',null);
      insert into beta_private.social_posts values('${post}','Original evidence stays in its own record','visible',null,clock_timestamp());
      grant usage on schema beta_private to docked_beta_app,anon,authenticated;`);
    await pg.exec(
      await readFile(
        "supabase/migrations/20261016215755_moderation_case_workflow.sql",
        "utf8",
      ),
    );
    async function actor(id: string, aal = "aal2", active = "true") {
      await pg.query(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('fixture.active',$3,false)",
        [id, JSON.stringify({ sub: id, aal }), active],
      );
    }
    async function mutate(input: ModerationCaseMutation) {
      return (
        await pg.query<{ value: ModerationCase }>(
          "select beta_private.moderation_case_mutate($1::jsonb) value",
          [JSON.stringify(input)],
        )
      ).rows[0].value;
    }
    async function read(id = report) {
      return (
        await pg.query<{ value: ModerationCaseView }>(
          "select beta_private.moderation_case_read($1) value",
          [id],
        )
      ).rows[0].value;
    }
    const initial: ModerationCaseMutation = {
      requestId: randomUUID(),
      reportId: report,
      version: 0,
      action: "update",
      assignee: editor,
      severity: "medium",
      status: "investigating",
      resolution: "pending",
      reason: "Review a synthetic report",
    };
    await pg.exec("set role docked_beta_app");
    await actor(member);
    await assert.rejects(read(), /Role denied/);
    await actor(owner, "aal1");
    await assert.rejects(mutate(initial), /Staff MFA required/);
    await actor(owner, "aal2", "false");
    await assert.rejects(mutate(initial), /Staff MFA required/);
    await actor(owner);
    await assert.rejects(
      pg.query("select * from beta_private.moderation_cases"),
      /permission denied/,
    );
    const created = await mutate(initial);
    assert.equal(created.version, 1);
    assert.deepEqual(await mutate(initial), created);
    await assert.rejects(
      mutate({ ...initial, severity: "urgent" }),
      /request conflict/,
    );
    await assert.rejects(
      mutate({ ...initial, requestId: randomUUID() }),
      /version conflict/,
    );
    await actor(other);
    await assert.rejects(
      mutate({
        ...initial,
        requestId: randomUUID(),
        version: 1,
        assignee: other,
      }),
      /assignment denied/,
    );
    await actor(editor);
    const hide = {
      ...initial,
      requestId: randomUUID(),
      version: 1,
      action: "hide" as const,
    };
    const held = await mutate(hide);
    assert.equal(held.content_hold, true);
    assert.ok(held.review_due_at);
    assert.equal((await read()).targetStatus, "review");
    const due = Date.parse(held.review_due_at!);
    assert.ok(
      due > Date.now() + 89 * 86400000 && due < Date.now() + 91 * 86400000,
    );
    await assert.rejects(
      mutate({
        ...initial,
        requestId: randomUUID(),
        version: 2,
        status: "resolved",
        resolution: "action_taken",
      }),
      /Release content hold/,
    );
    await actor(owner);
    const second = {
      ...initial,
      reportId: secondReport,
      assignee: owner,
      requestId: randomUUID(),
    };
    await mutate(second);
    await mutate({
      ...second,
      action: "hide",
      version: 1,
      requestId: randomUUID(),
    });
    await mutate({
      ...initial,
      action: "restore",
      version: 2,
      requestId: randomUUID(),
    });
    assert.equal(
      (await read()).targetStatus,
      "review",
      "first release must not override the second hold",
    );
    await mutate({
      ...second,
      action: "restore",
      version: 2,
      requestId: randomUUID(),
    });
    assert.equal((await read()).targetStatus, "visible");
    await mutate({
      ...initial,
      requestId: randomUUID(),
      version: 3,
      status: "resolved",
      resolution: "no_action",
    });
    assert.equal((await read()).reportStatus, "dismissed");
    await actor(auditor);
    assert.equal((await read()).canWrite, false);
    await assert.rejects(
      mutate({ ...initial, requestId: randomUUID(), version: 4 }),
      /Role denied/,
    );
    await pg.exec("reset role");
    assert.equal(
      (
        await pg.query<{ body: string }>(
          "select body from beta_private.social_posts where id=$1",
          [post],
        )
      ).rows[0].body,
      "Original evidence stays in its own record",
    );
    await pg.query(
      "update beta_private.social_posts set moderation_status='removed' where id=$1",
      [post],
    );
    await pg.exec("set role docked_beta_app");
    await actor(owner);
    await assert.rejects(
      mutate({
        ...second,
        action: "hide",
        version: 3,
        requestId: randomUUID(),
      }),
      /Content state changed/,
    );
    await pg.exec("reset role");
    await assert.rejects(
      pg.query("delete from beta_private.moderation_case_events"),
      /immutable/,
    );
    await pg.exec("set role anon");
    await assert.rejects(read(), /permission denied/);
  } finally {
    await pg.close();
  }
});

