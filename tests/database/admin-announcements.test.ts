import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type {
  AnnouncementMutation,
  AnnouncementDraft,
} from "../../src/core/admin-announcements";

test("announcement persistence: real SQL authorization, concurrency, independent review, replay and immutable audit", async () => {
  const pg = new PGlite();
  const owner = randomUUID(),
    editor = randomUUID(),
    admin = randomUUID(),
    auditor = randomUUID(),
    member = randomUUID();
  try {
    await pg.exec(`create role anon;create role authenticated;create role service_role;create role docked_app;create role docked_beta_app;
      create schema auth;create schema beta_private;
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function beta_private.active_member_session() returns boolean language sql as $$select coalesce(current_setting('fixture.active',true),'')='true'$$;
      create table beta_private.roles(user_id uuid primary key,role text);
      insert into beta_private.roles values('${owner}','owner'),('${editor}','editor'),('${admin}','admin'),('${auditor}','auditor'),('${member}','member');
      grant usage on schema beta_private to docked_beta_app,anon,authenticated,service_role;`);
    await pg.exec(
      await readFile(
        "supabase/migrations/20261016214135_admin_announcement_drafts.sql",
        "utf8",
      ),
    );
    async function actor(id: string, aal = "aal2", active = "true") {
      await pg.query(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('fixture.active',$3,false)",
        [id, JSON.stringify({ sub: id, aal }), active],
      );
    }
    async function mutate(p: AnnouncementMutation) {
      return (
        await pg.query<{ value: AnnouncementDraft }>(
          "select beta_private.announcement_mutate($1::jsonb) value",
          [JSON.stringify(p)],
        )
      ).rows[0].value;
    }
    const create: AnnouncementMutation = {
      requestId: randomUUID(),
      id: randomUUID(),
      action: "create",
      version: 0,
      title: "Fixture announcement",
      body: "A test draft, never delivered.",
      audience: "admitted",
      reason: "Prepare test draft",
    };
    await pg.exec("set role docked_beta_app");
    await actor(member);
    await assert.rejects(mutate(create), /Role denied/);
    await actor(owner, "aal1");
    await assert.rejects(mutate(create), /Staff MFA required/);
    await actor(owner, "aal2", "false");
    await assert.rejects(mutate(create), /Staff MFA required/);
    await actor(editor);
    await assert.rejects(
      pg.query("select beta_private.announcement_mutate($1::jsonb)", [
        JSON.stringify({ ...create, audience: null }),
      ]),
      /Invalid announcement/,
    );
    await assert.rejects(
      pg.query("select * from beta_private.announcement_drafts"),
      /permission denied/,
    );
    const first = await mutate(create);
    assert.equal(first.version, 1);
    assert.equal(first.created_by, editor);
    assert.deepEqual(
      await mutate(create),
      first,
      "lost response replay returns exact receipt",
    );
    await assert.rejects(
      mutate({ ...create, title: "Changed" }),
      /request conflict/,
    );
    const edit = {
      ...create,
      action: "save" as const,
      requestId: randomUUID(),
      version: 1,
      title: "Updated announcement",
    };
    const second = await mutate(edit);
    assert.equal(second.version, 2);
    await assert.rejects(
      mutate({ ...edit, requestId: randomUUID() }),
      /version conflict/,
      "stale concurrent editor cannot overwrite",
    );
    const submit = {
      ...edit,
      action: "submit" as const,
      requestId: randomUUID(),
      version: 2,
    };
    const third = await mutate(submit);
    assert.equal(third.status, "in_review");
    await assert.rejects(
      mutate({
        ...submit,
        requestId: randomUUID(),
        action: "save",
        version: 3,
      }),
      /state denied/,
    );
    await assert.rejects(
      mutate({
        ...submit,
        requestId: randomUUID(),
        action: "approve",
        version: 3,
      }),
      /independent reviewer/i,
    );
    await actor(owner);
    const approved = await mutate({
      ...submit,
      requestId: randomUUID(),
      action: "approve",
      version: 3,
      reason: "Independently reviewed draft",
    });
    assert.equal(approved.status, "approved");
    assert.equal(approved.version, 4);
    const archived = await mutate({
      ...submit,
      requestId: randomUUID(),
      action: "archive",
      version: 4,
    });
    assert.equal(archived.status, "archived");
    const restored = await mutate({
      ...submit,
      requestId: randomUUID(),
      action: "restore",
      version: 5,
    });
    assert.equal(restored.status, "draft");
    assert.equal(restored.version, 6);
    await actor(auditor);
    const list = await pg.query<{
      value: { drafts: AnnouncementDraft[]; canWrite: boolean };
    }>("select beta_private.announcement_list(1) value");
    assert.equal(list.rows[0].value.drafts[0].id, create.id);
    assert.equal(list.rows[0].value.canWrite, false);
    await assert.rejects(
      mutate({ ...edit, requestId: randomUUID(), version: 6 }),
      /Role denied/,
    );
    const history = await pg.query<{ value: { version: number }[] }>(
      "select beta_private.announcement_history($1) value",
      [create.id],
    );
    assert.deepEqual(
      history.rows[0].value.map((e) => e.version),
      [6, 5, 4, 3, 2, 1],
    );
    await actor(admin);
    const own = { ...create, requestId: randomUUID(), id: randomUUID() };
    await mutate(own);
    await mutate({
      ...own,
      requestId: randomUUID(),
      action: "submit",
      version: 1,
    });
    await assert.rejects(
      mutate({
        ...own,
        requestId: randomUUID(),
        action: "approve",
        version: 2,
      }),
      /independent reviewer/i,
    );
    await actor(editor);
    await assert.rejects(
      mutate({
        ...own,
        requestId: randomUUID(),
        action: "archive",
        version: 2,
      }),
      /Role denied/,
    );
    // A reviewer who last edited content cannot approve after another staff member submits it.
    await actor(owner);
    const independent = {
      ...create,
      requestId: randomUUID(),
      id: randomUUID(),
    };
    await mutate(independent);
    await actor(admin);
    await mutate({
      ...independent,
      requestId: randomUUID(),
      action: "save",
      version: 1,
    });
    await actor(owner);
    await mutate({
      ...independent,
      requestId: randomUUID(),
      action: "submit",
      version: 2,
    });
    await actor(admin);
    await assert.rejects(
      mutate({
        ...independent,
        requestId: randomUUID(),
        action: "approve",
        version: 3,
      }),
      /independent reviewer/i,
    );
    await actor(owner);
    assert.equal((await mutate({ ...independent, requestId: randomUUID(), action: "approve", version: 3, reason: "Owner confirms draft approval only" })).status, "approved");
    await pg.exec("reset role");
    assert.equal(
      (
        await pg.query<{ n: number }>(
          "select count(*)::int n from beta_private.announcement_events",
        )
      ).rows[0].n,
      12,
    );
    await assert.rejects(
      pg.query("update beta_private.announcement_events set reason='tamper'"),
      /immutable/,
    );
    await assert.rejects(
      pg.query("delete from beta_private.announcement_events"),
      /immutable/,
    );
    await pg.exec("set role anon");
    await assert.rejects(
      pg.query("select beta_private.announcement_list(1)"),
      /permission denied/,
    );
    await pg.exec("reset role; set role authenticated");
    await assert.rejects(
      pg.query("select beta_private.announcement_history($1)", [create.id]),
      /permission denied/,
    );
  } finally {
    await pg.close();
  }
});


