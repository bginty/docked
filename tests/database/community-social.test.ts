import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let pg: PGlite;
const user = "10000000-0000-4000-8000-000000000001",
  other = "10000000-0000-4000-8000-000000000002",
  session = "10000000-0000-4000-8000-000000000011",
  otherSession = "10000000-0000-4000-8000-000000000012";
const profile = "20000000-0000-4000-8000-000000000001",
  otherProfile = "20000000-0000-4000-8000-000000000002",
  post = "30000000-0000-4000-8000-000000000001";
before(async () => {
  pg = new PGlite();
  await pg.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`,
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    try {
      await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file}: ${String(error)}`, { cause: error });
    }
  await pg.exec(
    `insert into auth.users(id,email_confirmed_at) values('${user}',now()),('${other}',now());insert into auth.sessions values('${session}','${user}',null),('${otherSession}','${other}',null);insert into public.profiles(id,country,state,age_attested,accepted_version) values('${user}','XX','SOCIAL',true,'fixture'),('${other}','XX','SOCIAL',true,'fixture');insert into public.notification_preferences(user_id)values('${user}'),('${other}');insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence)values('XX','SOCIAL','fixture',now()-interval '1 day',now()+interval '1 day',now()+interval '1 day',true,18,array['community_social','public_profiles','community_edges','leaderboards'],'Isolated test only');insert into private.social_profiles(id,user_id,handle,display_name)values('${profile}','${user}','reader_one','Reader One'),('${otherProfile}','${other}','reader_two','Reader Two');insert into private.social_notification_preferences(profile_id)values('${profile}'),('${otherProfile}');insert into private.social_posts(id,author_id,kind,body)values('${post}','${otherProfile}','discussion','A social opinion, never performance.');`,
  );
  await claims();
});
after(async () => {
  await pg?.close();
});
async function claims(id = user, sid = session) {
  await pg.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [id, JSON.stringify({ sub: id, session_id: sid, aal: "aal2" })],
  );
}
async function rollback(fn: () => Promise<void>) {
  await pg.exec("begin");
  try {
    await fn();
  } finally {
    await pg.exec("rollback");
  }
}
test("all social rows and private helpers deny direct anonymous/member access even with staff claims", async () => {
  const tables = (
    await pg.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname='private' and tablename like 'social_%'",
    )
  ).rows;
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`set role ${role}`);
    for (const row of tables)
      await assert.rejects(
        () => pg.exec(`select * from private.${row.tablename}`),
        /permission denied/,
      );
    await assert.rejects(
      () =>
        pg.query("select private.community_actor($1,$2,true)", [
          user,
          "community_social",
        ]),
      /permission denied/,
    );
    await pg.exec("reset role");
  }
  assert.deepEqual(
    (
      await pg.query(
        "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and relname like 'social_%' and relkind='r' and not relrowsecurity",
      )
    ).rows,
    [],
  );
});
test("official identity and durable ownership cannot be forged or deleted", async () => {
  for (const sql of [
    "update private.social_profiles set display_name='Fake' where handle='docked'",
    "delete from private.social_profiles where handle='docked'",
    `update private.social_profiles set is_official=true where id='${profile}'`,
    `update private.social_profiles set user_id='${other}' where id='${profile}'`,
  ])
    await assert.rejects(() => pg.exec(sql));
  for (const name of [
    "Dоcked",
    "Dockеd",
    "Ｄｏｃｋｅｄ",
    "𝑫𝒐𝒄𝒌𝒆𝒅",
    "Dócked",
    "Official ✓",
  ])
    await assert.rejects(
      () =>
        pg.query(
          "update private.social_profiles set display_name=$1 where id=$2",
          [name, profile],
        ),
      /Protected identity/,
    );
});
test("trusted actor requires matching live session and most recent eligible 18+ policy", async () => {
  assert.equal(
    (
      await pg.query<{ id: string }>(
        "select private.community_actor($1,$2,true) as id",
        [user, "community_social"],
      )
    ).rows[0].id,
    profile,
  );
  await assert.rejects(
    () =>
      pg.query("select private.community_actor($1,$2,true)", [
        other,
        "community_social",
      ]),
    /session/,
  );
  await claims(user, otherSession);
  await assert.rejects(
    () =>
      pg.query("select private.community_actor($1,$2,true)", [
        user,
        "community_social",
      ]),
    /session/,
  );
  await claims();
  await rollback(async () => {
    await pg.exec(
      "update private.region_policies set minimum_age=21 where state='SOCIAL'",
    );
    await assert.rejects(
      () =>
        pg.query("select private.community_actor($1,$2,true)", [
          user,
          "community_social",
        ]),
      /restricted/,
    );
  });
  await rollback(async () => {
    await pg.exec(
      "insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence)values('XX','SOCIAL','new-denial',now()-interval '1 minute',now()+interval '1 day',now()+interval '1 day',false,18,array['community_social'],'isolated denial')",
    );
    assert.equal(
      (
        await pg.query<{ allowed: boolean }>(
          "select private.community_feature_allowed($1,$2) as allowed",
          [user, "community_social"],
        )
      ).rows[0].allowed,
      false,
    );
  });
});
test("private profiles and both directions of blocking hide social posts without deleting them", async () => {
  assert.equal(
    (
      await pg.query<{ visible: boolean }>(
        "select private.social_post_visible($1,$2) as visible",
        [profile, post],
      )
    ).rows[0].visible,
    true,
  );
  await rollback(async () => {
    await pg.query(
      "insert into private.social_blocks(actor_id,target_id)values($1,$2)",
      [otherProfile, profile],
    );
    assert.equal(
      (
        await pg.query<{ visible: boolean }>(
          "select private.social_post_visible($1,$2) as visible",
          [profile, post],
        )
      ).rows[0].visible,
      false,
    );
  });
  await rollback(async () => {
    await pg.query(
      "update private.social_profiles set visibility='private' where id=$1",
      [otherProfile],
    );
    assert.equal(
      (
        await pg.query<{ visible: boolean }>(
          "select private.social_post_visible($1,$2) as visible",
          [profile, post],
        )
      ).rows[0].visible,
      false,
    );
  });
  assert.equal(
    (await pg.query("select id from private.social_posts where id=$1", [post]))
      .rows.length,
    1,
  );
});
test("post access and queued delivery evaluate the actual recipient under the latest feature policy", async () => {
  await rollback(async () => {
    await pg.query(
      "update public.profiles set accepted_version='' where id=$1",
      [other],
    );
    assert.equal(
      (
        await pg.query<{ allowed: boolean }>(
          "select private.community_post_allowed($1,$2) allowed",
          [other, post],
        )
      ).rows[0].allowed,
      false,
    );
  });
  await rollback(async () => {
    await pg.query(
      "update public.profiles set state='NO_APPROVAL' where id=$1",
      [other],
    );
    const rows = (
      await pg.query<{ actor: boolean; recipient: boolean }>(
        "select private.community_post_allowed($1,$3) actor,private.community_post_allowed($2,$3) recipient",
        [user, other, post],
      )
    ).rows;
    assert.equal(rows[0].actor, true);
    assert.equal(rows[0].recipient, false);
  });
  await rollback(async () => {
    await pg.exec(
      "update private.region_policies set features=array['public_profiles'] where state='SOCIAL'",
    );
    assert.equal(
      (
        await pg.query<{ allowed: boolean }>(
          "select private.social_post_visible($1,$2) allowed",
          [profile, post],
        )
      ).rows[0].allowed,
      false,
    );
  });
});
test("post fanout jobs are atomic, durable and deduplicated with the originating post", async () => {
  assert.equal(
    (
      await pg.query<{ n: number }>(
        "select count(*)::int n from private.social_notification_jobs where post_id=$1",
        [post],
      )
    ).rows[0].n,
    1,
  );
  const draft = "30000000-0000-4000-8000-000000000099";
  await rollback(async () => {
    await pg.query(
      "insert into private.social_posts(id,author_id,kind,body) values($1,$2,'discussion','Transaction must roll back.')",
      [draft, profile],
    );
    assert.equal(
      (
        await pg.query<{ n: number }>(
          "select count(*)::int n from private.social_notification_jobs where post_id=$1",
          [draft],
        )
      ).rows[0].n,
      1,
    );
  });
  assert.equal(
    (
      await pg.query<{ n: number }>(
        "select count(*)::int n from private.social_notification_jobs where post_id=$1",
        [draft],
      )
    ).rows[0].n,
    0,
  );
  await pg.query(
    "insert into private.social_notification_jobs(post_id,dedupe_key) values($1,$2) on conflict do nothing",
    [post, `post:${post}`],
  );
  assert.equal(
    (
      await pg.query<{ n: number }>(
        "select count(*)::int n from private.social_notification_jobs where post_id=$1",
        [post],
      )
    ).rows[0].n,
    1,
  );
});
test("social post identity and ledger link cannot be rewritten; removals use tombstones", async () => {
  await assert.rejects(
    () => pg.query("delete from private.social_posts where id=$1", [post]),
    /tombstone/,
  );
  await assert.rejects(
    () =>
      pg.query("update private.social_posts set author_id=$1 where id=$2", [
        profile,
        post,
      ]),
    /immutable/,
  );
  await rollback(async () => {
    await pg.query(
      "update private.social_posts set body='',moderation_status='removed',deleted_at=now() where id=$1",
      [post],
    );
    assert.equal(
      (
        await pg.query("select id from private.social_posts where id=$1", [
          post,
        ])
      ).rows.length,
      1,
    );
  });
});
test("private media requires manual approval and matching owner before attachment", async () => {
  await rollback(async () => {
    const media = (
      await pg.query<{ id: string }>(
        "insert into private.social_media(owner_id,content,sha256,mime,width,height,alt)values($1,decode('0102','hex'),repeat('a',64),'image/webp',2,2,'Isolated media fixture')returning id",
        [otherProfile],
      )
    ).rows[0].id;
    await assert.rejects(
      () =>
        pg.query(
          "insert into private.social_post_media(post_id,media_id,position)values($1,$2,0)",
          [post, media],
        ),
      /approved media/,
    );
  });
  // Failure above aborts its transaction, then a separate approved fixture proves the positive boundary.
  await rollback(async () => {
    const media = (
      await pg.query<{ id: string }>(
        "insert into private.social_media(owner_id,content,sha256,mime,width,height,alt,status)values($1,decode('0102','hex'),repeat('b',64),'image/webp',2,2,'Approved isolated fixture','approved')returning id",
        [otherProfile],
      )
    ).rows[0].id;
    await pg.query(
      "insert into private.social_post_media(post_id,media_id,position)values($1,$2,0)",
      [post, media],
    );
    assert.equal(
      (
        await pg.query(
          "select media_id from private.social_post_media where post_id=$1",
          [post],
        )
      ).rows.length,
      1,
    );
  });
});
test("thread parent must belong to the same post and depth is bounded", async () => {
  const add = async (parent: string | null) =>
    (
      await pg.query<{ id: string }>(
        "insert into private.social_comments(post_id,author_id,parent_id,body,idempotency_key)values($1,$2,$3,$4,gen_random_uuid())returning id",
        [post, profile, parent, "Test thread"],
      )
    ).rows[0].id;
  const first = await add(null),
    second = await add(first),
    third = await add(second);
  await assert.rejects(() => add(third), /maximum depth/);
  const otherPost = (
    await pg.query<{ id: string }>(
      "insert into private.social_posts(author_id,kind,body)values($1,'discussion','Other test thread')returning id",
      [profile],
    )
  ).rows[0].id;
  await assert.rejects(
    () =>
      pg.query(
        "insert into private.social_comments(post_id,author_id,parent_id,body,idempotency_key)values($1,$2,$3,$4,gen_random_uuid())",
        [otherPost, profile, first, "Wrong parent"],
      ),
    /Invalid reply/,
  );
});
test("notification settings are private, email/push cannot activate and recipient ownership is enforced by revoked writes", async () => {
  await assert.rejects(
    () =>
      pg.query(
        "update private.social_notification_preferences set email=true where profile_id=$1",
        [profile],
      ),
    /check constraint/,
  );
  await assert.rejects(
    () =>
      pg.query(
        "update private.social_notification_preferences set push=true where profile_id=$1",
        [profile],
      ),
    /check constraint/,
  );
  await pg.exec("set role authenticated");
  await assert.rejects(
    () =>
      pg.query(
        "insert into private.social_notifications(recipient_id,type,title,href,group_key,dedupe_key)values($1,$2,$3,$4,$5,$6)",
        [otherProfile, "system", "Forged", "/notifications", "test", "test"],
      ),
    /permission denied/,
  );
  await pg.exec("reset role");
});
test("account erasure purges personal social content but preserves durable referenced records and the other member", async () => {
  await pg.exec(
    "create table private.social_ledger_test(profile_id uuid references private.social_profiles(id),result text)",
  );
  await pg.query("insert into private.social_ledger_test values($1,'lost')", [
    profile,
  ]);
  await pg.query(
    "insert into private.social_follows(actor_id,target_id)values($1,$2)",
    [profile, otherProfile],
  );
  await pg.query(
    "insert into private.social_saved(profile_id,post_id)values($1,$2),($3,$2)",
    [profile, post, otherProfile],
  );
  await pg.query("select private.disable_account($1)", [user]);
  const erased = (
    await pg.query<{
      user_id: null;
      display_name: string;
      bio: string;
      status: string;
    }>(
      "select user_id,display_name,bio,status from private.social_profiles where id=$1",
      [profile],
    )
  ).rows[0];
  assert.deepEqual(erased, {
    user_id: null,
    display_name: "Deleted member",
    bio: "",
    status: "deleted",
  });
  assert.deepEqual(
    (
      await pg.query(
        "select result from private.social_ledger_test where profile_id=$1",
        [profile],
      )
    ).rows,
    [{ result: "lost" }],
  );
  assert.equal(
    (
      await pg.query("select * from private.social_saved where profile_id=$1", [
        profile,
      ])
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await pg.query("select * from private.social_saved where profile_id=$1", [
        otherProfile,
      ])
    ).rows.length,
    1,
  );
  assert.equal(
    (await pg.query("select * from auth.sessions where user_id=$1", [user]))
      .rows.length,
    0,
  );
  assert.equal(
    (
      await pg.query(
        "select body from private.social_comments where author_id=$1 and body<>$2",
        [profile, ""],
      )
    ).rows.length,
    0,
  );
});
