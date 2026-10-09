import { before, after, beforeEach, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { phase5Hash } from "../../src/core/phase5-hash";
import {
  parseOpenFootballDataset,
  openFootballQualityReport,
} from "../../src/core/openfootball-dataset";
import {
  buildMatchResearchFile,
  researchFactHash,
  researchFactKey,
  validateResearchFact,
  validateResearchSource,
  type ResearchSource,
} from "../../src/core/research-engine";
let pg: PGlite;
const admin = randomUUID(),
  member = randomUUID(),
  session = randomUUID(),
  memberSession = randomUUID();
before(async () => {
  pg = new PGlite();
  await pg.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);create table auth.sessions(id uuid primary key,user_id uuid references auth.users,not_after timestamptz);create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`,
  );
  for (const f of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`supabase/migrations/${f}`, "utf8"));
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
    `insert into private.sports(id,name)values('football','Fictional');insert into private.competitions(id,sport_id,rules)values('soccer_epl','football','{}');insert into private.events(id,competition_id,participants,start_at,status,source_mappings)values('research-event','soccer_epl','["Home","Away"]',clock_timestamp()+interval '1 hour','scheduled','{}');`,
  );
});
after(async () => pg?.close());
beforeEach(async () => {
  await pg.exec("begin");
  await claims();
});
afterEach(async () => pg.exec("rollback"));
async function claims(id = admin, sid = session, aal = "aal2") {
  await pg.query(
    `select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)`,
    [id, JSON.stringify({ sub: id, session_id: sid, aal })],
  );
}
async function denied(fn: () => Promise<unknown>, pattern = /./) {
  await pg.exec("savepoint denial");
  await assert.rejects(fn, pattern);
  await pg.exec("rollback to savepoint denial");
}
const instant = (offset = 0) => new Date(Date.now() + offset).toISOString();
function source(overrides: Partial<ResearchSource> = {}): ResearchSource {
  return validateResearchSource({
    schemaVersion: "research-source-v1",
    sourceId: "isolated-research",
    version: randomUUID(),
    name: "Fictional research source",
    domain: "example.invalid",
    category: "OFFICIAL",
    accessMethod: "MANUAL",
    endpoint: "https://example.invalid/facts",
    rightsState: "APPROVED_MANUAL_ONLY",
    commercialUse: "ALLOWED",
    publicDisplay: "ALLOWED",
    storage: {
      permission: "ALLOWED",
      maxDays: 1,
      immutableEvidenceAllowed: true,
    },
    derivedUse: "ALLOWED",
    modelUse: "UNKNOWN",
    automation: "DENIED",
    robots: "NOT_APPLICABLE",
    etiquette: { minimumIntervalSeconds: null, maximumRequestsPerDay: null },
    attribution: {
      label: "Fictional test source",
      url: "https://example.invalid/facts",
    },
    dataTypes: [
      "PLAYER_INJURY",
      "MATCH_RESULT",
      "TEAM_STAT_UPDATE",
      "CONFIRMED_LINEUP",
    ],
    reliability: "TIER_1_CONFIRMED_OFFICIAL",
    jurisdictions: ["XX:TEST"],
    reviewedAt: instant(-1000),
    reviewDueAt: instant(86400000),
    effectiveFrom: instant(-2000),
    effectiveTo: instant(86400000),
    evidenceUrls: ["https://example.invalid/rights"],
    notes: "Isolated synthetic database test fixture",
    ...overrides,
  });
}
async function register(c = source(), supersedes: string | null = null) {
  return (
    await pg.query<{ id: string }>(
      `insert into private.research_source_versions(source_key,version,configuration,config_hash,supersedes,created_by,reason)values($1,$2,$3,$4,$5,$6,'Isolated source review evidence')returning id`,
      [
        c.sourceId,
        c.version,
        JSON.stringify(c),
        phase5Hash(c),
        supersedes,
        admin,
      ],
    )
  ).rows[0].id;
}
async function fact(
  sid: string,
  c: ResearchSource,
  options: Record<string, unknown> = {},
  unsafe = false,
) {
  const raw = {
    schemaVersion: "research-fact-v1",
    id: randomUUID(),
    type: "PLAYER_INJURY",
    eventId: "research-event",
    teamId: "Home",
    playerId: "player-1",
    value: { status: "OUT", reason: "INJURY" },
    sourceId: c.sourceId,
    sourceVersion: c.version,
    sourceItemId: randomUUID(),
    sourceRevision: "1",
    sourcePublishedAt: null,
    sourceObservedAt: instant(-100),
    ingestedAt: instant(),
    effectiveAt: instant(-100),
    expiresAt: instant(600000),
    confidence: "CONFIRMED",
    reliability: c.reliability,
    evidenceUrl: "https://example.invalid/fact",
    evidenceHash: "a".repeat(64),
    supersedesId: null,
    recordState: "ASSERTED",
    correctionReason: null,
    ...options,
  };
  const f = unsafe
    ? (raw as ReturnType<typeof validateResearchFact>)
    : validateResearchFact(raw);
  await pg.query(
    `insert into private.research_facts(id,event_id,source_review_id,source_item_id,source_revision,fact_type,team_id,player_id,fact_key,fact_hash,source_published_at,source_observed_at,ingested_at,effective_at,expires_at,confidence,reliability,evidence_url,evidence_hash,record_state,supersedes_id,created_by)values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
    [
      f.id,
      f.eventId,
      sid,
      f.sourceItemId,
      f.sourceRevision,
      f.type,
      f.teamId,
      f.playerId,
      researchFactKey(f),
      unsafe ? phase5Hash(f) : researchFactHash(f),
      f.sourcePublishedAt,
      f.sourceObservedAt,
      f.ingestedAt,
      f.effectiveAt,
      f.expiresAt,
      f.confidence,
      f.reliability,
      f.evidenceUrl,
      f.evidenceHash,
      f.recordState,
      f.supersedesId,
      admin,
    ],
  );
  await pg.query(
    `insert into private.research_fact_payloads values($1,$2,$3)`,
    [f.id, JSON.stringify(f), f.expiresAt],
  );
  return f;
}
async function current(id: string) {
  return (
    await pg.query<{ ok: boolean }>(
      `select private.research_fact_current($1,'XX:TEST')ok`,
      [id],
    )
  ).rows[0].ok;
}
test("14 private research tables have RLS and no browser grants or definer escalation", async () => {
  const rows = (
    await pg.query<{ relname: string; relrowsecurity: boolean }>(
      `select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private'and relname like 'research_%'and relkind='r'`,
    )
  ).rows;
  assert.equal(rows.length, 14);
  assert.ok(rows.every((r) => r.relrowsecurity));
  for (const role of ["anon", "authenticated", "docked_app"])
    assert.equal(
      (
        await pg.query<{ n: number }>(
          `select count(*)::int n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname like 'research_%' and has_function_privilege($1,p.oid,'EXECUTE')`,
          [role],
        )
      ).rows[0].n,
      0,
    );
});
test("source governance rejects member, insufficient MFA, arbitrary URLs and unreviewed publication permissions", async () => {
  const c = source();
  await claims(member, memberSession);
  await denied(() => register(c), /MFA/);
  await claims(admin, session, "aal1");
  await denied(() => register(c), /MFA/);
  await claims();
  await denied(
    () =>
      register({ ...c, publicDisplay: "INVALID" } as unknown as ResearchSource),
    /rights/,
  );
  await denied(
    () => register({ ...c, endpoint: "https://127.0.0.1/private" }),
    /rights/,
  );
});
test("manual fact retains nullable publication clock, hash/provenance and immutable correction history", async () => {
  const c = source(),
    id = await register(c),
    f = await fact(id, c);
  assert.equal(await current(f.id), true);
  await denied(
    () =>
      pg.query(
        `update private.research_facts set confidence='REPORTED'where id=$1`,
        [f.id],
      ),
    /immutable/,
  );
  await denied(
    () =>
      pg.query(`delete from private.research_fact_payloads where fact_id=$1`, [
        f.id,
      ]),
    /Unexpired/,
  );
  const correction = await fact(id, c, {
    sourceObservedAt: instant(),
    effectiveAt: instant(),
    supersedesId: f.id,
    correctionReason: "Corrected isolated availability",
    value: { status: "AVAILABLE", reason: "RETURN" },
  });
  assert.equal(await current(f.id), false);
  assert.equal(await current(correction.id), true);
});
test("rights withdrawal and display prohibition withdraw current content without deleting evidence", async () => {
  const c = source(),
    id = await register(c),
    f = await fact(id, c);
  await register(
    source({ sourceId: c.sourceId, rightsState: "PROHIBITED" }),
    id,
  );
  assert.equal(await current(f.id), false);
  assert.equal(
    (
      await pg.query<{ n: number }>(
        `select count(*)::int n from private.research_facts`,
      )
    ).rows[0].n,
    1,
  );
});
test("manual retention can exist without display permission but never becomes member-visible", async () => {
  const c = source({ publicDisplay: "DENIED" }),
    id = await register(c),
    f = await fact(id, c);
  assert.equal(await current(f.id), false);
});
test("future target result is denied and research cannot insert canonical settlements", async () => {
  const c = source(),
    id = await register(c);
  await denied(
    () =>
      fact(id, c, {
        type: "MATCH_RESULT",
        teamId: null,
        playerId: null,
        value: {
          homeGoals: 2,
          awayGoals: 1,
          period: "REGULATION",
          status: "FINAL",
        },
      }),
    /kickoff/,
  );
  assert.equal(
    (
      await pg.query<{ n: number }>(
        `select count(*)::int n from private.settlement_events`,
      )
    ).rows[0].n,
    0,
  );
});
test("duplicate source revision cannot manufacture corroboration", async () => {
  const c = source(),
    id = await register(c),
    f = await fact(id, c);
  await denied(
    () =>
      fact(id, c, {
        sourceItemId: f.sourceItemId,
        sourceRevision: f.sourceRevision,
      }),
    /duplicate key/,
  );
});
test("DB value boundary rejects caller-forged probability metric and duplicate lineup identities", async () => {
  const c = source(),
    id = await register(c);
  const f = await fact(id, c);
  const changed = { ...f, value: { probability: "0.9" } };
  await denied(
    () =>
      pg.query(`insert into private.research_fact_payloads values($1,$2,$3)`, [
        f.id,
        JSON.stringify(changed),
        f.expiresAt,
      ]),
    /immutable|payload/,
  );
  await denied(
    () =>
      fact(
        id,
        c,
        {
          type: "TEAM_STAT_UPDATE",
          playerId: null,
          value: {
            metric: "probability",
            value: "0.8",
            unit: "per_match",
            competitionId: "soccer_epl",
            season: "fictional",
            venue: "ALL",
            periodStart: instant(-10000),
            periodEnd: instant(-1000),
            sampleMatches: 10,
            sampleMinutes: null,
            opponentAdjustment: "UNADJUSTED",
            adjustmentVersion: null,
          },
        },
        true,
      ),
    /sporting statistic/,
  );
  await denied(
    () =>
      fact(
        id,
        c,
        {
          type: "CONFIRMED_LINEUP",
          playerId: null,
          value: { playerIds: Array(11).fill("same-player"), formation: null },
        },
        true,
      ),
    /Distinct structured lineup/,
  );
});

