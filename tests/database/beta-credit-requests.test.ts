import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import type {
  BetaCreditRequest,
  BetaCreditRequestListing,
} from "../../src/core/beta-credit-requests";
test("credit requests persist auditable review only, with idempotency, owner MFA, immutable events and no ledger changes", async () => {
  const pg = new PGlite();
  const owner = randomUUID(),
    recipient = randomUUID();
  try {
    await pg.exec(`create role anon;create role authenticated;create role service_role;create role docked_app;create role docked_beta_app;create role docked_nfl_worker;
      create schema auth;create schema beta_private;create schema beta_public;create schema credits_sandbox;
      create table auth.users(id uuid primary key);
      insert into auth.users values('${owner}'),('${recipient}');
      create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function beta_private.active_member_session() returns boolean language sql as $$select current_setting('fixture.active',true)='true'$$;
      create function beta_private.immutable() returns trigger language plpgsql as $$begin raise exception 'Immutable';end$$;
      create table beta_private.roles(user_id uuid,role text);
      insert into beta_private.roles values('${owner}','owner');
      create table beta_public.profiles(id uuid,disabled_at timestamptz);
      insert into beta_public.profiles values('${recipient}',null);
      create table beta_private.social_profiles(user_id uuid,display_name text,handle text);
      insert into beta_private.social_profiles values('${recipient}','Fixture Recipient','fixture_member');
      create table beta_private.admissions(user_id uuid,status text);
      insert into beta_private.admissions values('${recipient}','accepted');
      create function beta_private.admitted(u uuid) returns boolean language sql as $$select exists(select 1 from beta_private.admissions where user_id=u and status='accepted')$$;
      create table credits_sandbox.state(document jsonb);
      insert into credits_sandbox.state values('{"journal":[],"balance":123,"cards":["unchanged"]}');
      grant usage on schema beta_private to docked_beta_app,anon,authenticated,service_role,docked_app,docked_nfl_worker;
    `);
    await pg.exec(
      await readFile(
        "supabase/migrations/20261016220005_beta_credit_requests.sql",
        "utf8",
      ),
    );
    await pg.query(
      "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false),set_config('fixture.active','true',false)",
      [owner, JSON.stringify({ aal: "aal2" })],
    );
    const mutate = async (command: object) =>
      (
        await pg.query<{ value: BetaCreditRequest }>(
          "select beta_private.credit_request_mutate($1::jsonb,'credits-sandbox-existing-version') value",
          [JSON.stringify(command)],
        )
      ).rows[0].value;
    const list = async (q = "fixture", page = 1) =>
      (
        await pg.query<{ value: BetaCreditRequestListing }>(
          "select beta_private.credit_request_list($1,$2) value",
          [q, page],
        )
      ).rows[0].value;
    await pg.exec("set role docked_beta_app");
    const before = await list();
    assert.equal(before.executionEnabled, false);
    assert.equal(before.recipients[0].id, recipient);
    assert.equal(before.requests.length, 0);
    const command = {
      action: "request",
      requestId: randomUUID(),
      recipient,
      amount: 5000,
      reason: "Isolated beta allocation request",
      confirmed: true,
    };
    const saved = await mutate(command);
    assert.equal(saved.status, "requested");
    assert.equal(saved.history.length, 1);
    assert.equal((await mutate(command)).id, saved.id);
    assert.equal((await list()).requests.length, 1);
    await assert.rejects(
      mutate({ ...command, amount: 100 }),
      /idempotency conflict/,
    );
    for (const changed of [
      { amount: -1 },
      { amount: 1.2 },
      { amount: "5" },
      { confirmed: false },
      { execute: true },
      { reason: "short" },
    ])
      await assert.rejects(
        mutate({ ...command, requestId: randomUUID(), ...changed }),
        /Invalid credit request/,
      );
    const approve = {
      action: "approve",
      requestId: randomUUID(),
      id: saved.id,
      revision: 1,
      reason: "Reviewed proposal only, not issuance",
      confirmed: true,
    };
    const approved = await mutate(approve);
    assert.equal(approved.status, "approved");
    assert.equal(approved.history.length, 2);
    assert.equal((await mutate(approve)).revision, 2);
    await assert.rejects(
      mutate({ ...approve, requestId: randomUUID() }),
      /revision conflict/,
    );
    await assert.rejects(
      mutate({ ...approve, requestId: randomUUID(), revision: 2 }),
      /transition denied/,
    );
    const cancelled = await mutate({
      ...approve,
      action: "cancel",
      requestId: randomUUID(),
      revision: 2,
    });
    assert.equal(cancelled.status, "cancelled");
    await assert.rejects(
      mutate({ ...approve, requestId: randomUUID(), revision: 3 }),
      /transition denied/,
    );
    await assert.rejects(
      pg.exec("select * from beta_private.credit_requests"),
      /permission denied/,
    );
    await assert.rejects(
      pg.exec("select beta_private.credit_request_view('" + saved.id + "')"),
      /permission denied/,
    );
    await pg.exec("reset role");
    await assert.rejects(
      pg.exec(
        "update beta_private.credit_request_events set reason='Edited historical reason'",
      ),
      /Immutable/,
    );
    await assert.rejects(
      pg.exec("delete from beta_private.credit_requests"),
      /permanent/,
    );
    assert.deepEqual(
      (
        await pg.query<{ document: object }>(
          "select document from credits_sandbox.state",
        )
      ).rows[0].document,
      { journal: [], balance: 123, cards: ["unchanged"] },
    );
    await pg.exec("update beta_private.admissions set status='suspended'");
    await assert.rejects(
      mutate({ ...command, requestId: randomUUID() }),
      /Recipient unavailable/,
    );
    assert.equal((await list()).recipients.length, 0);
    for (const role of ["admin", "auditor", "editor", "analyst", "member"]) {
      await pg.query("update beta_private.roles set role=$1", [role]);
      await assert.rejects(list(), /Owner MFA required/);
      await assert.rejects(mutate(command), /Owner MFA required/);
    }
    await pg.exec("update beta_private.roles set role='owner'");
    await pg.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ aal: "aal1" }),
    ]);
    await assert.rejects(list(), /Owner MFA required/);
    await pg.exec(
      `select set_config('request.jwt.claims','{"aal":"aal2"}',false),set_config('fixture.active','false',false)`,
    );
    await assert.rejects(mutate(command), /Owner MFA required/);
    await pg.exec("select set_config('fixture.active','true',false)");
    for (const role of [
      "anon",
      "authenticated",
      "service_role",
      "docked_app",
      "docked_nfl_worker",
    ]) {
      await pg.exec(`set role ${role}`);
      await assert.rejects(list(), /permission denied/);
      await assert.rejects(mutate(command), /permission denied/);
      await pg.exec("reset role");
    }
    for (const page of [0, 101])
      await assert.rejects(
        list("fixture", page),
        /Invalid credit request query/,
      );
  } finally {
    await pg.close();
  }
});
