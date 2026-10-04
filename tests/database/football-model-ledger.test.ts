import { before, after, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { phase5Hash } from "../../src/core/phase5-hash";
import { footballModelProposal } from "../../src/core/football-model";
import {
  buildMarketReference,
  marketReferenceV1,
  type MarketSourceObservation,
} from "../../src/core/market-reference";
import { hash, strategyV1 } from "../../src/core/pricing";
// Entirely isolated synthetic database fixtures. No probabilities/data are written to any hosted project.
let pg: PGlite;
const admin = randomUUID(),
  member = randomUUID(),
  session = randomUUID(),
  memberSession = randomUUID(),
  job = randomUUID(),
  lease = randomUUID(),
  code = "a".repeat(40);
before(async () => {
  pg = new PGlite();
  await pg.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`,
  );
  for (const file of (await readdir("supabase/migrations"))
    .filter((x) => x.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await pg.query(
    `insert into auth.users(id,email_confirmed_at)values($1,now()),($2,now())`,
    [admin, member],
  );
  await pg.query(`insert into auth.sessions values($1,$2,null),($3,$4,null)`, [
    session,
    admin,
    memberSession,
    member,
  ]);
  await pg.query(
    `insert into public.profiles(id,country,state,age_attested,accepted_version)values($1,'XX','TEST',true,'isolated'),($2,'XX','TEST',true,'isolated')`,
    [admin, member],
  );
  await pg.query(`insert into private.roles values($1,'admin')`, [admin]);
  await pg.exec(
    `insert into private.sports(id,name) values('football','Fictional football');insert into private.competitions(id,sport_id,rules)values('soccer_epl','football','{}');insert into private.events(id,competition_id,participants,start_at,status,source_mappings)values('model-event','soccer_epl','["Home","Away"]',clock_timestamp()+interval '1 hour','scheduled','{}')`,
  );
  await pg.query(
    `insert into private.job_runs(id,dedupe_key,kind,state,payload,lease_token,lease_until) values($1,'isolated-model-job','edge-scan','leased',$2,$3,clock_timestamp()+interval '1 hour')`,
    [
      job,
      JSON.stringify({
        origin: "manual",
        actorId: admin,
        actorSessionId: session,
      }),
      lease,
    ],
  );
});
after(async () => pg?.close());
beforeEach(async () => {
  await pg.exec("begin");
  await claims();
  await pg.query(
    `select set_config('docked.scanner_job',$1,true),set_config('docked.scanner_lease',$2,true),set_config('docked.scanner_commit',$3,true)`,
    [job, lease, code],
  );
});
afterEach(async () => {
  await pg.exec("rollback");
});
async function claims(who = admin, sid = session, aal = "aal2") {
  await pg.query(
    `select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)`,
    [who, JSON.stringify({ sub: who, session_id: sid, aal })],
  );
}
async function denied(fn: () => Promise<unknown>, pattern?: RegExp) {
  await pg.exec("savepoint denied");
  await assert.rejects(fn, pattern ?? /./);
  await pg.exec("rollback to savepoint denied");
}
async function version() {
  await pg.query(
    `insert into private.football_model_versions(id,method,configuration,config_hash,code_commit,created_by) values($1,'independent-football-model',$2,$3,$4,$5)`,
    [
      footballModelProposal.modelVersion,
      JSON.stringify(footballModelProposal),
      phase5Hash(footballModelProposal),
      code,
      admin,
    ],
  );
  return footballModelProposal.modelVersion;
}
async function attempt() {
  return (
    await pg.query<{ id: string }>(
      `insert into private.football_model_attempts(idempotency_key,job_id,event_id,requested_model_version,window_seconds,status,quality,reason,code_commit,as_of_time,calculated_at,provenance)values($1,$2,'model-event','football-goals-v1.0.0',3600,'NOT_CONFIGURED','{"status":"NO_AUTHORISED_DATA"}','MODEL_PROBABILITY_UNAVAILABLE',$3,clock_timestamp(),clock_timestamp(),'{}') returning id`,
      [randomUUID(), job, code],
    )
  ).rows[0].id;
}
test("empty database has no registered model, predictions, implementation or official start", async () => {
  for (const table of [
    "football_model_versions",
    "football_model_attempts",
    "football_model_implementations",
    "official_record_boundary",
    "official_docked_publications",
  ])
    assert.equal(
      (
        await pg.query<{ n: number }>(
          `select count(*)::integer n from private.${table}`,
        )
      ).rows[0].n,
      0,
    );
});
test("all new model evidence is private RLS and denies browser reads/writes/function escalation", async () => {
  const rows = await pg.query<{ relname: string; relrowsecurity: boolean }>(
    `select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and(relname like 'football_%' or relname like 'official_%') and relkind='r'`,
  );
  assert.equal(rows.rows.length, 10);
  assert.ok(rows.rows.every((r) => r.relrowsecurity));
  for (const role of ["anon", "authenticated", "docked_app"]) {
    await pg.exec(`set local role ${role}`);
    await denied(() =>
      pg.exec("select * from private.football_model_attempts"),
    );
    await denied(() =>
      pg.exec(
        `select private.transition_football_model('x','RESEARCH','Synthetic review','{}')`,
      ),
    );
    await pg.exec("reset role");
  }
});
test("current staff MFA creates immutable proposal; member and aal1 cannot create or transition", async () => {
  await claims(member, memberSession);
  await denied(() => version(), /MFA/);
  await claims(admin, session, "aal1");
  await denied(() => version(), /MFA/);
  await claims();
  const id = await version();
  await denied(
    () =>
      pg.query(
        `update private.football_model_versions set configuration='{}' where id=$1`,
        [id],
      ),
    /new model version/,
  );
  await denied(
    () =>
      pg.query(`delete from private.football_model_versions where id=$1`, [id]),
    /retained/,
  );
  await pg.query(
    `select private.transition_football_model($1,'RESEARCH','Isolated lifecycle review','{}')`,
    [id],
  );
  await pg.query(
    `select private.transition_football_model($1,'FORWARD_CALIBRATION','Isolated prospective review','{}')`,
    [id],
  );
  await denied(
    () =>
      pg.query(
        `select private.transition_football_model($1,'APPROVED_FOR_CANDIDATES','Isolated inadequate review','{"probabilitySanity":true,"dataQuality":true,"operationalReadiness":true,"prospectiveCalibrationReviewed":true}')`,
        [id],
      ),
    /implementation/,
  );
  assert.equal(
    (
      await pg.query<{ n: number }>(
        `select count(*)::int n from private.football_model_transitions`,
      )
    ).rows[0].n,
    2,
  );
});
test("reviewed active RESEARCH policy admits research runs and abstentions, never paper/live or comparison", async () => {
  const model = await version();
  await pg.query(
    `select private.transition_football_model($1,'RESEARCH','Isolated research lifecycle review','{}')`,
    [model],
  );
  const configuration = {
    ...strategyV1,
    version: "football-independent-edge-v8.0.0",
    method: "football-independent-model",
    aggregation: "independent-sport-model-v1",
    selectionRule: "EV-desc-selection-ascending",
    modelVersion: model,
    maxSportDataAgeSeconds: 3600,
    maxEdgesPerEvent: 1,
    stakeUnits: "1.00",
    marketReference: marketReferenceV1,
  };
  await pg.query(
    `insert into private.strategy_versions(id,config,config_hash,code_commit)values($1,$2,$3,$4)`,
    [
      configuration.version,
      JSON.stringify(configuration),
      hash(configuration),
      code,
    ],
  );
  await pg.query(
    `insert into private.football_edge_policy_approvals(strategy_id,model_version,config_hash,code_commit,actor,reason)values($1,$2,$3,$4,$5,'Isolated research-only policy review')`,
    [configuration.version, model, hash(configuration), code, admin],
  );
  await pg.query(
    `select private.set_football_policy_active($1,true,'Isolated research-only activation')`,
    [configuration.version],
  );
  for (const purpose of ["research", "paper", "live"]) {
    assert.equal(
      (
        await pg.query<{ allowed: boolean }>(
          `select private.scanner_strategy_allowed($1,$2) allowed`,
          [configuration.version, purpose],
        )
      ).rows[0].allowed,
      purpose === "research",
    );
  }
  const policy = (
    await pg.query<{ id: string }>(
      `insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,operators,evidence)values('XX','TEST','research-only',now()-interval '1 day',now()+interval '1 day',now()+interval '1 day',true,18,'{market_data}','{}','Isolated research scope only') returning id`,
    )
  ).rows[0].id;
  await pg.query(
    `insert into private.scanner_runs(job_id,purpose,strategy_id,region_policy_id)values($1,'research',$2,$3)`,
    [job, configuration.version, policy],
  );
  const retained = await attempt();
  await denied(
    () => pg.query(`select private.assert_football_prediction($1)`, [retained]),
    /independently retained/,
  );
  assert.equal(
    (
      await pg.query<{ n: number }>(
        `select count(*)::int n from private.football_model_attempts where id=$1 and status='NOT_CONFIGURED'`,
        [retained],
      )
    ).rows[0].n,
    1,
  );
});
test("null-parameter proposal cannot register a fabricated fitted model", async () => {
  const id = await version();
  await pg.query(
    `select private.transition_football_model($1,'RESEARCH','Isolated lifecycle review','{}')`,
    [id],
  );
  await denied(
    () =>
      pg.query(
        `insert into private.football_model_implementations(model_version,implementation_id,code_commit,config_hash,training_data_hash,reviewed_by,evidence)values($1,'invented-estimator',$2,$3,$4,$5,'Synthetic model registration must be denied')`,
        [id, code, phase5Hash(footballModelProposal), "b".repeat(64), admin],
      ),
    /fitted implementation/,
  );
});
test("worker records abstention before comparison; missing market cannot erase it and retry cannot cherry pick", async () => {
  const id = await attempt();
  await pg.exec("savepoint comparison");
  await denied(() =>
    pg.exec(
      `select private.assert_current_market_reference('${randomUUID()}')`,
    ),
  );
  await pg.exec("rollback to savepoint comparison");
  assert.equal(
    (
      await pg.query<{ id: string }>(
        "select id from private.football_model_attempts",
      )
    ).rows[0].id,
    id,
  );
  await denied(() => attempt(), /unique/);
  await denied(
    () =>
      pg.query(
        `update private.football_model_attempts set probabilities='{"home":"1","draw":"0","away":"0"}' where id=$1`,
        [id],
      ),
    /Append-only/i,
  );
  await denied(
    () =>
      pg.query("delete from private.football_model_attempts where id=$1", [id]),
    /Append-only/i,
  );
});
test("expired worker lease, revoked actor and post-event attempts fail closed", async () => {
  await pg.exec(
    `update private.job_runs set lease_until=clock_timestamp()-interval '1 second'`,
  );
  await denied(() => attempt(), /worker lease/);
  await pg.exec(
    `update private.job_runs set lease_until=clock_timestamp()+interval '1 hour';update public.profiles set disabled_at=clock_timestamp() where id='${admin}'`,
  );
  await denied(() => attempt(), /worker lease/);
});
test("no direct READY injection or retroactive official boundary, legacy publication denied", async () => {
  await denied(
    () =>
      pg.query(
        `insert into private.football_model_attempts(idempotency_key,job_id,event_id,requested_model_version,window_seconds,status,quality,reason,code_commit,as_of_time,calculated_at,provenance,probabilities)values($1,$2,'model-event','invented',3600,'READY','{}',null,$3,clock_timestamp(),clock_timestamp(),'{}','{"home":"0.5","draw":"0.2","away":"0.3"}')`,
        [randomUUID(), job, code],
      ),
    /registered|estimator/i,
  );
  await denied(
    () =>
      pg.query(
        `insert into private.official_record_boundary(first_tip_id,started_at,actor)values($1,clock_timestamp()-interval '1 year',$2)`,
        [randomUUID(), admin],
      ),
    /canonical live/,
  );
  await denied(
    () =>
      pg.query(
        `insert into private.tip_publications(candidate_id,event_id,strategy_id,evidence,selection,market_rules,probability,odds,minimum_odds,estimated_ev,config_hash,sources,publication_payload,approved_by,region_policy_id) values($1,'model-event','legacy','live_published','Home','{}',0.5,2.1,2.06,0.05,'x','[]','{}',$2,$3)`,
        [randomUUID(), admin, randomUUID()],
      ),
    /independent-model/,
  );
});
async function sportingInput() {
  const at = new Date(
      (await pg.query<{ at: Date }>("select clock_timestamp() at")).rows[0].at,
    ),
    start = new Date(at.getTime() + 3600000).toISOString(),
    past = (s: number) => new Date(at.getTime() - s * 1000).toISOString();
  await pg.query(
    `update private.events set start_at=$1 where id='model-event'`,
    [start],
  );
  const approval = {
    sourceId: "synthetic-results",
    provider: "isolated-fixture",
    sourceVersion: "v1",
    rightsReference: "Synthetic rights only",
    allowedPurposes: [
      "model_training",
      "derived_probabilities",
      "retained_evidence",
    ],
    knownAt: past(100000),
    effectiveFrom: past(100000),
    effectiveTo: new Date(at.getTime() + 86400000).toISOString(),
  };
  await pg.query(
    `insert into private.football_sporting_sources(id,provider,source_version,rights_reference,purposes,known_at,effective_from,effective_to,approved_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      approval.sourceId,
      approval.provider,
      approval.sourceVersion,
      approval.rightsReference,
      approval.allowedPurposes,
      approval.knownAt,
      approval.effectiveFrom,
      approval.effectiveTo,
      admin,
    ],
  );
  return {
    schemaVersion: "football-sporting-input-v1",
    event: {
      eventId: "model-event",
      competitionId: "soccer_epl",
      homeTeamId: "home",
      awayTeamId: "away",
      sport: "football",
      startAt: start,
      status: "scheduled",
      knownAt: past(100),
      sourceId: approval.sourceId,
    },
    asOfTime: at.toISOString(),
    calculatedAt: at.toISOString(),
    codeCommit: code,
    sourceApprovals: [approval],
    matches: [
      {
        id: "synthetic-history",
        eventId: "synthetic-old",
        competitionId: "soccer_epl",
        homeTeamId: "home",
        awayTeamId: "away",
        startAt: past(20000),
        completedAt: past(14000),
        knownAt: past(13000),
        receivedAt: past(12000),
        sourceId: approval.sourceId,
        revision: 1,
        status: "final",
        regulationHomeGoals: 1,
        regulationAwayGoals: 0,
      },
    ],
    missingRequired: [],
    missingOptional: [],
  };
}
async function insertInput(payload: Awaited<ReturnType<typeof sportingInput>>) {
  return pg.query(
    `insert into private.football_sporting_inputs(event_id,payload,input_hash,as_of_time,input_cutoff,source_ids,created_by)values('model-event',$1,$2,$3,$4,'{synthetic-results}',$5)`,
    [
      JSON.stringify(payload),
      phase5Hash(payload),
      payload.asOfTime,
      payload.matches[0].receivedAt,
      admin,
    ],
  );
}
test("sporting input requires as-of source authority, real result fields and no price-derived fields", async () => {
  const original = await sportingInput();
  await insertInput(original);
  const future = structuredClone(original);
  future.matches[0].knownAt = future.asOfTime;
  await denied(() => insertInput(future), /look-ahead/);
  const provenance = structuredClone(original);
  provenance.sourceApprovals[0].rightsReference = "Invented licence";
  await denied(() => insertInput(provenance), /canonical authority/);
  const price = structuredClone(original) as typeof original & { odds: number };
  price.odds = 2;
  await denied(() => insertInput(price), /sporting-only/);
  const missing = structuredClone(original);
  delete (missing.matches[0] as Partial<(typeof missing.matches)[0]>)
    .regulationHomeGoals;
  await denied(() => insertInput(missing), /look-ahead/);
  const wrong = structuredClone(original);
  wrong.matches[0].competitionId = "unapproved";
  await denied(() => insertInput(wrong), /look-ahead/);
});

