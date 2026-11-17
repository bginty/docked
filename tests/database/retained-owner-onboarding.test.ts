import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { renewRetainedOwnerProfile } from "../../src/server/retained-owner-onboarding";
import type { SignupTransaction } from "../../src/server/signup-profile";
let pg: PGlite;
const uid = "00000000-0000-4000-8000-000000000911",
  sid = "00000000-0000-4000-8000-000000000912";
const actor = { userId: uid, sessionId: sid, aal: "aal2" };
const input = {
  country: "AU",
  state: "NSW",
  username: "retained_owner",
  age: true,
  terms: true,
  privacy: true,
};
const versions = { terms: "commercial-v1", privacy: "privacy-v5" };
const tx: SignupTransaction = {
  query: async (q, args) =>
    (await pg.query<Record<string, unknown>>(q, args)).rows,
  savepoint: async (f) => f(tx),
};
before(async () => {
  pg = new PGlite();
  await pg.exec(`create schema private;
create table public.profiles(id uuid primary key,country text,state text,age_attested boolean,accepted_version text,disabled_at timestamptz);
create table private.roles(user_id uuid primary key,role text);
create table private.runtime_auth_users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean,banned_until timestamptz);
create table private.runtime_auth_sessions(id uuid primary key,user_id uuid,not_after timestamptz);
create table private.consent_events(id serial primary key,user_id uuid,purpose text,granted boolean,version text,actor text,created_at timestamptz default clock_timestamp());
create table private.social_profiles(user_id uuid primary key,handle text unique,display_name text);
create table private.region_policies(id serial primary key,country text,state text,approved boolean,minimum_age int,review_at timestamptz,effective_from timestamptz,effective_to timestamptz,features text[],evidence text,preview_community_only boolean);
create table private.transition_fixture(allowed boolean,beta_ended boolean);
insert into private.transition_fixture values(true,true);
create function private.commercial_transition_status(uuid)returns jsonb language sql as $$select jsonb_build_object('allowed',allowed,'betaEnded',beta_ended)from private.transition_fixture$$;
insert into private.region_policies(country,state,approved,minimum_age,review_at,effective_from,effective_to,features,evidence,preview_community_only)values('AU','NSW',true,18,'2100-01-01','2020-01-01','2100-01-01',array['community_social'],'Synthetic eligibility',false);
insert into public.profiles values('${uid}','AU','NSW',true,'beta-old',null);
insert into private.roles values('${uid}','owner');
insert into private.runtime_auth_users values('${uid}',now(),false,null);
insert into private.runtime_auth_sessions values('${sid}','${uid}',null);
insert into private.consent_events(user_id,purpose,granted,version,actor)values('${uid}','terms',true,'beta-old','${uid}'),('${uid}','privacy',true,'beta-old','${uid}');
create table private.historical_assets(doc jsonb);insert into private.historical_assets values('{"credits":100000,"serial":1,"hold":5700}');`);
});
after(async () => pg.close());
async function isolated(run: () => Promise<void>) {
  await pg.exec("begin");
  try {
    await run();
  } finally {
    await pg.exec("rollback");
  }
}
test("Owner explicitly renews notices once, retaining history and zero commercial advantages", () =>
  isolated(async () => {
    const before = (await pg.query("select * from private.historical_assets"))
      .rows;
    assert.deepEqual(
      await renewRetainedOwnerProfile(tx, actor, input, versions),
      { renewed: true },
    );
    assert.deepEqual(
      await renewRetainedOwnerProfile(tx, actor, input, versions),
      { renewed: false },
    );
    assert.equal(
      (await pg.query("select * from private.consent_events")).rows.length,
      5,
    );
    assert.equal(
      (
        await pg.query(
          "select * from private.consent_events where version='beta-old'",
        )
      ).rows.length,
      2,
    );
    assert.equal(
      (await pg.query("select * from private.social_profiles")).rows.length,
      1,
    );
    assert.deepEqual(
      (await pg.query("select * from private.historical_assets")).rows,
      before,
    );
    assert.equal(
      (await pg.query("select * from public.profiles")).rows.length,
      1,
    );
  }));
test("Owner MFA cannot be skipped", () =>
  isolated(async () => {
    await assert.rejects(
      renewRetainedOwnerProfile(tx, { ...actor, aal: "aal1" }, input, versions),
      /Owner MFA/,
    );
  }));
test("Admin and ordinary customers cannot use retained Owner renewal", () =>
  isolated(async () => {
    await pg.exec("update private.roles set role='admin'");
    await assert.rejects(
      renewRetainedOwnerProfile(tx, actor, input, versions),
      /Retained Owner/,
    );
    await pg.exec("delete from private.roles");
    await assert.rejects(
      renewRetainedOwnerProfile(tx, actor, input, versions),
      /Retained Owner/,
    );
  }));
test("Retirement and incomplete containment deny old sessions", () =>
  isolated(async () => {
    await pg.exec("update private.transition_fixture set allowed=false");
    await assert.rejects(
      renewRetainedOwnerProfile(tx, actor, input, versions),
      /Retained Owner/,
    );
    await pg.exec(
      "update private.transition_fixture set allowed=true,beta_ended=false",
    );
    await assert.rejects(
      renewRetainedOwnerProfile(tx, actor, input, versions),
      /Retained Owner/,
    );
  }));
test("A missing retained profile is never automatically created", () =>
  isolated(async () => {
    await pg.exec("delete from public.profiles");
    await assert.rejects(
      renewRetainedOwnerProfile(tx, actor, input, versions),
      /Retained Owner/,
    );
    assert.equal(
      (await pg.query("select * from public.profiles")).rows.length,
      0,
    );
  }));
test("Expired and mismatched sessions fail", () =>
  isolated(async () => {
    await pg.exec(
      "update private.runtime_auth_sessions set not_after='2020-01-01'",
    );
    await assert.rejects(
      renewRetainedOwnerProfile(tx, actor, input, versions),
      /Retained Owner/,
    );
  }));
test("No implicit commercial consent or US beta exemption", () =>
  isolated(async () => {
    await assert.rejects(
      renewRetainedOwnerProfile(
        tx,
        actor,
        { ...input, terms: false },
        versions,
      ),
    );
    await assert.rejects(
      renewRetainedOwnerProfile(
        tx,
        actor,
        { ...input, country: "US", state: "CA" },
        versions,
      ),
      /Australian/,
    );
  }));
test("Current unapproved regional policy cannot fall back to an older approval", () =>
  isolated(async () => {
    await pg.exec(
      "insert into private.region_policies select 99,country,state,false,minimum_age,review_at,'2025-01-01',effective_to,features,evidence,preview_community_only from private.region_policies",
    );
    await assert.rejects(
      renewRetainedOwnerProfile(tx, actor, input, versions),
      /configuration pending/,
    );
  }));
