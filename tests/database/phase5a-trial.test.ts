import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { phase5Hash } from "../../src/core/phase5-hash";
import { completeTrialRequestSQL } from "../../src/server/provider-trial-queries";
let pg: PGlite, trial: string, config: string;
const admin = randomUUID(),
  session = randomUUID(),
  token = "a".repeat(64);
before(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);
 create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    try {
      await pg.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
    } catch (e) {
      throw Error(
        `${f}: ${String((e as { message: string }).message)} at ${(e as { position: string }).position}`,
      );
    }
  }
  await pg.query(
    `insert into auth.users(id,email_confirmed_at) values($1,now())`,
    [admin],
  );
  await pg.query("insert into auth.sessions values($1,$2,null)", [
    session,
    admin,
  ]);
  await pg.query(
    `insert into public.profiles(id,country,state,age_attested,accepted_version) values($1,'XX','TEST',true,'fixture')`,
    [admin],
  );
  await pg.query(`insert into private.roles values($1,'admin')`, [admin]);
  await pg.query(
    `select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)`,
    [admin, JSON.stringify({ sub: admin, session_id: session, aal: "aal2" })],
  );
  const configuration = {
    version: "market-data-v1.0.0",
    provider: "the-odds-api",
    rights: {
      reference: "isolated-trial-rights",
      display: true,
      storage: true,
      derived: true,
      rawRetentionDays: 1,
    },
    monthlyCreditLimit: 250,
    pollIntervalSeconds: 60,
    horizonHours: 48,
    maxEvents: 10,
    maxRequestsPerRun: 1,
    regions: ["au"],
    competitions: [
      {
        providerCompetitionId: "soccer_epl",
        competitionId: "soccer_epl",
        sport: "football",
        displayName: "Fictional EPL",
        mappingEvidence: "fictional-test-only",
      },
    ],
    bookmakers: {},
  };
  config = (
    await pg.query<{ id: string }>(
      `insert into private.market_data_config(provider,version,config_hash,configuration,enabled,effective_from,effective_to,rights_reference,reviewed_by) values('the-odds-api','market-data-v1.0.0',$1,$2,true,now()-interval '1 second',now()+interval '2 days','isolated-trial-rights',$3) returning id`,
      [phase5Hash(configuration), JSON.stringify(configuration), admin],
    )
  ).rows[0].id;
  trial = (
    await pg.query<{ id: string }>(
      `insert into private.provider_trials(provider,project_ref,rights_reference,decision,reviewed_at,next_review_at,effective_to,reviewed_by,evidence_links,scopes,credit_cap) values('the-odds-api','bckkllmndoxzpzdqrevb','isolated-trial-rights','APPROVED_FOR_PREVIEW_TRIAL',now(),now()+interval '1 day',now()+interval '2 days',$1,'["https://the-odds-api.com/terms/"]','{"display":true,"storage":true,"derived":true,"auditRetention":true,"resultsInspection":true}',5) returning id`,
      [admin],
    )
  ).rows[0].id;
});
after(async () => {
  await pg?.close();
});
beforeEach(async () => {
  await pg.exec("begin");
});
afterEach(async () => {
  await pg.exec("rollback");
});
async function permit(operation = "sports", expires = "30 seconds") {
  return (
    await pg.query<{ id: string }>(
      `insert into private.provider_trial_permits(trial_id,token_hash,operation,competition,config_id,expires_at,created_by) values($1,$2,$3,$4,$5,clock_timestamp()+$6::interval,$7) returning id`,
      [
        trial,
        token,
        operation,
        operation === "sports" ? null : "soccer_epl",
        operation === "sports" ? null : config,
        expires,
        admin,
      ],
    )
  ).rows[0].id;
}
async function reserve(id: string, scope = "sports", cost = 0, hash = token) {
  const poll = (
    await pg.query<{ id: string }>(
      `insert into private.provider_poll_runs(provider,sport,status) values('the-odds-api','trial','failed') returning id`,
    )
  ).rows[0].id;
  return pg.query(`select private.reserve_provider_trial($1,$2,$3,$4,$5) id`, [
    id,
    hash,
    scope,
    cost,
    poll,
  ]);
}
async function rejected(fn: () => Promise<unknown>, pattern: RegExp) {
  await pg.exec("savepoint expected_denial");
  await assert.rejects(fn, pattern);
  await pg.exec("rollback to expected_denial");
}
async function completed(p: string) {
  await pg.query(
    `update private.provider_trial_requests set headers_at=clock_timestamp(),status='SUCCESS',completed_at=clock_timestamp() where permit_id=$1`,
    [p],
  );
}
test("manual trial requires real staff MFA and all browser roles lack table/function access", async () => {
  for (const role of ["anon", "authenticated", "docked_app"]) {
    await pg.exec(`set local role ${role}`);
    await rejected(
      () => pg.query("select * from private.provider_trial_permits"),
      /permission denied/,
    );
    await rejected(
      () =>
        pg.query(`select private.reserve_provider_trial($1,$2,'sports',0,$3)`, [
          randomUUID(),
          token,
          randomUUID(),
        ]),
      /permission denied/,
    );
    await pg.exec("reset role");
  }
  await pg.query(`select set_config('request.jwt.claims',$1,true)`, [
    JSON.stringify({ sub: admin, session_id: session, aal: "aal1" }),
  ]);
  await rejected(() => permit(), /MFA/);
});
test("only free sports bootstrap can run with unknown quota, tokens/scopes/costs and replay are bound", async () => {
  await pg.exec(
    `insert into private.source_health(provider,rights_reference,capabilities) values('the-odds-api','isolated-trial-rights','{"display":true,"retention":true}') on conflict(provider) do nothing`,
  );
  const paid = await permit("odds");
  await rejected(() => reserve(paid, "odds:soccer_epl", 1), /budget/);
  const free = await permit();
  await rejected(() => reserve(free, "sports", 0, "b".repeat(64)), /permit/);
  await rejected(() => reserve(free, "events:soccer_epl", 0), /authority/);
  await reserve(free);
  await rejected(() => reserve(free), /replayed/);
  assert.equal(
    (
      await pg.query<{ remaining: number | null }>(
        `select credits_remaining remaining from private.source_health where provider='the-odds-api'`,
      )
    ).rows[0].remaining,
    null,
  );
});
test("cumulative reservation budget never refunds a lower or unknown provider charge and cannot be reset", async () => {
  await pg.exec(
    `insert into private.source_health(provider,credits_remaining,rights_reference,capabilities) values('the-odds-api',100,'isolated-trial-rights','{"display":true,"retention":true}') on conflict(provider) do update set credits_remaining=100,rights_reference='isolated-trial-rights',capabilities='{"display":true,"retention":true}'`,
  );
  for (let i = 0; i < 4; i++) {
    const p = await permit("odds");
    await reserve(p, "odds:soccer_epl", 1);
    await completed(p);
  }
  const a = await permit("odds"),
    b = await permit("odds");
  // PostgreSQL row lock serializes both invocations; first exhausts the shared lifetime allowance.
  await reserve(a, "odds:soccer_epl", 1);
  await completed(a);
  await rejected(() => reserve(b, "odds:soccer_epl", 1), /budget/);
  assert.equal(
    Number(
      (
        await pg.query<{ spent: number }>(
          "select sum(reserved_credits) spent from private.provider_trial_requests",
        )
      ).rows[0].spent,
    ),
    5,
  );
  await rejected(
    () =>
      pg.query(
        `update private.provider_trials set credit_cap=250 where id=$1`,
        [trial],
      ),
    /immutable/,
  );
  await rejected(
    () => pg.query("delete from private.provider_trial_requests"),
    /retained/,
  );
});
test("free metadata still consumes the bounded 25-attempt allowance", async () => {
  for (let i = 0; i < 25; i++) {
    const p = await permit();
    await reserve(p);
    await completed(p);
  }
  await rejected(async () => reserve(await permit()), /budget/);
  assert.equal(
    Number(
      (
        await pg.query<{ count: number }>(
          "select count(*) count from private.provider_trial_requests",
        )
      ).rows[0].count,
    ),
    25,
  );
});
test("expired/revoked reviews and permits close requests, without rewriting immutable evidence", async () => {
  // Leave enough time for the insertion trigger even under a loaded full suite,
  // then wait against the stored database deadline rather than a JS timer.
  const p = await permit("sports", "2 seconds");
  await pg.query(
    `select pg_sleep(greatest(0,extract(epoch from(expires_at-clock_timestamp())))+0.02) from private.provider_trial_permits where id=$1`,
    [p],
  );
  await rejected(() => reserve(p), /Expired/);
  const fresh = await permit();
  await pg.query(
    `update private.provider_trials set revoked_at=clock_timestamp(),revoke_reason='Fictional review revoked' where id=$1`,
    [trial],
  );
  await rejected(() => reserve(fresh), /authority/);
  assert.equal(
    (
      await pg.query<{ allowed: boolean }>(
        `select private.provider_trial_active('isolated-trial-rights') allowed`,
      )
    ).rows[0].allowed,
    false,
  );
});
test("observed quota cannot rewrite reservation or be changed after capture; higher reported cost consumes budget", async () => {
  await pg.exec(
    `insert into private.source_health(provider,credits_remaining,rights_reference,capabilities) values('the-odds-api',100,'isolated-trial-rights','{"display":true,"retention":true}') on conflict(provider) do update set credits_remaining=100,rights_reference='isolated-trial-rights',capabilities='{"display":true,"retention":true}'`,
  );
  const p = await permit("odds");
  await reserve(p, "odds:soccer_epl", 1);
  await pg.query(
    `update private.provider_trial_requests set reported_credits=5,headers_at=clock_timestamp() where permit_id=$1`,
    [p],
  );
  await rejected(
    () =>
      pg.query(
        `update private.provider_trial_requests set reported_credits=0 where permit_id=$1`,
        [p],
      ),
    /immutable/,
  );
  await rejected(
    () =>
      pg.query(
        `update private.provider_trial_requests set reserved_credits=0 where permit_id=$1`,
        [p],
      ),
    /immutable/,
  );
  assert.equal(
    (
      await pg.query<{ allowed: boolean }>(
        `select private.provider_trial_active('isolated-trial-rights') allowed`,
      )
    ).rows[0].allowed,
    false,
  );
  await rejected(async () => permit("odds"), /permit/);
});
test("an interrupted request blocks concurrent attempts; a failed request withdraws data authority while preserving charge", async () => {
  await pg.exec(
    `insert into private.source_health(provider,credits_remaining,rights_reference,capabilities) values('the-odds-api',100,'isolated-trial-rights','{"display":true,"retention":true}') on conflict(provider) do update set credits_remaining=100,rights_reference='isolated-trial-rights',capabilities='{"display":true,"retention":true}'`,
  );
  const a = await permit("odds"),
    b = await permit("odds");
  await reserve(a, "odds:soccer_epl", 1);
  await rejected(() => reserve(b, "odds:soccer_epl", 1), /authority/);
  await pg.query(
    `update private.provider_trial_requests set status='FAILED',completed_at=clock_timestamp() where permit_id=$1`,
    [a],
  );
  await rejected(() => reserve(b, "odds:soccer_epl", 1), /authority/);
  assert.equal(
    Number(
      (
        await pg.query<{ spent: number }>(
          "select sum(reserved_credits) spent from private.provider_trial_requests",
        )
      ).rows[0].spent,
    ),
    1,
  );
  assert.equal(
    (
      await pg.query<{ allowed: boolean }>(
        `select private.provider_trial_active('isolated-trial-rights') allowed`,
      )
    ).rows[0].allowed,
    false,
  );
});
test("a denied competing invocation cannot complete or fail another request using its permit ID", async () => {
  const p = await permit();
  await reserve(p);
  const [r] = (
    await pg.query<{ poll_run_id: string; status: string }>(
      "select poll_run_id,status from private.provider_trial_requests where permit_id=$1",
      [p],
    )
  ).rows;
  assert.equal(
    (
      await pg.query(completeTrialRequestSQL, [
        p,
        randomUUID(),
        "FAILED",
        "TRIAL_REQUEST_FAILED",
        "{}",
      ])
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await pg.query<{ status: string }>(
        "select status from private.provider_trial_requests where permit_id=$1",
        [p],
      )
    ).rows[0].status,
    "RESERVED",
  );
  assert.equal(
    (
      await pg.query(completeTrialRequestSQL, [
        p,
        r.poll_run_id,
        "FAILED",
        "TRIAL_REQUEST_FAILED",
        "{}",
      ])
    ).rows.length,
    1,
  );
});