async function policy() {
  const c = {
    version: randomUUID(),
    jurisdiction: "XX:TEST",
    requiredFactTypes: ["PLAYER_INJURY"],
    maxFactAgeSeconds: 3600,
    windowsSeconds: [3600],
  };
  const r = (
    await pg.query<{ id: string }>(
      `insert into private.research_policies(version,configuration,config_hash,created_by,reason)values($1,$2,$3,$4,'Isolated completeness policy')returning id`,
      [c.version, JSON.stringify(c), phase5Hash(c), admin],
    )
  ).rows[0];
  return { id: r.id, configuration: c };
}
async function snap(c: ResearchSource, f: Awaited<ReturnType<typeof fact>>) {
  const pol = await policy(),
    e = (
      await pg.query<{ start_at: Date }>(
        `select start_at from private.events where id='research-event'`,
      )
    ).rows[0];
  const at = instant(),
    event = {
      eventId: "research-event",
      competitionId: "soccer_epl",
      homeTeam: "Home",
      awayTeam: "Away",
      homeTeamId: "Home",
      awayTeamId: "Away",
      startAt: new Date(e.start_at).toISOString(),
      status: "scheduled" as const,
      venue: null,
    };
  const file = buildMatchResearchFile({
    event,
    asOfTime: at,
    sources: [c],
    facts: [f],
    policy: { ...pol.configuration, requiredFactTypes: ["PLAYER_INJURY"] },
  });
  const manifest = {
    eventId: event.eventId,
    event,
    factIds: file.factIds,
    modelStatus: "NOT_CONFIGURED",
  };
  const id = (
    await pg.query<{ id: string }>(
      `insert into private.research_match_snapshots(event_id,policy_id,event_start_at,event_participants,as_of_time,fact_ids,manifest,manifest_hash,research_hash,created_by)values('research-event',$1,$2,'["Home","Away"]',$3,$4,$5,$6,$7,$8)returning id`,
      [
        pol.id,
        event.startAt,
        at,
        file.factIds,
        JSON.stringify(manifest),
        phase5Hash(manifest),
        file.snapshotHash,
        admin,
      ],
    )
  ).rows[0].id;
  return { id, file, policy: pol };
}
test("actual snapshot and editorial publication bind retained facts; later conflict blocks republishing", async () => {
  const c = source(),
    sid = await register(c),
    f = await fact(sid, c),
    s = await snap(c, f);
  const id = (
    await pg.query<{ id: string }>(
      `insert into private.research_content(snapshot_id,event_id,content_type,headline,fact_ids,created_by)values($1,'research-event','MATCH_UPDATE','Fictional match update',$2,$3)returning id`,
      [s.id, [f.id], admin],
    )
  ).rows[0].id;
  await pg.query(
    `insert into private.research_content_reviews(content_id,action,actor,reason)values($1,'PUBLISH',$2,'Isolated reviewed factual content')`,
    [id, admin],
  );
  await fact(sid, c, { value: { status: "AVAILABLE", reason: "RETURN" } });
  await denied(
    () =>
      pg.query(
        `insert into private.research_content_reviews(content_id,action,actor,reason)values($1,'PUBLISH',$2,'Conflicting evidence must block')`,
        [id, admin],
      ),
    /non-conflicting/,
  );
  await pg.query(
    `insert into private.research_content_reviews(content_id,action,actor,reason)values($1,'WITHDRAW',$2,'Withdraw factual content safely')`,
    [id, admin],
  );
  await denied(
    () =>
      pg.query(
        `update private.research_match_snapshots set fact_ids='{}'where id=$1`,
        [s.id],
      ),
    /immutable/,
  );
});
test("snapshot retains captured kickoff and participants after canonical schedule changes, while publication is denied", async () => {
  const c = source(),
    sid = await register(c),
    f = await fact(sid, c),
    s = await snap(c, f);
  await pg.exec(
    `update private.events set start_at=start_at+interval '1 day'where id='research-event'`,
  );
  const row = (
    await pg.query<{ manifest: { event: { startAt: string } } }>(
      `select manifest from private.research_match_snapshots where id=$1`,
      [s.id],
    )
  ).rows[0];
  assert.equal(row.manifest.event.startAt, s.file.event.startAt);
  await denied(
    () =>
      pg.query(
        `insert into private.research_content(snapshot_id,event_id,content_type,headline,fact_ids,created_by)values($1,'research-event','MATCH_UPDATE','Fictional changed event',$2,$3)`,
        [s.id, [f.id], admin],
      ),
    /snapshot event/,
  );
});
test("payload expiry permits bounded purge and retains immutable correction/audit metadata", async () => {
  const c = source(),
    sid = await register(c),
    f = await fact(sid, c, { expiresAt: instant(250) });
  await pg.exec(`select pg_sleep(0.3)`);
  await pg.query(
    `delete from private.research_fact_payloads where fact_id=$1`,
    [f.id],
  );
  assert.equal(await current(f.id), false);
  assert.equal(
    (
      await pg.query<{ n: number }>(
        `select count(*)::int n from private.research_facts where id=$1`,
        [f.id],
      )
    ).rows[0].n,
    1,
  );
});
test("source reviews expire fail-closed and fresh source version requires matching predecessor", async () => {
  const c = source(),
    id = await register(c);
  await denied(() => register(source({ sourceId: c.sourceId })), /review/);
  assert.equal(
    (
      await pg.query<{ ok: boolean }>(
        `select private.research_source_allowed($1,'DISPLAY','XX:TEST',$2)ok`,
        [id, instant(90000000)],
      )
    ).rows[0].ok,
    false,
  );
});
test("automatic request requires enabled flag, genuine lease and approved automation", async () => {
  const c = source(),
    id = await register(c),
    job = randomUUID();
  await pg.query(
    `insert into private.job_runs(id,dedupe_key,kind,state,payload,lease_token,lease_until)values($1::uuid,$1::text,'research-update','leased',$2,$3,clock_timestamp()+interval '1 hour')`,
    [job, JSON.stringify({ origin: "scheduled" }), randomUUID()],
  );
  await denied(
    () =>
      pg.query(
        `insert into private.research_fetch_requests(source_review_id,job_id)values($1,$2)`,
        [id, job],
      ),
    /lease/,
  );
});
test("actual durable request reservations enforce one in-flight request and daily quota, preserving failure usage", async () => {
  const c = source({
      accessMethod: "DATASET",
      rightsState: "APPROVED_AUTOMATED",
      automation: "ALLOWED",
      etiquette: { minimumIntervalSeconds: 1, maximumRequestsPerDay: 1 },
    }),
    sid = await register(c),
    pol = await policy();
  const schedule = (
    await pg.query<{ id: string }>(
      `insert into private.research_schedules(source_review_id,policy_id,enabled,created_by)values($1,$2,true,$3)returning id`,
      [sid, pol.id, admin],
    )
  ).rows[0].id;
  const e = (
      await pg.query<{ start_at: Date }>(
        `select start_at from private.events where id='research-event'`,
      )
    ).rows[0],
    job = randomUUID(),
    lease = randomUUID();
  await pg.query(
    `insert into private.job_runs(id,dedupe_key,kind,state,payload,lease_token,lease_until)values($1::uuid,$1::text,'research-update','leased',$2,$3,clock_timestamp()+interval '1 hour')`,
    [
      job,
      JSON.stringify({
        origin: "manual",
        actorId: admin,
        actorSessionId: session,
        scheduleId: schedule,
        eventId: "research-event",
        startAt: new Date(e.start_at).toISOString(),
        participantHash: phase5Hash(["Home", "Away"]),
      }),
      lease,
    ],
  );
  await pg.query(
    `select set_config('docked.research_job',$1,true),set_config('docked.research_lease',$2,true)`,
    [job, lease],
  );
  await denied(
    () =>
      pg.query(
        `insert into private.research_fetch_requests(source_review_id,job_id)values($1,$2)`,
        [sid, job],
      ),
    /disabled/,
  );
  await pg.exec(
    `update private.feature_flags set enabled=true where key='research_engine'`,
  );
  const id = (
    await pg.query<{ id: string }>(
      `insert into private.research_fetch_requests(source_review_id,job_id)values($1,$2)returning id`,
      [sid, job],
    )
  ).rows[0].id;
  await denied(
    () =>
      pg.query(
        `insert into private.research_fetch_requests(source_review_id,job_id)values($1,$2)`,
        [sid, job],
      ),
    /quota/,
  );
  await pg.query(
    `update private.research_fetch_requests set status='FAILED',http_status=429,error_code='SOURCE_RATE_LIMITED',retry_after=clock_timestamp()+interval '2 days'where id=$1`,
    [id],
  );
  await denied(
    () =>
      pg.query(
        `update private.research_fetch_requests set status='SUCCESS'where id=$1`,
        [id],
      ),
    /immutable/,
  );
  await denied(
    () =>
      pg.query(`delete from private.research_fetch_requests where id=$1`, [id]),
    /retained/,
  );
  assert.equal(
    (
      await pg.query<{ n: number }>(
        `select count(*)::int n from private.research_fetch_requests where source_review_id=$1`,
        [sid],
      )
    ).rows[0].n,
    1,
  );
  await pg.exec(
    `update public.profiles set disabled_at=clock_timestamp()where id='${admin}'`,
  );
  await denied(
    () => pg.query(`select private.research_worker($1)`, [job]),
    /withdrawn/,
  );
});
test("strict feature registry accepts display-only definition but cannot activate unconfigured model or override predictions", async () => {
  const c = {
    schemaVersion: "research-feature-v1",
    featureId: "availability",
    version: "1",
    state: "DISPLAY_ONLY",
    inputKind: "STRUCTURED_SPORTING_FACT",
    factTypes: ["PLAYER_INJURY"],
    transformId: "presence",
    transformVersion: "1",
    modelVersion: null,
    modelConfigHash: null,
    causalRationale: "An isolated descriptive availability feature only.",
    limitations: "No fitted estimator",
    acceptedConfidence: ["CONFIRMED"],
    maxAgeSeconds: 3600,
    trainingCutoff: null,
    reviewedAt: instant(-100),
    effectiveFrom: instant(-100),
    effectiveTo: instant(3600000),
    reviewReference: "Isolated review",
  };
  const insert = async (
    configuration: typeof c,
    supersedes: string | null = null,
  ) =>
    pg.query<{ id: string }>(
      `insert into private.research_feature_versions(feature_key,version,configuration,config_hash,supersedes,created_by,reason)values($1,$2,$3,$4,$5,$6,'Isolated feature review')returning id`,
      [
        configuration.featureId,
        configuration.version,
        JSON.stringify(configuration),
        phase5Hash(configuration),
        supersedes,
        admin,
      ],
    );
  const id = (await insert(c)).rows[0].id;
  await denied(
    () => insert({ ...c, version: "2", state: "MODEL_ACTIVE" }, id),
    /model configuration/,
  );
  await denied(
    () =>
      pg.query(
        `update private.research_feature_versions set configuration='{}'where id=$1`,
        [id],
      ),
    /append-only/,
  );
});
test("reviewed dataset persistence remains separate from facts, predictions and settlement authority", async () => {
  const c = source({
      accessMethod: "DATASET",
      rightsState: "APPROVED_AUTOMATED",
      automation: "ALLOWED",
      etiquette: { minimumIntervalSeconds: 1, maximumRequestsPerDay: 1 },
    }),
    sid = await register(c),
    pol = await policy();
  const schedule = (
    await pg.query<{ id: string }>(
      `insert into private.research_schedules(source_review_id,policy_id,enabled,created_by)values($1,$2,true,$3)returning id`,
      [sid, pol.id, admin],
    )
  ).rows[0].id;
  const e = (
      await pg.query<{ start_at: Date }>(
        `select start_at from private.events where id='research-event'`,
      )
    ).rows[0],
    job = randomUUID(),
    lease = randomUUID();
  await pg.query(
    `insert into private.job_runs(id,dedupe_key,kind,state,payload,lease_token,lease_until)values($1::uuid,$1::text,'research-update','leased',$2,$3,clock_timestamp()+interval '1 hour')`,
    [
      job,
      JSON.stringify({
        origin: "manual",
        actorId: admin,
        actorSessionId: session,
        scheduleId: schedule,
        eventId: "research-event",
        startAt: new Date(e.start_at).toISOString(),
        participantHash: phase5Hash(["Home", "Away"]),
      }),
      lease,
    ],
  );
  await pg.query(
    `select set_config('docked.research_job',$1,true),set_config('docked.research_lease',$2,true)`,
    [job, lease],
  );
  await pg.exec(
    `update private.feature_flags set enabled=true where key='research_engine'`,
  );
  const request = (
    await pg.query<{ id: string }>(
      `insert into private.research_fetch_requests(source_review_id,job_id)values($1,$2)returning id`,
      [sid, job],
    )
  ).rows[0].id;
  const observed = (
    await pg.query<{ now: Date }>(`select clock_timestamp() now`)
  ).rows[0].now;
  const data = parseOpenFootballDataset(
    {
      name: "English Premier League 2025/26",
      matches: [
        {
          round: "Matchday 1",
          date: "2025-08-01",
          team1: "Fictional Home",
          team2: "Fictional Away",
          score: { ft: [1, 0] },
        },
      ],
    },
    {
      sourceId: c.sourceId,
      sourceVersion: c.version,
      observedAt: new Date(observed).toISOString(),
    },
  );
  const id = (
    await pg.query<{ id: string }>(
      `insert into private.research_dataset_snapshots(source_review_id,request_id,observed_at,raw_hash,payload_hash,record_count,quality)values($1,$2,$3,$4,$5,1,$6)returning id`,
      [
        sid,
        request,
        data.sourceObservedAt,
        "a".repeat(64),
        phase5Hash(data),
        JSON.stringify(openFootballQualityReport(data)),
      ],
    )
  ).rows[0].id;
  await pg.query(
    `insert into private.research_dataset_payloads values($1,$2,$3)`,
    [id, JSON.stringify(data), instant(600000)],
  );
  await pg.query(
    `update private.research_fetch_requests set status='SUCCESS',http_status=200,response_hash=$2,measured='{"records":1,"modelReady":false,"settlementReady":false}'where id=$1`,
    [request, "a".repeat(64)],
  );
  await denied(
    () =>
      pg.query(
        `update private.research_dataset_snapshots set record_count=2 where id=$1`,
        [id],
      ),
    /immutable/,
  );
  for (const table of [
    "research_facts",
    "football_model_attempts",
    "settlement_events",
    "tip_publications",
  ])
    assert.equal(
      (
        await pg.query<{ n: number }>(
          `select count(*)::int n from private.${table}`,
        )
      ).rows[0].n,
      0,
    );
});
