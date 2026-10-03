import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { phase5Hash } from "../../src/core/phase5-hash";
import { trialQuotaSummarySQL } from "../../src/server/provider-trial-queries";
let pg: PGlite, trial: string, config: string, failedId: string;
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
    .filter(
      (f) => f.endsWith(".sql") && !f.includes("reviewed_driver_recovery"),
    )
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
  const p = await permit();
  const r = await reserve(p);
  failedId = (r.rows[0] as { id: string }).id;
  await pg.query(
    `update private.provider_trial_requests set status='FAILED',completed_at=clock_timestamp(),error_code='TRIAL_REQUEST_FAILED',diagnostics=to_jsonb('{}'::text) where id=$1`,
    [failedId],
  );
  const migration = (await readdir("supabase/migrations")).find((f) =>
    f.endsWith("_phase5a_reviewed_driver_recovery.sql"),
  )!;
  await pg.exec(await readFile(`supabase/migrations/${migration}`, "utf8"));
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
async function review(requestId = failedId) {
  return pg.query(
    `insert into private.provider_trial_failure_reviews(request_id,trial_id,reviewed_by,reason_code,repair_code_commit,evidence_reference,evidence_sha256) values($1,$2,$3,'SERVER_TRANSACTION_COMPATIBILITY',$4,'isolated driver failure proof',$5)`,
    [requestId, trial, admin, "a".repeat(40), "b".repeat(64)],
  );
}
async function active() {
  return (
    await pg.query<{ allowed: boolean }>(
      "select private.provider_trial_active('isolated-trial-rights') allowed",
    )
  ).rows[0].allowed;
}
test("reported totals remain unknown after a later measured success and reviewed legacy failure", async () => {
  await review();
  const p = await permit();
  await reserve(p);
  await pg.query(
    `update private.provider_trial_requests set reported_credits=0,remaining=500,used=0,headers_at=clock_timestamp(),status='SUCCESS',completed_at=clock_timestamp() where permit_id=$1`,
    [p],
  );
  const row = (
    await pg.query<{
      attempts: number;
      reserved: number;
      reported: number | null;
      reported_today: number | null;
    }>(trialQuotaSummarySQL, [trial])
  ).rows[0];
  assert.equal(row.attempts, 2);
  assert.equal(row.reserved, 0);
  assert.equal(row.reported, null);
  assert.equal(row.reported_today, null);
});
test("one reviewed legacy bootstrap failure preserves unknown quota, original failure, attempts and budget", async () => {
  assert.equal(await active(), false);
  await review();
  assert.equal(await active(), true);
  const row = (
    await pg.query<{
      status: string;
      reported_credits: number | null;
      headers_at: null;
      diagnostics: unknown;
    }>(`select * from private.provider_trial_requests where id=$1`, [failedId])
  ).rows[0];
  assert.equal(row.status, "FAILED");
  assert.equal(row.reported_credits, null);
  assert.equal(row.headers_at, null);
  assert.equal(row.diagnostics, "{}");
  const paid = await permit("odds");
  await rejected(() => reserve(paid, "odds:soccer_epl", 1), /budget|authority/);
  const next = await permit();
  await reserve(next);
  await completed(next);
  assert.deepEqual(
    (
      await pg.query(
        `select count(*)::int attempts,sum(reserved_credits)::int reserved from private.provider_trial_requests`,
      )
    ).rows[0],
    { attempts: 2, reserved: 0 },
  );
  await rejected(() => review(), /unique/);
  await rejected(
    () => pg.exec("delete from private.provider_trial_failure_reviews"),
    /immutable/,
  );
  await rejected(
    () =>
      pg.exec(
        "update private.provider_trial_failure_reviews set evidence_reference='altered proof'",
      ),
    /immutable/,
  );
  await rejected(
    () =>
      pg.query(
        "update private.provider_trial_requests set diagnostics='{}' where id=$1",
        [failedId],
      ),
    /immutable/,
  );
});
test("browser and restricted production role cannot review; real MFA and current rights are mandatory", async () => {
  for (const role of ["anon", "authenticated", "docked_app"]) {
    await pg.exec(`set local role ${role}`);
    await rejected(() => review(), /permission denied/);
    await pg.exec("reset role");
  }
  await pg.query(`select set_config('request.jwt.claims',$1,true)`, [
    JSON.stringify({ sub: admin, session_id: session, aal: "aal1" }),
  ]);
  await rejected(() => review(), /MFA/);
  await pg.query(`select set_config('request.jwt.claims',$1,true)`, [
    JSON.stringify({ sub: admin, session_id: session, aal: "aal2" }),
  ]);
  await pg.query(
    "update private.provider_trials set revoked_at=clock_timestamp(),revoke_reason='Fictional revoked review' where id=$1",
    [trial],
  );
  await rejected(() => review(), /Exact reviewed/);
  assert.equal(await active(), false);
});
test("new failures and observed overcharges remain closed despite the older bootstrap review", async () => {
  await review();
  const next = await permit();
  await reserve(next);
  await pg.query(
    `update private.provider_trial_requests set status='FAILED',completed_at=clock_timestamp(),headers_at=clock_timestamp(),reported_credits=1,diagnostics='{"failureStage":"PAYLOAD_VALIDATION"}' where permit_id=$1`,
    [next],
  );
  assert.equal(await active(), false);
  const rid = (
    await pg.query<{ id: string }>(
      "select id from private.provider_trial_requests where permit_id=$1",
      [next],
    )
  ).rows[0].id;
  await rejected(() => review(rid), /Exact reviewed/);
});
test("review never resets source-health circuit and later role revocation blocks a preissued permit", async () => {
  await pg.exec(
    `update private.source_health set circuit_until=clock_timestamp()+interval '5 minutes' where provider='the-odds-api'`,
  );
  await review();
  const next = await permit();
  await rejected(() => reserve(next), /budget/);
  assert.equal(
    (
      await pg.query<{ blocked: boolean }>(
        "select circuit_until>clock_timestamp() blocked from private.source_health where provider='the-odds-api'",
      )
    ).rows[0].blocked,
    true,
  );
  // The role check is separate from circuits; remove only the local test circuit to exercise it.
  await pg.exec(
    "update private.source_health set circuit_until=null where provider='the-odds-api'",
  );
  await pg.query("delete from private.roles where user_id=$1", [admin]);
  await rejected(() => reserve(next), /issuer/);
  assert.equal(
    (
      await pg.query<{ count: number }>(
        "select count(*)::int count from private.provider_trial_requests",
      )
    ).rows[0].count,
    1,
  );
});
test("new double-encoded diagnostics are rejected while the historical string stays unchanged", async () => {
  await review();
  const next = await permit();
  await reserve(next);
  await rejected(
    () =>
      pg.query(
        `update private.provider_trial_requests set diagnostics=to_jsonb('{}'::text) where permit_id=$1`,
        [next],
      ),
    /JSON object/,
  );
  assert.equal(
    (
      await pg.query<{ diagnostics: unknown }>(
        "select diagnostics from private.provider_trial_requests where id=$1",
        [failedId],
      )
    ).rows[0].diagnostics,
    "{}",
  );
});
