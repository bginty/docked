import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
test("retained evidence: role/MFA, immutable audit, parent holds, release after removal, erasure and exact retries", async () => {
  const pg = new PGlite(),
    owner = randomUUID(),
    editor = randomUUID(),
    member = randomUUID(),
    post = randomUUID(),
    media = randomUUID(),
    comment = randomUUID(),
    report = randomUUID();
  try {
    await pg.exec(`create role anon;create role authenticated;create role service_role;create role docked_app;create role docked_beta_app;create schema auth;create schema beta_private;create schema beta_public;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function beta_private.active_member_session() returns boolean language sql as $$select true$$;
 create table beta_private.roles(user_id uuid primary key,role text);create table beta_public.profiles(id uuid primary key,disabled_at timestamptz);create table beta_private.social_profiles(user_id uuid,display_name text);
 create table beta_private.social_reports(id uuid primary key,target_type text,target_id uuid,status text,closed_at timestamptz);
 create table beta_private.social_posts(id uuid primary key,body text,moderation_status text,deleted_at timestamptz,updated_at timestamptz);
 create table beta_private.social_comments(id uuid primary key,post_id uuid,body text,moderation_status text,deleted_at timestamptz);
 create table beta_private.social_media(id uuid primary key,status text,content bytea,alt text,reviewed_by uuid,reviewed_at timestamptz);
 create table beta_private.social_post_media(post_id uuid,media_id uuid);
 insert into beta_private.roles values('${owner}','owner'),('${editor}','editor'),('${member}','member');insert into beta_public.profiles(id) select user_id from beta_private.roles;
 insert into beta_private.social_posts values('${post}','Evidence body','visible',null,clock_timestamp());
 insert into beta_private.social_comments values('${comment}','${post}','Comment evidence','removed',null);
 insert into beta_private.social_media values('${media}','rejected','original bytes'::bytea,'Synthetic image',null,null);
 insert into beta_private.social_post_media values('${post}','${media}');insert into beta_private.social_reports values('${report}','post','${post}','open',null);
 grant usage on schema beta_private to docked_beta_app,anon,authenticated,docked_app;`);
    for (const file of [
      "20261016215755_moderation_case_workflow.sql",
      "20261016220848_moderation_evidence_retention.sql",
    ])
      await pg
        .exec(await readFile("supabase/migrations/" + file, "utf8"))
        .catch((error) => {
          console.error(
            file,
            error.position,
            error.internalPosition,
            error.internalQuery,
            error.where,
          );
          throw error;
        });
    const actor = async (id: string, aal = "aal2") =>
      pg.query(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
        [id, JSON.stringify({ sub: id, aal })],
      );
    const mutate = async (p: Record<string, unknown>) =>
      (
        await pg.query<{
          value: { version: number; state: string; review_due_at: string };
        }>(
          "select beta_private.moderation_retention_command($1::jsonb) value",
          [JSON.stringify(p)],
        )
      ).rows[0].value;
    const caseChange = async (p: Record<string, unknown>) =>
      (
        await pg.query<{ value: { version: number; content_hold: boolean } }>(
          "select beta_private.moderation_case_mutate($1::jsonb) value",
          [JSON.stringify(p)],
        )
      ).rows[0].value;
    const input = {
      requestId: randomUUID(),
      targetType: "media",
      targetId: media,
      version: 0,
      action: "retain",
      reason: "Retain synthetic rejected image for incident review",
      confirmation: "",
    };
    const baseCase = {
      requestId: randomUUID(),
      reportId: report,
      version: 0,
      action: "update",
      assignee: owner,
      severity: "high",
      status: "investigating",
      resolution: "pending",
      reason: "Review synthetic incident evidence",
    };
    await pg.exec("set role docked_beta_app");
    await actor(member);
    await assert.rejects(mutate(input), /Role denied/);
    await actor(owner, "aal1");
    await assert.rejects(mutate(input), /MFA/);
    await actor(owner);
    await assert.rejects(
      pg.query("select * from beta_private.moderation_retention"),
      /permission denied/,
    );
    const kept = await mutate(input);
    assert.equal(kept.version, 1);
    assert.deepEqual(await mutate(input), kept);
    const noOp = { ...input, requestId: randomUUID() };
    assert.deepEqual(await mutate(noOp), kept);
    await assert.rejects(
      mutate({ ...noOp, reason: "Different reason must not reuse request" }),
      /request conflict/,
    );
    assert.ok(Date.parse(kept.review_due_at) > Date.now() + 89 * 86400000);
    await caseChange(baseCase);
    await caseChange({
      ...baseCase,
      requestId: randomUUID(),
      version: 1,
      action: "hide",
    });
    const eraseMedia = {
      ...input,
      requestId: randomUUID(),
      version: 1,
      action: "erase",
      confirmation: "ERASE",
    };
    await assert.rejects(mutate(eraseMedia), /parent evidence hold/);
    await mutate({
      ...input,
      requestId: randomUUID(),
      targetType: "comment",
      targetId: comment,
    });
    await assert.rejects(
      mutate({
        ...eraseMedia,
        requestId: randomUUID(),
        targetType: "comment",
        targetId: comment,
      }),
      /parent evidence hold/,
    );
    // Legacy Remove now preserves body and attachment links, then records retention in the same transaction.
    await pg.exec("reset role");
    await pg.query(
      "update beta_private.social_posts set moderation_status='removed' where id=$1",
      [post],
    );
    await pg.exec("set role docked_beta_app");
    const postKept = await mutate({
      ...input,
      requestId: randomUUID(),
      targetType: "post",
      targetId: post,
    });
    assert.equal(postKept.version, 1);
    await assert.rejects(
      mutate({
        ...eraseMedia,
        requestId: randomUUID(),
        targetType: "post",
        targetId: post,
      }),
      /case holds/,
    );
    assert.equal(
      (
        await caseChange({
          ...baseCase,
          requestId: randomUUID(),
          version: 2,
          action: "restore",
        })
      ).content_hold,
      false,
    );
    await assert.rejects(
      mutate({ ...eraseMedia, requestId: randomUUID() }),
      /parent evidence hold/,
    );
    await actor(editor);
    await assert.rejects(
      mutate({
        ...eraseMedia,
        requestId: randomUUID(),
        targetType: "post",
        targetId: post,
      }),
      /Role denied/,
    );
    await actor(owner);
    const restored = await mutate({
      ...input,
      requestId: randomUUID(),
      version: 1,
      targetType: "post",
      targetId: post,
      action: "restore",
    });
    assert.equal(restored.state, "restored");
    await assert.rejects(
      mutate({ ...eraseMedia, confirmation: "" }),
      /confirmation required/,
    );
    const erased = await mutate(eraseMedia);
    assert.equal(erased.state, "erased");
    assert.deepEqual(await mutate(eraseMedia), erased);
    await pg.exec("reset role");
    assert.equal(
      (
        await pg.query<{ body: string }>(
          "select body from beta_private.social_posts where id=$1",
          [post],
        )
      ).rows[0].body,
      "Evidence body",
    );
    assert.equal(
      (
        await pg.query<{ content: null }>(
          "select content from beta_private.social_media where id=$1",
          [media],
        )
      ).rows[0].content,
      null,
    );
    await assert.rejects(
      pg.exec("delete from beta_private.moderation_retention_events"),
      /immutable/,
    );
    // Author erasure wins even if an operational case remains held.
    await pg.exec("set role docked_beta_app");
    await caseChange({
      ...baseCase,
      requestId: randomUUID(),
      version: 3,
      action: "hide",
    });
    await pg.exec("reset role");
    await pg.query(
      "update beta_private.social_posts set body='',moderation_status='removed',deleted_at=clock_timestamp() where id=$1",
      [post],
    );
    await pg.exec("set role docked_beta_app");
    await mutate({
      ...input,
      requestId: randomUUID(),
      targetType: "post",
      targetId: post,
    });
    assert.equal(
      (
        await caseChange({
          ...baseCase,
          requestId: randomUUID(),
          version: 4,
          action: "restore",
        })
      ).content_hold,
      false,
    );
    await assert.rejects(
      mutate({
        ...input,
        requestId: randomUUID(),
        targetType: "post",
        targetId: post,
        version: 3,
        action: "restore",
      }),
      /cannot be restored/,
    );
    await caseChange({
      ...baseCase,
      requestId: randomUUID(),
      version: 5,
      status: "resolved",
      resolution: "action_taken",
    });
    await pg.exec("reset role;set role docked_app");
    await assert.rejects(mutate(input), /permission denied/);
  } finally {
    await pg.close();
  }
});
