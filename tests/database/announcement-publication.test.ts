import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
test("publication is private until approved, authorised, immutable on replay and independent from draft edits", async () => {
  const pg = new PGlite(),
    owner = randomUUID(),
    member = randomUUID(),
    editor = randomUUID();
  try {
    await pg.exec(`create role anon;create role authenticated;create role service_role;create role docked_app;create role docked_beta_app;create schema auth;create schema beta_private;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function beta_private.active_member_session() returns boolean language sql as $$select current_setting('fixture.active',true)='true'$$;
 create function beta_private.admitted(uuid) returns boolean language sql as $$select true$$;
 create table beta_private.roles(user_id uuid primary key,role text);
 insert into beta_private.roles values('${owner}','owner'),('${member}','member'),('${editor}','editor');
 grant usage on schema beta_private to docked_beta_app,anon,authenticated,service_role;`);
    await pg.exec(
      await readFile(
        "supabase/migrations/20261016214135_admin_announcement_drafts.sql",
        "utf8",
      ),
    );
    const release = await readFile(
      "supabase/migrations/20261019050004_member_platform_updates.sql",
      "utf8",
    );
    await pg.exec(release.split("-- END ANNOUNCEMENTS")[0]);
    const cleanup = await readFile(
      "supabase/migrations/20261021104437_member_community_pack_integrity.sql",
      "utf8",
    );
    await pg.exec(
      cleanup.slice(
        cleanup.indexOf(
          "create or replace function beta_private.member_announcements",
        ),
        cleanup.indexOf(
          "revoke all on function credits_sandbox.guard_pack_coupons",
        ),
      ),
    );
    await pg.exec("set role docked_beta_app");
    const actor = async (id: string, aal = "aal2", active = "true") =>
      pg.query(
        "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('fixture.active',$3,false)",
        [id, JSON.stringify({ sub: id, aal }), active],
      );
    const read = async () =>
      (await pg.query<any>("select beta_private.member_announcements() v"))
        .rows[0].v;
    let p: any = {
      requestId: randomUUID(),
      id: randomUUID(),
      action: "create",
      version: 0,
      title: "Isolated announcement",
      body: "<script>unsafe()</script> shown as plain text",
      audience: "admitted",
      reason: "Isolated acceptance",
      cta: "/fantasy/prizes",
    };
    const mutate = async (input = p) =>
      (
        await pg.query<any>(
          "select beta_private.announcement_mutate($1::jsonb) v",
          [JSON.stringify(input)],
        )
      ).rows[0].v;
    await actor(member);
    await assert.rejects(mutate(), /Role denied/);
    await actor(owner, "aal1");
    await assert.rejects(mutate(), /MFA/);
    await actor(owner);
    let d = await mutate();
    assert.equal((await read()).length, 0);
    assert.deepEqual(await mutate(), d);
    p = {
      ...p,
      requestId: randomUUID(),
      version: d.version,
      action: "publish",
    };
    await assert.rejects(mutate(), /Approved/);
    p = { ...p, requestId: randomUUID(), action: "submit" };
    d = await mutate();
    p = {
      ...p,
      requestId: randomUUID(),
      version: d.version,
      action: "approve",
    };
    d = await mutate();
    assert.equal((await read()).length, 0);
    p = {
      ...p,
      requestId: randomUUID(),
      version: d.version,
      action: "publish",
    };
    await actor(editor);
    await assert.rejects(mutate(), /Role denied|publisher/);
    await actor(owner);
    d = await mutate();
    const published = await read();
    assert.equal(published.length, 1);
    assert.equal(published[0].cta, "/fantasy/prizes");
    assert.equal(published[0].body, p.body);
    assert.deepEqual(await mutate(), d);
    p = { ...p, requestId: randomUUID(), version: d.version, action: "pin" };
    d = await mutate();
    assert.equal((await read())[0].pinned, true);
    const stale = { ...p, requestId: randomUUID(), action: "unpin" };
    await assert.rejects(mutate(stale), /version conflict/);
    p = {
      ...p,
      requestId: randomUUID(),
      version: d.version,
      action: "save",
      body: "Private unpublished edit",
    };
    d = await mutate();
    assert.equal((await read())[0].body, published[0].body);
    assert.equal((await read())[0].published_at, published[0].published_at);
    assert.equal((await read())[0].edited_at, published[0].edited_at);
    await assert.rejects(
      mutate({
        ...p,
        requestId: randomUUID(),
        version: d.version,
        cta: "//evil.example",
      }),
      /Internal destination/,
    );
    await actor(member);
    assert.equal((await read()).length, 1);
    await assert.rejects(
      pg.query("select * from beta_private.announcement_drafts"),
      /permission/,
    );
    await actor(owner);
    p = {
      ...p,
      requestId: randomUUID(),
      version: d.version,
      action: "archive",
    };
    d = await mutate();
    assert.equal((await read()).length, 0);
    p = {
      ...p,
      requestId: randomUUID(),
      version: d.version,
      action: "restore",
    };
    d = await mutate();
    assert.equal(d.published, null);
    assert.equal((await read()).length, 0);
    await actor(member, "aal1", "false");
    await assert.rejects(read(), /Active admitted/);
  } finally {
    await pg.close();
  }
});
