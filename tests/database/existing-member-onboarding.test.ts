import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { persistExistingMemberProfile } from "../../src/server/existing-member-onboarding";
import type { SignupTransaction } from "../../src/server/signup-profile";
import { onboardingMfaRequired } from "../../src/core/auth-policy";

let pg: PGlite;
const userId = "00000000-0000-4000-8000-000000000811";
const otherId = "00000000-0000-4000-8000-000000000812";
const sessionId = "00000000-0000-4000-8000-000000000813";
const otherSession = "00000000-0000-4000-8000-000000000814";
const actor = { userId, sessionId, aal: "aal1", mfaRequired: false };
const input = {
  country: "AU",
  state: "New South Wales",
  username: "existing_member",
  age: true,
  terms: true,
  privacy: true,
};
const versions = { terms: "reviewed-terms-v2", privacy: "reviewed-privacy-v2" };
let savepoint = 0;
const tx: SignupTransaction = {
  query: async (q, args) =>
    (await pg.query<Record<string, unknown>>(q, args)).rows,
  savepoint: async (run) => {
    const name = `existing_profile_${++savepoint}`;
    await pg.exec(`savepoint ${name}`);
    try {
      await run(tx);
      await pg.exec(`release savepoint ${name}`);
    } catch (e) {
      await pg.exec(`rollback to savepoint ${name}`);
      throw e;
    }
  },
};
before(async () => {
  pg = new PGlite();
  await pg.exec(`create schema auth; create schema private;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous bool default false,banned_until timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);
    create view private.runtime_auth_users as select * from auth.users;
    create view private.runtime_auth_sessions as select * from auth.sessions;
    create table public.profiles(id uuid primary key references auth.users,country text,state text,age_attested bool,accepted_version text,disabled_at timestamptz);
    create table public.notification_preferences(user_id uuid primary key references public.profiles,digest text,education bool,edge_alerts bool);
    create table private.consent_events(id serial primary key,user_id uuid references public.profiles,purpose text,granted bool,version text,actor text);
    create table private.social_profiles(user_id uuid primary key references public.profiles,handle text unique,display_name text);
    create table private.roles(user_id uuid primary key references auth.users,role text);
    create table private.region_policies(id serial primary key,country text,state text,effective_from timestamptz default '2020-01-01',effective_to timestamptz default '2100-01-01',review_at timestamptz default '2100-01-01',preview_community_only bool default false,approved bool,minimum_age int,evidence text,features text[]);
    create table public.isolated_wallets(user_id uuid primary key,balance int);
    insert into private.region_policies(country,state,approved,minimum_age,evidence,features)values('AU','NSW',true,18,'Isolated test policy, not regulatory approval',array['community_social']);`);
  await pg.query<Record<string, unknown>>(
    "insert into auth.users(id,email_confirmed_at)values($1,clock_timestamp()),($2,clock_timestamp())",
    [userId, otherId],
  );
  await pg.query<Record<string, unknown>>(
    "insert into auth.sessions(id,user_id)values($1,$2),($3,$4)",
    [sessionId, userId, otherSession, otherId],
  );
  await pg.query<Record<string, unknown>>(
    "insert into public.isolated_wallets values($1,1234)",
    [otherId],
  );
});
after(async () => {
  await pg?.close();
});
async function isolated(run: () => Promise<void>) {
  await pg.exec("begin");
  try {
    await run();
  } finally {
    await pg.exec("rollback");
  }
}
async function noProfileWrites() {
  assert.equal(
    (await pg.query<Record<string, unknown>>("select * from public.profiles"))
      .rows.length,
    0,
  );
  assert.equal(
    (
      await pg.query<Record<string, unknown>>(
        "select * from private.consent_events",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await pg.query<Record<string, unknown>>(
        "select balance from public.isolated_wallets",
      )
    ).rows[0].balance,
    1234,
  );
}
test("confirmed existing session creates its own profile only after separate current consents; retry preserves records", async () =>
  isolated(async () => {
    assert.equal(
      (
        await persistExistingMemberProfile(
          tx,
          actor,
          { ...input, user_id: otherId, role: "owner", balance: 999999 },
          versions,
        )
      ).created,
      true,
    );
    const [p] = (
      await pg.query<Record<string, unknown>>("select * from public.profiles")
    ).rows;
    assert.equal(p.id, userId);
    assert.equal(p.country, "AU");
    assert.equal(p.state, "NSW");
    const before = (
      await pg.query<Record<string, unknown>>(
        "select * from private.consent_events order by id",
      )
    ).rows;
    assert.equal(
      before.filter(
        (c) =>
          c.purpose === "privacy" &&
          c.granted &&
          c.version === versions.privacy,
      ).length,
      1,
    );
    assert.equal(
      before.filter(
        (c) =>
          c.purpose === "terms" && c.granted && c.version === versions.terms,
      ).length,
      1,
    );
    assert.equal(
      before.filter(
        (c) =>
          ["marketing", "analytics", "education", "edge"].includes(
            String(c.purpose),
          ) && c.granted,
      ).length,
      0,
    );
    assert.equal(
      (
        await persistExistingMemberProfile(
          tx,
          actor,
          { ...input, username: "another_handle" },
          { terms: "other", privacy: "other" },
        )
      ).created,
      false,
    );
    assert.deepEqual(
      (
        await pg.query<Record<string, unknown>>(
          "select * from private.consent_events order by id",
        )
      ).rows,
      before,
    );
    assert.equal(
      (await pg.query<Record<string, unknown>>("select * from private.roles"))
        .rows.length,
      0,
    );
    assert.equal(
      (
        await pg.query<Record<string, unknown>>(
          "select balance from public.isolated_wallets",
        )
      ).rows[0].balance,
      1234,
    );
  }));
test("another account's session cannot bootstrap a profile", async () =>
  isolated(async () => {
    await assert.rejects(
      persistExistingMemberProfile(
        tx,
        { ...actor, sessionId: otherSession },
        input,
        versions,
      ),
      /session inactive/,
    );
    await noProfileWrites();
  }));
test("expired, unconfirmed, anonymous and banned sessions remain denied", async () => {
  for (const mutation of [
    "update auth.sessions set not_after=clock_timestamp()-interval '1 second'",
    "update auth.users set email_confirmed_at=null",
    "update auth.users set is_anonymous=true",
    "update auth.users set banned_until=clock_timestamp()+interval '1 hour'",
  ])
    await isolated(async () => {
      await pg.exec(mutation);
      await assert.rejects(
        persistExistingMemberProfile(tx, actor, input, versions),
        /session inactive/,
      );
      await noProfileWrites();
    });
});
test("staff and previously enrolled authenticators require AAL2 before profile creation", async () =>
  isolated(async () => {
    await pg.query<Record<string, unknown>>(
      "insert into private.roles values($1,'owner')",
      [userId],
    );
    await assert.rejects(
      persistExistingMemberProfile(tx, actor, input, versions),
      /MFA required/,
    );
    await pg.query("delete from private.roles where user_id=$1", [userId]);
    const verifiedFactorRequired = onboardingMfaRequired(false, [
      { status: "verified" },
    ]);
    assert.equal(verifiedFactorRequired, true);
    assert.equal(
      onboardingMfaRequired(false, [{ status: "unverified" }]),
      false,
    );
    await assert.rejects(
      persistExistingMemberProfile(
        tx,
        { ...actor, mfaRequired: verifiedFactorRequired },
        input,
        versions,
      ),
      /MFA required/,
    );
    await noProfileWrites();
    assert.equal(
      (
        await persistExistingMemberProfile(
          tx,
          { ...actor, aal: "aal2" },
          input,
          versions,
        )
      ).created,
      true,
    );
  }));
test("missing, unapproved, expired and superseded regional policy cannot be replaced by beta assumptions", async () => {
  for (const mutation of [
    "delete from private.region_policies",
    "update private.region_policies set approved=false",
    "update private.region_policies set preview_community_only=true",
    "update private.region_policies set review_at=clock_timestamp()-interval '1 second'",
    "update private.region_policies set minimum_age=21",
    "update private.region_policies set features='{}'",
    "insert into private.region_policies(country,state,effective_from,approved,minimum_age,evidence,features)values('AU','NSW',clock_timestamp()-interval '1 hour',false,18,'new restriction',array['community_social'])",
  ])
    await isolated(async () => {
      await pg.exec(mutation);
      await assert.rejects(
        persistExistingMemberProfile(tx, actor, input, versions),
        /configuration pending/,
      );
      await noProfileWrites();
    });
});
test("each consent must be explicit and region valid; disabled profile cannot be revived", async () => {
  for (const field of [
    "age",
    "terms",
    "privacy",
    "country",
    "state",
    "username",
  ])
    await isolated(async () => {
      await assert.rejects(
        persistExistingMemberProfile(
          tx,
          actor,
          { ...input, [field]: undefined },
          versions,
        ),
      );
      await noProfileWrites();
    });
  await isolated(async () => {
    await pg.query<Record<string, unknown>>(
      "insert into public.profiles values($1,'AU','NSW',true,'old',clock_timestamp())",
      [userId],
    );
    await assert.rejects(
      persistExistingMemberProfile(tx, actor, input, versions),
      /Account unavailable/,
    );
    assert.equal(
      (
        await pg.query<Record<string, unknown>>(
          "select * from private.consent_events",
        )
      ).rows.length,
      0,
    );
  });
});
