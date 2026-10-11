import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { invitationSetup } from "../../src/core/invitation-setup";
test("customer eligibility is not account creation: cap, binding, verification, consent and roles", async () => {
  const pg = new PGlite();
  const q = async (s: string, p: any[] = []) =>
    (await pg.query<any>(s, p)).rows;
  try {
    await pg.exec(
      `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;`,
    );
    for (const f of (await readdir("supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort())
      await pg.exec(await readFile("supabase/migrations/" + f, "utf8"));
    const versions = Object.fromEntries(
      [
        "terms",
        "privacy",
        "beta",
        "community",
        "fantasy",
        "competition",
        "responsible_gambling",
      ].map((k) => [k, "fixture-policy"]),
    );
    await q(
      `update beta_private.admission_control set enabled=true,testers_enabled=true,policy_digest=$1,policy_versions=$2,approved_by='isolated-qa',approved_at=clock_timestamp()`,
      ["b".repeat(64), JSON.stringify(versions)],
    );
    await pg.exec(
      `update beta_private.friends_control set enabled=true,readiness_evidence='Isolated disposable QA only; no hosted activation',approved_by='isolated-qa',approved_at=clock_timestamp()`,
    );
    const email = "fresh@example.invalid",
      digest = "a".repeat(64);
    const [invite] = await q(
      `insert into beta_private.customer_invitations(email,token_digest,expires_at,authority) values($1,$2,clock_timestamp()+interval '1 day','Isolated customer journey acceptance only') returning *`,
      [email, digest],
    );
    assert.equal((await q(`select count(*)::int n from auth.users`))[0].n, 0);
    assert.equal(
      (await q(`select count(*)::int n from beta_fantasy.cards`))[0].n,
      0,
    );
    await assert.rejects(
      () =>
        q(`select beta_private.begin_customer_signup($1,$2)`, [
          "outsider@example.invalid",
          digest,
        ]),
      /Invite required/,
    );
    assert.equal(
      (
        await q(`select beta_private.begin_customer_signup($1,$2) id`, [
          email,
          digest,
        ])
      )[0].id,
      invite.intended_user,
    );
    await assert.rejects(
      () =>
        q(`select beta_private.begin_customer_signup($1,$2)`, [email, digest]),
      /wait/,
    );
    await assert.rejects(
      () =>
        q(`select beta_private.finish_customer_signup($1,$2)`, [
          invite.intended_user,
          digest,
        ]),
      /Exact ordinary/,
    );
    await q(`insert into auth.users(id,email) values($1,$2)`, [
      invite.intended_user,
      email,
    ]);
    await q(`select beta_private.finish_customer_signup($1,$2)`, [
      invite.intended_user,
      digest,
    ]);
    await q(`select beta_private.finish_customer_signup($1,$2)`, [
      invite.intended_user,
      digest,
    ]);
    assert.equal(
      (await q(`select count(*)::int n from beta_private.admissions`))[0].n,
      1,
    );
    assert.equal(
      (await q(`select count(*)::int n from beta_public.profiles`))[0].n,
      0,
    );
    assert.equal(
      (
        await q(`select beta_private.customer_signup_identity($1) ok`, [
          invite.intended_user,
        ])
      )[0].ok,
      false,
    );
    const session = randomUUID();
    await q(`insert into auth.sessions(id,user_id) values($1,$2)`, [
      session,
      invite.intended_user,
    ]);
    const accept = (country = "AU", adult = true, sid = session) =>
      q(`select beta_private.accept_customer_admission($1,$2,$3,'VIC',$4,$5)`, [
        invite.intended_user,
        sid,
        country,
        adult,
        JSON.stringify(versions),
      ]);
    await assert.rejects(() => accept(), /Verified/);
    await q(
      `update auth.users set email_confirmed_at=clock_timestamp() where id=$1`,
      [invite.intended_user],
    );
    await assert.rejects(() => accept("US"), /Australian/);
    await assert.rejects(() => accept("AU", false), /Australian/);
    await assert.rejects(
      () => accept("AU", true, randomUUID()),
      /Active session/,
    );
    // A valid full state name from the old free-text form previously reached
    // the strict database boundary unchanged and caused a generic 503.
    await assert.rejects(
      () =>
        q(
          `select beta_private.accept_customer_admission($1,$2,'AU','Queensland',true,$3)`,
          [invite.intended_user, session, JSON.stringify(versions)],
        ),
      /Australian/,
    );
    const normalized = invitationSetup.parse({
      username: "freshfriend",
      country: "AU",
      state: "Queensland",
      age: true,
      terms: true,
      privacy: true,
    });
    await q(
      `select beta_private.accept_customer_admission($1,$2,$3,$4,$5,$6)`,
      [
        invite.intended_user,
        session,
        normalized.country,
        normalized.state,
        normalized.age,
        JSON.stringify(versions),
      ],
    );
    await accept();
    await accept();
    assert.equal(
      (
        await q(
          `select count(*)::int n from beta_private.admission_events where action='accepted'`,
        )
      )[0].n,
      1,
    );
    assert.equal(
      (await q(`select count(*)::int n from beta_fantasy.cards`))[0].n,
      0,
    );
    for (let n = 1; n < 10; n++)
      await q(
        `insert into beta_private.customer_invitations(email,token_digest,expires_at,authority) values($1,$2,clock_timestamp()+interval '1 day','Isolated capacity acceptance only')`,
        [`slot${n}@example.invalid`, n.toString(16).repeat(64)],
      );
    await assert.rejects(
      () =>
        q(
          `insert into beta_private.customer_invitations(email,token_digest,expires_at,authority) values('extra@example.invalid',$1,clock_timestamp()+interval '1 day','Isolated capacity acceptance only')`,
          ["f".repeat(64)],
        ),
      /Ten tester/,
    );
    for (const role of [
      "anon",
      "authenticated",
      "docked_app",
      "docked_beta_app",
    ])
      assert.equal(
        (
          await q(
            `select has_function_privilege($1,'beta_private.finish_customer_signup(uuid,text)','execute') ok`,
            [role],
          )
        )[0].ok,
        false,
      );
  } finally {
    await pg.close();
  }
});
