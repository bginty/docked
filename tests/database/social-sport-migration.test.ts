import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("historical sport classification uses card evidence, retains ambiguous posts and protects new posts", async () => {
  const pg = new PGlite();
  const user = "10000000-0000-4000-8000-000000000001",
    profile = "20000000-0000-4000-8000-000000000001";
  try {
    await pg.exec(
      `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;`,
    );
    for (const file of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      if (file.endsWith("_sport_social_and_pack_entitlements.sql")) {
        await pg.exec(
          `insert into auth.users(id,email_confirmed_at)values('${user}',clock_timestamp());`,
        );
        await pg.exec(
          `update beta_private.admission_control set enabled=true,policy_digest=repeat('a',64),policy_versions='{"terms":"fixture","privacy":"fixture","beta":"fixture","community":"fixture","fantasy":"fixture","competition":"fixture","responsible_gambling":"fixture"}',approved_by='Isolated fixture',approved_at=clock_timestamp() where id;`,
        );
        await pg.query(
          "insert into beta_private.admissions(email,user_id,token_digest,request_id,expires_at)values('fixture@example.invalid',$1,repeat('a',64),gen_random_uuid(),clock_timestamp()+interval '1 day')",
          [user],
        );
        await pg.query(
          "update beta_private.admissions set status='accepted',accepted_at=clock_timestamp(),country='AU',state='NSW',age_attested=true,policy_digest=repeat('a',64),policy_versions=(select policy_versions from beta_private.admission_control where id) where user_id=$1",
          [user],
        );
        // This test exercises historical migration integrity, not hosted admission.
        await pg.exec(
          `create or replace function beta_private.admitted(p_user uuid) returns boolean language sql as $$select exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null)$$;`,
        );
        for (const schema of ["private", "beta_private"]) {
          const publicSchema = schema === "private" ? "public" : "beta_public";
          await pg.exec(
            `insert into ${publicSchema}.profiles(id,country,state,age_attested,accepted_version)values('${user}','AU','NSW',true,'fixture');`,
          );
          await pg.exec(
            `insert into ${schema}.social_profiles(id,user_id,handle,display_name)values('${profile}','${user}','fixture_user','Isolated Fixture');`,
          );
          for (const [body, sport, cards] of [
            ["Reliable", null, [{ sport: "afl" }]],
            ["Ambiguous", null, []],
            ["Conflicting", "nfl", [{ sport: "nrl" }]],
            ["Known", "nrl", []],
            ["Unknown attachment", null, [{sport:"afl"},{sport:"unverified"}]],
          ] as const)
            await pg.query(
              `insert into ${schema}.social_posts(author_id,kind,body,sport,card_snapshots)values($1,'discussion',$2,$3,$4)`,
              [profile, body, sport, JSON.stringify(cards)],
            );
          await pg.query(
            `insert into ${schema}.social_comments(post_id,author_id,body,idempotency_key)select id,$1,'Preserved comment',gen_random_uuid() from ${schema}.social_posts where body='Ambiguous'`,
            [profile],
          );
          await pg.query(
            `insert into ${schema}.social_reactions(post_id,profile_id)select id,$1 from ${schema}.social_posts where body='Reliable'`,
            [profile],
          );
        }
      }
      await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    }
    for (const schema of ["private", "beta_private"]) {
      const rows = (
        await pg.query<{ body: string; sport: string | null }>(
          `select body,sport from ${schema}.social_posts order by body`,
        )
      ).rows;
      assert.deepEqual(rows, [
        { body: "Ambiguous", sport: null },
        { body: "Conflicting", sport: "nfl" },
        { body: "Known", sport: "nrl" },
        { body: "Reliable", sport: "afl" },
        { body: "Unknown attachment", sport: null },
      ]);
      assert.equal(
        (await pg.query(`select * from ${schema}.social_sport_review`)).rows
          .length,
        3,
      );
      assert.equal(
        (await pg.query(`select * from ${schema}.social_comments`)).rows.length,
        1,
      );
      assert.equal(
        (await pg.query(`select * from ${schema}.social_reactions`)).rows
          .length,
        1,
      );
      await assert.rejects(
        pg.query(
          `insert into ${schema}.social_posts(author_id,kind,body)values($1,'discussion','Missing sport')`,
          [profile],
        ),
        /Choose NFL/,
      );
      await assert.rejects(
        pg.query(
          `insert into ${schema}.social_posts(author_id,kind,body,sport,card_snapshots)values($1,'discussion','Wrong card','afl','[{"sport":"nrl"}]')`,
          [profile],
        ),
        /match the post sport/,
      );
      await assert.rejects(
        pg.query(
          `update ${schema}.social_posts set sport='afl' where body='Known'`,
        ),
        /immutable/,
      );
    }
  } finally {
    await pg.close();
  }
});