test("isolated prospective pipeline preserves full vector, reviewed calibration and canonical official start", async () => {
  const proposal = {
      ...footballModelProposal,
      modelVersion: "football-goals-v9.0.0",
      parameters: { isolatedTestOnly: true },
      trainingDataHash: "d".repeat(64),
    },
    model = proposal.modelVersion;
  await pg.query(
    `insert into private.football_model_versions(id,method,configuration,config_hash,code_commit,created_by)values($1,'independent-football-model',$2,$3,$4,$5)`,
    [model, JSON.stringify(proposal), phase5Hash(proposal), code, admin],
  );
  await pg.query(
    `select private.transition_football_model($1,'RESEARCH','Explicit isolated synthetic calibration','{}')`,
    [model],
  );
  await pg.query(
    `insert into private.football_model_implementations(model_version,implementation_id,code_commit,config_hash,training_data_hash,reviewed_by,evidence)values($1,'ISOLATED_TEST_ONLY_NOT_AN_ESTIMATOR',$2,$3,$4,$5,'Isolated synthetic SQL contract; no empirical validity claimed')`,
    [model, code, phase5Hash(proposal), proposal.trainingDataHash, admin],
  );
  await pg.query(
    `select private.transition_football_model($1,'FORWARD_CALIBRATION','Explicit isolated prospective calibration','{}')`,
    [model],
  );
  const input = await sportingInput();
  const start = new Date(Date.now() + 2500).toISOString();
  input.event.startAt = start;
  await pg.query(
    `update private.events set start_at=$1 where id='model-event'`,
    [start],
  );
  await insertInput(input);
  async function ready(
    event: string,
    inputHash: string,
    probabilities: Record<string, string>,
    windowSeconds = 3600,
  ) {
    return (
      await pg.query<{ id: string }>(
        `insert into private.football_model_attempts(idempotency_key,job_id,event_id,requested_model_version,model_version,input_snapshot_id,window_seconds,status,probabilities,quality,config_hash,input_hash,code_commit,as_of_time,calculated_at,input_cutoff,provenance)select $1,$2,$3,$4,$4,i.id,$9,'READY',$5,'{"status":"READY"}',$6,i.input_hash,$7,clock_timestamp(),clock_timestamp(),i.input_cutoff,'{"fixture":"ISOLATED_TEST_ONLY"}' from private.football_sporting_inputs i where i.input_hash=$8 returning id`,
        [
          randomUUID(),
          job,
          event,
          model,
          JSON.stringify(probabilities),
          phase5Hash(proposal),
          code,
          inputHash,
          windowSeconds,
        ],
      )
    ).rows[0].id;
  }
  const prediction = await ready("model-event", phase5Hash(input), {
    home: "0",
    draw: "0",
    away: "1",
  });
  await pg.exec("savepoint nested_prediction");
  const nested = await ready(
    "model-event",
    phase5Hash(input),
    { home: "0.5", draw: "0.25", away: "0.25" },
    21600,
  );
  await denied(
    () => pg.query("select private.assert_football_prediction($1)", [nested]),
    /prospective/,
  );
  await pg.exec("rollback to savepoint nested_prediction");
  assert.deepEqual(
    (
      await pg.query<{ probabilities: unknown; fair_odds: unknown }>(
        "select probabilities,fair_odds from private.football_model_attempts where id=$1",
        [prediction],
      )
    ).rows[0],
    {
      probabilities: { home: "0", draw: "0", away: "1" },
      fair_odds: { home: null, draw: null, away: 1 },
    },
  );
  await denied(
    () =>
      pg.query("select private.assert_football_prediction($1)", [prediction]),
    /prospective/,
  );
  await new Promise((resolve) => setTimeout(resolve, 2700));
  const outcome = (
    await pg.query<{ id: string }>(
      `insert into private.football_model_outcomes(prediction_id,source_id,source_event_id,revision,result,home_goals,away_goals,observed_at,evidence,actor,reason)values($1,'synthetic-results','model-event','provider1','home',1,0,clock_timestamp(),'{}',$2,'Isolated regulation score fixture') returning id`,
      [prediction, admin],
    )
  ).rows[0].id;
  await pg.query(
    `insert into private.football_model_outcomes(prediction_id,source_id,source_event_id,revision,result,observed_at,evidence,corrects,actor,reason)values($1,'synthetic-results','model-event','provider2','manual_review',clock_timestamp(),'{}',$2,$3,'Isolated disputed score fixture')`,
    [prediction, outcome, admin],
  );
  const audit = await pg.query<{ sequence: number; result: string }>(
    `select sequence,result from private.football_model_outcomes where prediction_id=$1 order by sequence`,
    [prediction],
  );
  assert.deepEqual(audit.rows, [
    { sequence: 1, result: "home" },
    { sequence: 2, result: "manual_review" },
  ]);
  // Approval requires current resolved prospective evidence, not a withdrawn historical result.
  await denied(
    () =>
      pg.query(
        `select private.transition_football_model($1,'APPROVED_FOR_CANDIDATES','Isolated prospective review','{"probabilitySanity":true,"dataQuality":true,"operationalReadiness":true,"prospectiveCalibrationReviewed":true}')`,
        [model],
      ),
    /calibration/,
  );
  const latest = (
    await pg.query<{ id: string }>(
      "select id from private.football_model_outcomes where prediction_id=$1 order by sequence desc limit 1",
      [prediction],
    )
  ).rows[0].id;
  await pg.query(
    `insert into private.football_model_outcomes(prediction_id,source_id,source_event_id,revision,result,home_goals,away_goals,observed_at,evidence,corrects,actor,reason)values($1,'synthetic-results','model-event','provider3','home',1,0,clock_timestamp(),'{}',$2,$3,'Isolated corrected score fixture')`,
    [prediction, latest, admin],
  );
  for (const state of ["APPROVED_FOR_CANDIDATES", "APPROVED_FOR_LIVE"])
    await pg.query(
      `select private.transition_football_model($1,$2,'Isolated quality review without ROI condition','{"probabilitySanity":true,"dataQuality":true,"operationalReadiness":true,"prospectiveCalibrationReviewed":true}')`,
      [model, state],
    );
  const liveInput = structuredClone(input);
  liveInput.event.eventId = "official-fixture";
  liveInput.event.startAt = new Date(Date.now() + 3599000).toISOString();
  liveInput.asOfTime = new Date().toISOString();
  liveInput.calculatedAt = liveInput.asOfTime;
  await pg.query(
    `insert into private.events(id,competition_id,participants,start_at,status,source_mappings) values('official-fixture','soccer_epl','["Home","Away"]',$1,'scheduled','{"fixture-odds":"official-fixture"}')`,
    [liveInput.event.startAt],
  );
  await pg.query(
    `insert into private.football_sporting_inputs(event_id,payload,input_hash,as_of_time,input_cutoff,source_ids,created_by)values('official-fixture',$1,$2,$3,$4,'{synthetic-results}',$5)`,
    [
      JSON.stringify(liveInput),
      phase5Hash(liveInput),
      liveInput.asOfTime,
      liveInput.matches[0].receivedAt,
      admin,
    ],
  );
  const prospective = await ready("official-fixture", phase5Hash(liveInput), {
    home: "0.5",
    draw: "0.25",
    away: "0.25",
  });
  // The prediction must genuinely commit BEFORE a market reference can be attached.
  await pg.exec("commit;begin");
  await claims();
  await pg.query(
    `select set_config('docked.scanner_job',$1,true),set_config('docked.scanner_lease',$2,true),set_config('docked.scanner_commit',$3,true)`,
    [job, lease, code],
  );
  await pg.query("select private.assert_football_prediction($1)", [
    prospective,
  ]);
  const policy = (
    await pg.query<{ id: string }>(
      `insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,operators,evidence) values('XX','TEST','isolated-model',now()-interval '1 day',now()+interval '1 day',now()+interval '1 day',true,18,'{market_data,tips}','{fixture-a,fixture-b}','Isolated synthetic SQL publication authority') returning id`,
    )
  ).rows[0].id;
  await pg.exec(
    `insert into private.source_health(provider,healthy,last_success,rights_reference,capabilities)values('fixture-odds',true,clock_timestamp(),'isolated-odds-rights','{"display":true,"retention":true,"community_standard_prices":true}')`,
  );
  const rules = {
    eventId: "official-fixture",
    competition: "soccer_epl",
    participants: ["Home", "Away"],
    market: "football_1x2",
    period: "full_game",
    overtime: false,
    draw: true,
    line: null,
    settlement: "regulation_90_plus_stoppage",
    outcomes: ["Home", "Draw", "Away"],
  } as const;
  await pg.query(
    `insert into private.markets(id,event_id,rules,rules_hash)values('official-market','official-fixture',$1,$2)`,
    [JSON.stringify(rules), hash(rules)],
  );
  const sources: MarketSourceObservation[] = [];
  for (const [index, bookmaker] of ["fixture-a", "fixture-b"].entries()) {
    const now = new Date().toISOString(),
      id = randomUUID(),
      operator = `fixture-operator-${index}`;
    await pg.query(
      `insert into private.bookmaker_eligibility(bookmaker,operator_group,region_policy_id,approved,effective_from,effective_to,rights_reference)values($1,$2,$3,true,now()-interval '1 day',now()+interval '1 day','Isolated ownership fixture')`,
      [bookmaker, operator, policy],
    );
    const payload = {
      id,
      bookmaker,
      operator,
      approved: true,
      rules,
      prices: { Home: "2.1", Draw: "3.3", Away: "3.3" },
      sourceAt: now,
      snapshotAt: now,
      receivedAt: now,
      suspended: false,
      communityMetadata: {
        sourceKind: "current_provider",
        sourceType: "bookmaker",
        receivedByDocked: true,
        providerEventId: "official-fixture",
        observedStartAt: liveInput.event.startAt,
        priceClass: "STANDARD_VERIFIED",
        classificationVersion: "fixture-v1",
        classificationEvidence: "Isolated normal-price fixture",
        promotionFlags: [],
      },
    };
    await pg.query(
      `insert into private.odds_snapshots(id,market_id,provider,bookmaker,source_at,snapshot_at,received_at,payload,provenance,evidence)values($1,'official-market','fixture-odds',$2,$3,$3,$3,$4,'isolated-odds-rights','forward_paper')`,
      [id, bookmaker, now, JSON.stringify(payload)],
    );
    await pg.query(
      `insert into private.community_quote_evidence(snapshot_id,provider_event_id,observed_start_at,classification,classification_version,classification_evidence,rights_reference,metadata)values($1,'ignored',now(),'STANDARD_VERIFIED','ignored','ignored','ignored','{}')`,
      [id],
    );
    sources.push({
      ...payload,
      rules: JSON.parse(JSON.stringify(rules)),
      provider: "fixture-odds",
      sourceKind: "bookmaker",
      licensed: true,
      rightsReference: "isolated-odds-rights",
      ownershipEvidence: "Isolated ownership fixture",
      mappingVerified: true,
      feedHealthy: true,
      priceClass: "STANDARD_VERIFIED",
      classificationVersion: "fixture-v1",
      classificationEvidence: "Isolated normal-price fixture",
      promotionFlags: [],
      provenance: "current_provider",
    });
  }
  const referenceConfiguration = {
      ...marketReferenceV1,
      availabilityBookmakers: ["fixture-a", "fixture-b"],
      pricingBookmakers: [],
    },
    at = new Date().toISOString(),
    result = buildMarketReference(
      {
        rules: JSON.parse(JSON.stringify(rules)),
        startAt: liveInput.event.startAt,
        observedAt: at,
        selection: "Home",
        sources,
      },
      referenceConfiguration,
    );
  assert.equal(result.status, "READY");
  if (result.status !== "READY") throw Error("Fixture reference failed");
  const r = result.reference,
    reference = (
      await pg.query<{ id: string }>(
        `insert into private.market_references(market_id,selection,methodology_version,config_hash,configuration,reference,snapshot_ids,decimal_price,observed_at,region_policy_id)values('official-market','Home',$1,$2,$3,$4,$5,$6,$7,$8) returning id`,
        [
          r.methodologyVersion,
          r.configHash,
          JSON.stringify(referenceConfiguration),
          JSON.stringify(r),
          r.availability.sourceIds,
          r.decimalPrice,
          at,
          policy,
        ],
      )
    ).rows[0].id;
  const strategy = {
    ...strategyV1,
    version: "football-independent-edge-v9.0.0",
    method: "football-independent-model",
    aggregation: "independent-sport-model-v1",
    selectionRule: "EV-desc-selection-ascending",
    modelVersion: model,
    maxSportDataAgeSeconds: 604800,
    maxEdgesPerEvent: 1,
    stakeUnits: "1.00",
    marketReference: referenceConfiguration,
  };
  await pg.query(
    `insert into private.strategy_versions(id,config,config_hash,code_commit,active)values($1,$2,$3,$4,true)`,
    [strategy.version, JSON.stringify(strategy), hash(strategy), code],
  );
  await pg.query(
    `insert into private.football_edge_policy_approvals(strategy_id,model_version,config_hash,code_commit,actor,reason)values($1,$2,$3,$4,$5,'Isolated future policy contract only')`,
    [strategy.version, model, hash(strategy), code, admin],
  );
  async function candidate(purpose: string) {
    const scanJob = randomUUID(),
      scanLease = randomUUID();
    await pg.query(
      `insert into private.job_runs(id,dedupe_key,kind,state,payload,lease_token,lease_until)values($1,$2,'edge-scan','leased',$3,$4,clock_timestamp()+interval '1 hour')`,
      [
        scanJob,
        randomUUID(),
        JSON.stringify({
          origin: "manual",
          actorId: admin,
          actorSessionId: session,
        }),
        scanLease,
      ],
    );
    await pg.query(
      `select set_config('docked.scanner_job',$1,true),set_config('docked.scanner_lease',$2,true)`,
      [scanJob, scanLease],
    );
    const run = (
      await pg.query<{ id: string }>(
        `insert into private.scanner_runs(job_id,purpose,strategy_id,region_policy_id)values($1,$2,$3,$4) returning id`,
        [scanJob, purpose, strategy.version, policy],
      )
    ).rows[0].id;
    return (
      await pg.query<{ id: string }>(
        `insert into private.scanner_candidates(dedupe_key,run_id,event_id,market_id,strategy_id,strategy_hash,code_commit,region_policy_id,purpose,selection,market_reference_id,model_version,model_evidence,probability,fair_odds,minimum_odds,required_ev,estimated_ev,window_seconds,scanned_at,expires_at,origin,created_by,prediction_id)values($1,$2,'official-fixture','official-market',$3,$4,$5,$6,$7,'Home',$8,$9,$10,.5,2,2.06,.03,.05,3600,$11,$12,'manual',$13,$14) returning id`,
        [
          phase5Hash({ purpose }),
          run,
          strategy.version,
          hash(strategy),
          code,
          policy,
          purpose,
          reference,
          model,
          JSON.stringify({
            predictionId: prospective,
            inputHash: phase5Hash(liveInput),
            probabilities: { home: "0.5", draw: "0.25", away: "0.25" },
          }),
          at,
          new Date(Date.parse(at) + 110000).toISOString(),
          admin,
          prospective,
        ],
      )
    ).rows[0].id;
  }
  const research = await candidate("research");
  await denied(
    () =>
      pg.query("select private.publish_football_candidate($1,null)", [
        research,
      ]),
    /publication candidate/,
  );
  assert.equal(
    (
      await pg.query<{ n: number }>(
        "select count(*)::int n from private.official_record_boundary",
      )
    ).rows[0].n,
    0,
  );
  const c = await candidate("live");
  await denied(
    () => pg.query("select private.publish_football_candidate($1,null)", [c]),
    /publication/,
  );
  await pg.exec(
    `update private.feature_flags set enabled=true where key='publication'`,
  );
  await pg.query(
    "select private.set_football_policy_active($1,false,'Isolated withdrawal regression')",
    [strategy.version],
  );
  await denied(
    () => pg.query("select private.publish_football_candidate($1,null)", [c]),
    /authority/,
  );
  await pg.query(
    "select private.set_football_policy_active($1,true,'Isolated activation regression')",
    [strategy.version],
  );
  const publication = (
    await pg.query<{ id: string }>(
      "select private.publish_football_candidate($1,null) id",
      [c],
    )
  ).rows[0].id;
  await pg.query(
    `insert into private.scanner_reviews(candidate_id,status,actor,reason,market_reference_id,publication_id,evidence)values($1,'APPROVED',$2,'Isolated reviewed prospective publication',$3,$4,'{}')`,
    [c, admin, reference, publication],
  );
  const boundary = (
    await pg.query<{ first_tip_id: string; started_at: Date }>(
      "select first_tip_id,started_at from private.official_record_boundary",
    )
  ).rows[0];
  assert.equal(boundary.first_tip_id, publication);
  assert.equal(
    (
      await pg.query<{ n: number }>(
        "select count(*)::int n from private.official_docked_publications",
      )
    ).rows[0].n,
    1,
  );
  await denied(
    () => pg.query("select private.publish_football_candidate($1,null)", [c]),
    /publication candidate/,
  );
  await denied(
    () =>
      pg.exec(
        `update private.official_record_boundary set started_at=now()-interval '1 year'`,
      ),
    /Append-only/,
  );
});
