import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import {
  buildMarketReference,
  marketReferenceV1,
  type MarketSourceObservation,
} from "../../src/core/market-reference";
import { hash } from "../../src/core/pricing";
import { scannerCandidateKey } from "../../src/core/edge-scanner";
import { MarketBaselineModel } from "../../src/providers/model";
import { referenceStrategyV2 } from "../../src/core/reference-pricing";
import {
  scannerMaintenanceCountsSQL,
  scannerDailyCountsSQL,
} from "../../src/server/scanner-queries";
// Entirely fictional, disposable PostgreSQL data; never imported into any website database.
let pg: PGlite, policy: string;
const member = randomUUID(),
  other = randomUUID(),
  admin = randomUUID(),
  sid = randomUUID(),
  otherSid = randomUUID(),
  adminSid = randomUUID(),
  profile = randomUUID(),
  otherProfile = randomUUID();
before(async () => {
  pg = new PGlite();
  await pg.exec(`create role anon;create role authenticated;create schema auth;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    grant usage on schema auth to authenticated;grant execute on all functions in schema auth to authenticated;`);
  for (const file of (await readdir("supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await pg.exec(`insert into auth.users(id,email_confirmed_at) values('${member}',now()),('${other}',now()),('${admin}',now());
    insert into auth.sessions values('${sid}','${member}',null),('${otherSid}','${other}',null),('${adminSid}','${admin}',null);
    insert into public.profiles(id,country,state,age_attested,accepted_version) values('${member}','XX','TEST',true,'fixture'),('${other}','XX','TEST',true,'fixture'),('${admin}','XX','TEST',true,'fixture');
    insert into private.roles values('${admin}','admin');
    insert into private.social_profiles(id,user_id,handle,display_name) values('${profile}','${member}','fixtureone','Fictional member one'),('${otherProfile}','${other}','fixturetwo','Fictional member two');
    insert into private.sports(id,name) values('football','Fixture football') on conflict do nothing;
    insert into private.competitions(id,sport_id,rules) values('soccer_epl','football','{}') on conflict do nothing;
    insert into private.source_health(provider,healthy,last_success,rights_reference,capabilities) values('fixture-odds',true,clock_timestamp(),'fictional-isolated-rights','{"display":true,"retention":true,"community_standard_prices":true}');
    update private.feature_flags set enabled=true where key='community_edges';`);
  policy = (
    await pg.query<{ id: string }>(
      `insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,operators,evidence) values('XX','TEST','isolated',now()-interval '1 day',now()+interval '1 day',now()+interval '1 day',true,18,'{community_social,community_edges,public_profiles,leaderboards,market_data}','{fixture-book}','Fictional isolated approval') returning id`,
    )
  ).rows[0].id;
  await pg.query(
    `insert into private.bookmaker_eligibility(bookmaker,operator_group,region_policy_id,approved,effective_from,effective_to,rights_reference) values('fixture-book','fixture-group',$1,true,now()-interval '1 day',now()+interval '1 day','fictional')`,
    [policy],
  );
  await claims();
});
after(async () => {
  await pg?.close();
});
async function claims(who = member, session = sid, aal = "aal1") {
  await pg.query(
    "select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",
    [who, JSON.stringify({ sub: who, session_id: session, aal })],
  );
}
async function market(
  options: {
    omitRule?: string;
    classification?: string;
    flags?: string[];
    metadata?: boolean;
    startSeconds?: number;
    sourceAge?: number;
  } = {},
) {
  const event = `isolated-${randomUUID()}`,
    id = `snapshot-${randomUUID()}`,
    marketId = `market-${event}`;
  const clock = (await pg.query<{ now: Date }>("select clock_timestamp() now"))
    .rows[0].now;
  const now = new Date(clock).getTime(),
    start = new Date(now + (options.startSeconds ?? 3600) * 1000).toISOString(),
    source = new Date(now - (options.sourceAge ?? 5) * 1000).toISOString(),
    received = new Date(now).toISOString();
  const rules = {
    eventId: event,
    competition: "soccer_epl",
    participants: ["Fictional A", "Fictional B"],
    market: "football_1x2",
    period: "full_game",
    overtime: false,
    draw: true,
    line: null,
    settlement: "regulation_90_plus_stoppage",
    outcomes: ["Fictional A", "Draw", "Fictional B"],
  };
  if (options.omitRule)
    delete (rules as Record<string, unknown>)[options.omitRule];
  const payload = {
    id,
    bookmaker: "fixture-book",
    operator: "fixture-group",
    approved: true,
    rules,
    prices: { "Fictional A": "2.501", Draw: "3", "Fictional B": "3" },
    sourceAt: source,
    snapshotAt: received,
    receivedAt: received,
    suspended: false,
    ...(options.metadata === false
      ? {}
      : {
          communityMetadata: {
            sourceKind: "current_provider",
            sourceType: "bookmaker",
            receivedByDocked: true,
            providerEventId: event,
            observedStartAt: start,
            priceClass: options.classification ?? "STANDARD_VERIFIED",
            classificationVersion: "fixture-v1",
            classificationEvidence:
              "Fictional classification, isolated test only",
            promotionFlags: options.flags ?? [],
          },
        }),
  };
  await pg.query(
    `insert into private.events(id,competition_id,participants,start_at,source_mappings) values($1,'soccer_epl',$2,$3,$4)`,
    [
      event,
      JSON.stringify(rules.participants),
      start,
      JSON.stringify({ "fixture-odds": event, "fixture-results": event }),
    ],
  );
  await pg.query(
    `insert into private.markets(id,event_id,rules,rules_hash) values($1,$2,$3,$4)`,
    [marketId, event, JSON.stringify(rules), randomUUID()],
  );
  await pg.query(
    `insert into private.odds_snapshots(id,market_id,provider,bookmaker,source_at,snapshot_at,received_at,payload,provenance,evidence) values($1,$2,'fixture-odds','fixture-book',$3,$4,$4,$5,'fictional-isolated-rights','forward_paper')`,
    [id, marketId, source, received, JSON.stringify(payload)],
  );
  return { id, marketId, event, start, source, received, rules, payload };
}
type Market = Awaited<ReturnType<typeof market>>;
async function register(m: Market) {
  return (
    await pg.query<{ id: string }>(
      `insert into private.community_quote_evidence(snapshot_id,provider_event_id,observed_start_at,classification,classification_version,classification_evidence,rights_reference,metadata) values($1,'ignored',now(),'STANDARD_VERIFIED','ignored','ignored','ignored','{}') returning id`,
      [m.id],
    )
  ).rows[0].id;
}
async function referenceFixture(omitRule?: string) {
  await claims();
  const m = await market({ omitRule });
  await register(m);
  const books = [
    "fixture-book",
    "fixture-second",
    "fixture-pricing-a",
    "fixture-pricing-b",
  ];
  await pg.query(
    "update private.region_policies set operators=$1 where id=$2",
    [books, policy],
  );
  const sources: MarketSourceObservation[] = [];
  for (const [index, bookmaker] of books.entries()) {
    const id = index ? randomUUID() : m.id,
      operator = index ? `fixture-group-${index}` : "fixture-group";
    const payload = {
      ...m.payload,
      id,
      bookmaker,
      operator,
      prices:
        index >= 2
          ? { "Fictional A": "2.10", Draw: "3.60", "Fictional B": "3.60" }
          : {
              "Fictional A": index ? "2.55" : "2.501",
              Draw: "3",
              "Fictional B": "3",
            },
    };
    if (index) {
      await pg.query(
        `insert into private.bookmaker_eligibility(bookmaker,operator_group,region_policy_id,approved,effective_from,effective_to,rights_reference) values($1,$2,$3,true,now()-interval '1 day',now()+interval '1 day','fictional') on conflict do nothing`,
        [bookmaker, operator, policy],
      );
      await pg.query(
        `insert into private.odds_snapshots(id,market_id,provider,bookmaker,source_at,snapshot_at,received_at,payload,provenance,evidence) values($1,$2,'fixture-odds',$3,$4,$5,$5,$6,'fictional-isolated-rights','forward_paper')`,
        [
          id,
          m.marketId,
          bookmaker,
          m.source,
          m.received,
          JSON.stringify(payload),
        ],
      );
      await register({ ...m, id });
    }
    sources.push({
      ...payload,
      provider: "fixture-odds",
      sourceKind: "bookmaker",
      licensed: true,
      rightsReference: "fictional-isolated-rights",
      ownershipEvidence: "fictional",
      mappingVerified: true,
      feedHealthy: true,
      priceClass: "STANDARD_VERIFIED",
      classificationVersion: "fixture-v1",
      classificationEvidence: "Fictional classification, isolated test only",
      promotionFlags: [],
      provenance: "current_provider",
    } as MarketSourceObservation);
  }
  const configuration = {
    ...marketReferenceV1,
    availabilityBookmakers: books.slice(0, 2),
    pricingBookmakers: books.slice(2),
  };
  const at = new Date(
    (await pg.query<{ at: Date }>("select clock_timestamp() at")).rows[0].at,
  ).toISOString();
  const safeRules = {
    ...m.rules,
    period: "full_game" as const,
    overtime: false,
    draw: true,
  };
  const result = buildMarketReference(
    {
      rules: safeRules as MarketSourceObservation["rules"],
      startAt: m.start,
      observedAt: at,
      selection: "Fictional A",
      sources: sources.map((source) => ({
        ...source,
        rules: safeRules as MarketSourceObservation["rules"],
      })),
    },
    configuration,
  );
  assert.equal(result.status, "READY");
  if (result.status !== "READY")
    throw new Error("Fixture reference unavailable");
  const r = result.reference;
  if (omitRule) r.rulesHash = hash(m.rules);
  async function retain(price = r.decimalPrice) {
    return (
      await pg.query<{ id: string }>(
        `insert into private.market_references(market_id,selection,methodology_version,config_hash,configuration,reference,snapshot_ids,decimal_price,observed_at,region_policy_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
        [
          m.marketId,
          r.selection,
          r.methodologyVersion,
          r.configHash,
          JSON.stringify(configuration),
          JSON.stringify({ ...r, decimalPrice: price }),
          [...r.availability.sourceIds, ...(r.pricing?.sourceIds ?? [])],
          price,
          r.observedAt,
          policy,
        ],
      )
    ).rows[0].id;
  }
  return { m, r, configuration, sources, retain };
}

const commit = "c".repeat(40);
async function scannerFixture() {
  await claims(admin, adminSid, "aal2");
  const f = await referenceFixture(),
    referenceId = await f.retain();
  await claims(admin, adminSid, "aal2");
  const strategy = {
    ...referenceStrategyV2,
    version: `market-reference-edge-scanner-${randomUUID()}`,
    marketReference: f.configuration,
  };
  await pg.query(
    `insert into private.strategy_versions(id,config,config_hash,code_commit,lifecycle) values($1,$2,$3,$4,'RESEARCH')`,
    [strategy.version, JSON.stringify(strategy), hash(strategy), commit],
  );
  const lease = randomUUID();
  const job = (
    await pg.query<{ id: string }>(
      `insert into private.job_runs(dedupe_key,kind,payload,state,lease_token,lease_until) values($1,'edge-scan',$2,'leased',$3,clock_timestamp()+interval '5 minutes') returning id`,
      [
        randomUUID(),
        JSON.stringify({
          origin: "manual",
          actorId: admin,
          actorSessionId: adminSid,
        }),
        lease,
      ],
    )
  ).rows[0].id;
  await pg.query(
    `select set_config('docked.scanner_job',$1,false),set_config('docked.scanner_lease',$2,false),set_config('docked.scanner_commit',$3,false)`,
    [job, lease, commit],
  );
  const run = (
    await pg.query<{ id: string }>(
      `insert into private.scanner_runs(job_id,purpose,strategy_id,region_policy_id) values($1,'research',$2,$3) returning id`,
      [job, strategy.version, policy],
    )
  ).rows[0].id;
  const model = new MarketBaselineModel(f.configuration).estimate({
    rules: f.m.rules as MarketSourceObservation["rules"],
    startAt: f.m.start,
    observedAt: f.r.observedAt,
    selection: f.r.selection,
    sources: f.sources,
    asOfTime: f.r.observedAt,
    generatedAt: f.r.observedAt,
    codeCommit: commit,
  });
  assert.equal(model.status, "READY");
  assert.equal(
    model.status === "READY" && model.referenceHash,
    f.r.evidenceHash,
    "model exactly binds fixture reference",
  );

  const p = Number(f.r.pricing!.probability),
    minimum = Math.ceil((1.03 / p) * 100) / 100;
  const key = scannerCandidateKey({
    marketId: f.m.marketId,
    strategyId: strategy.version,
    strategyHash: hash(strategy),
    selection: f.r.selection,
    purpose: "research",
    sourceIds: [...f.r.availability.sourceIds, ...f.r.pricing!.sourceIds],
    windowSeconds: 3600,
    regionPolicyId: policy,
  });
  async function insert(
    changes: {
      probability?: number;
      purpose?: string;
      model?: unknown;
      key?: string;
    } = {},
  ) {
    return (
      await pg.query<{ id: string }>(
        `insert into private.scanner_candidates(dedupe_key,run_id,event_id,market_id,strategy_id,strategy_hash,code_commit,region_policy_id,purpose,selection,market_reference_id,model_version,model_evidence,probability,fair_odds,minimum_odds,required_ev,estimated_ev,window_seconds,scanned_at,expires_at,origin,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'market-reference-baseline-v1',$12,$13,$14,$15,.03,$16,3600,$17,$18,'manual',$19) returning id`,
        [
          changes.key ?? key,
          run,
          f.m.event,
          f.m.marketId,
          strategy.version,
          hash(strategy),
          commit,
          policy,
          changes.purpose ?? "research",
          f.r.selection,
          referenceId,
          JSON.stringify(changes.model ?? model),
          changes.probability ?? f.r.pricing!.probability,
          1 / p,
          minimum,
          p * Number(f.r.decimalPrice) - 1,
          f.r.observedAt,
          new Date(Date.parse(f.r.observedAt) + 110000).toISOString(),
          admin,
        ],
      )
    ).rows[0].id;
  }
  return { f, strategy, referenceId, model, run, job, lease, insert };
}

test("scanner and current-data tables deny browser reads, writes, escalation and helper execution", async () => {
  const tables = [
    "scanner_schedules",
    "scanner_runs",
    "scanner_run_markets",
    "scanner_candidates",
    "scanner_reviews",
    "operational_alerts",
    "community_recognition_snapshots",
    "market_data_config",
    "market_data_payloads",
    "market_data_event_mappings",
    "market_data_fixture_observations",
  ];
  for (const name of tables) {
    const row = (
      await pg.query<{ relrowsecurity: boolean; granted: boolean }>(
        `select c.relrowsecurity,has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE') granted from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname=$1`,
        [name],
      )
    ).rows[0];
    assert.equal(row.relrowsecurity, true);
    assert.equal(row.granted, false);
  }
  await pg.exec("set role authenticated");
  await assert.rejects(
    pg.query("select * from private.scanner_candidates"),
    /permission denied/,
  );
  await assert.rejects(
    pg.query("select private.scanner_assert_actor(false)"),
    /permission denied/,
  );
  await assert.rejects(
    pg.query("select private.purge_expired_market_payloads()"),
    /permission denied/,
  );
  await pg.exec("reset role");
});
test("staff writes require current actual MFA; analyst cannot manage and auditor cannot mutate", async () => {
  await claims(admin, adminSid, "aal1");
  await assert.rejects(
    pg.query("select private.scanner_assert_actor(false)"),
    /MFA/,
  );
  await claims();
  await assert.rejects(
    pg.query("select private.scanner_assert_actor(false)"),
    /MFA/,
  );
  await pg.query(
    `insert into private.roles(user_id,role) values($1,'auditor')`,
    [other],
  );
  await claims(other, otherSid, "aal2");
  await assert.rejects(
    pg.query("select private.scanner_assert_actor(false)"),
    /MFA/,
  );
  await pg.query(`delete from private.roles where user_id=$1`, [other]);
  await pg.query(
    `insert into private.roles(user_id,role) values($1,'analyst')`,
    [other],
  );
  await pg.query("select private.scanner_assert_actor(false)");
  await assert.rejects(
    pg.query("select private.scanner_assert_actor(true)"),
    /MFA/,
  );
  await claims(admin, adminSid, "aal2");
  await pg.query("select private.scanner_assert_actor(true)");
});
test("candidate uses canonical probability, immutable model evidence and real worker lease; retries cannot duplicate", async () => {
  const f = await scannerFixture();
  await assert.rejects(
    f.insert({ probability: 0.9 }),
    /shared strategy calculation/,
  );
  await assert.rejects(
    f.insert({ model: { ...f.model, advantageClaim: true } }),
    /Trusted current/,
  );
  await assert.rejects(f.insert({ purpose: "live" }), /Trusted current/);
  await pg.query(`select set_config('docked.scanner_lease',$1,false)`, [
    randomUUID(),
  ]);
  await assert.rejects(f.insert(), /worker lease/);
  await pg.query(`select set_config('docked.scanner_lease',$1,false)`, [
    f.lease,
  ]);
  const id = await f.insert();
  await assert.rejects(f.insert(), /duplicate key/);
  await assert.rejects(
    pg.query(
      "update private.scanner_candidates set probability=.99 where id=$1",
      [id],
    ),
    /Append-only/,
  );
  await assert.rejects(
    pg.query("delete from private.scanner_candidates where id=$1", [id]),
    /Append-only/,
  );
  await pg.query(
    `insert into private.scanner_run_markets(run_id,market_id,event_id,outcome) values($1,$2,$3,'{"ready":true,"inserted":1}')`,
    [f.run, f.f.m.marketId, f.f.m.event],
  );
  await assert.rejects(
    pg.query(
      `insert into private.scanner_run_markets(run_id,market_id,event_id,outcome) values($1,$2,$3,'{}')`,
      [f.run, f.f.m.marketId, f.f.m.event],
    ),
    /duplicate key/,
  );
  await assert.rejects(
    pg.query(
      "update private.scanner_run_markets set outcome='{}' where run_id=$1",
      [f.run],
    ),
    /Append-only/,
  );
});
test("research approval remains private and immutable; it cannot create paper/live publications", async () => {
  const f = await scannerFixture(),
    id = await f.insert();
  await pg.query(
    `insert into private.scanner_reviews(candidate_id,status,actor,reason,market_reference_id) values($1,'APPROVED',$2,'Fictional isolated research review',$3)`,
    [id, admin, f.referenceId],
  );
  assert.equal(
    (
      await pg.query<{ count: number }>(
        "select count(*)::int count from private.tip_publications",
      )
    ).rows[0].count,
    0,
  );
  await assert.rejects(
    pg.query(
      `insert into private.scanner_reviews(candidate_id,status,actor,reason,market_reference_id) values($1,'APPROVED',$2,'Duplicate research review',$3)`,
      [id, admin, f.referenceId],
    ),
    /final/,
  );
  await assert.rejects(
    pg.query("delete from private.scanner_reviews where candidate_id=$1", [id]),
    /Append-only/,
  );
  const row = (
    await pg.query<{ paper: boolean; live: boolean }>(
      `select private.scanner_strategy_allowed($1,'paper') paper,private.scanner_strategy_allowed($1,'live') live`,
      [f.strategy.version],
    )
  ).rows[0];
  assert.deepEqual(row, { paper: false, live: false });
});
test("approval rechecks provider outage and regional feature revocation, without discarding the candidate", async () => {
  const f = await scannerFixture(),
    id = await f.insert();
  await pg.exec(
    `update private.source_health set healthy=false where provider='fixture-odds'`,
  );
  await assert.rejects(
    pg.query(
      `insert into private.scanner_reviews(candidate_id,status,actor,reason,market_reference_id) values($1,'APPROVED',$2,'Fictional revalidation test',$3)`,
      [id, admin, f.referenceId],
    ),
    /reference|current|fresh|health/i,
  );
  await pg.exec(
    `update private.source_health set healthy=true where provider='fixture-odds'`,
  );
  await pg.query(
    `update private.region_policies set features=array_remove(features,'market_data') where id=$1`,
    [policy],
  );
  await assert.rejects(
    pg.query(
      `insert into private.scanner_reviews(candidate_id,status,actor,reason,market_reference_id) values($1,'APPROVED',$2,'Fictional region revocation',$3)`,
      [id, admin, f.referenceId],
    ),
    /no longer qualifies/,
  );
  assert.equal(
    (
      await pg.query<{ count: number }>(
        "select count(*)::int count from private.scanner_candidates where id=$1",
        [id],
      )
    ).rows[0].count,
    1,
  );
  await pg.query(
    `update private.region_policies set features=array_append(features,'market_data') where id=$1`,
    [policy],
  );
  await pg.query(
    `insert into private.scanner_reviews(candidate_id,status,actor,reason,category) values($1,'REJECTED',$2,'Fictional operational rejection','editorial_operational')`,
    [id, admin],
  );
});

// Every value below is authored fictional input in a disposable PostgreSQL engine.
import { phase5Hash, phase5Canonical } from "../../src/core/phase5-hash";
import {
  canonicalProviderEventId,
  fixtureRules,
} from "../../src/providers/market-data";
import type { ProviderFixture } from "../../src/core/market-data";
test("new audit hash format matches SQL for exponent numbers, mixed-case and Unicode keys without rewriting legacy hashes", async () => {
  const payload = {
    windowToleranceSeconds: 120,
    windowsSeconds: [3600],
    maxEV: "0.20",
    small: 1e-7,
    large: 1e21,
    zero: -0,
    Book_A: { "book-a": 2.5, "\uE000": 1, "😀": 2 },
  };
  const result = (
    await pg.query<{ canonical: string; hash: string }>(
      `select private.phase5_canonical_json($1::jsonb) canonical,encode(sha256(convert_to(private.phase5_canonical_json($1::jsonb),'UTF8')),'hex') hash`,
      [JSON.stringify(payload)],
    )
  ).rows[0];
  assert.equal(result.canonical, phase5Canonical(payload));
  assert.equal(result.hash, phase5Hash(payload));
  assert.notEqual(hash(payload), phase5Hash(payload));
});
test("licensed current-data receipts and canonical mappings are guarded, immutable and purge after expiry even when disabled", async () => {
  await claims(admin, adminSid, "aal2");
  const now = new Date(
    (await pg.query<{ at: Date }>("select clock_timestamp() at")).rows[0].at,
  ).getTime();
  const before = new Date(now - 86400000).toISOString(),
    after = new Date(now + 86400000).toISOString();
  let receivedAt = new Date(now).toISOString();
  const book = {
    operator: "fixture-market-operator",
    ownershipEvidence: "Fictional documented independent ownership",
    sourceType: "bookmaker",
    classification: "STANDARD_VERIFIED",
    classificationVersion: "fixture-v1",
    classificationEvidence: "Fictional classification for isolated test",
    knownAt: before,
    effectiveFrom: before,
    effectiveTo: after,
  };
  const cfg = {
    version: "market-data-v1.0.0",
    provider: "the-odds-api",
    rights: {
      reference: "fictional-local-only-rights",
      display: true,
      storage: true,
      derived: true,
      rawRetentionDays: 1,
    },
    monthlyCreditLimit: 100,
    pollIntervalSeconds: 60,
    horizonHours: 24,
    maxEvents: 10,
    maxRequestsPerRun: 2,
    regions: ["au"],
    competitions: [
      {
        providerCompetitionId: "soccer_epl",
        competitionId: "soccer_epl",
        sport: "football",
        displayName: "Fictional league",
        mappingEvidence: "Fictional exact mapping record",
      },
    ],
    bookmakers: { fixture_market: book },
  };
  const insertConfig = async (configuration: unknown) =>
    (
      await pg.query<{ id: string }>(
        `insert into private.market_data_config(provider,version,config_hash,configuration,enabled,effective_from,effective_to,rights_reference,reviewed_by) values('the-odds-api','market-data-v1.0.0',$1,$2,true,$3,$4,'fictional-local-only-rights',$5) returning id`,
        [
          phase5Hash(configuration),
          JSON.stringify(configuration),
          before,
          after,
          admin,
        ],
      )
    ).rows[0].id;
  await assert.rejects(
    insertConfig({ ...cfg, rights: { ...cfg.rights, storage: false } }),
    /reviewed|rights/i,
  );
  const cfgId = await insertConfig(cfg);
  receivedAt = new Date(
    (await pg.query<{ at: Date }>("select clock_timestamp() at")).rows[0].at,
  ).toISOString();
  await assert.rejects(
    pg.query(
      `update private.market_data_config set rights_reference='different' where id=$1`,
      [cfgId],
    ),
    /new reviewed version/,
  );
  const payload = {
      fixtures: [{ id: "fictional-event" }],
      value: 1e-7,
      large: 1e21,
    },
    rawId = phase5Hash({ provider: cfg.provider, payload, receivedAt });
  await assert.rejects(
    pg.query(
      `insert into private.market_data_payloads values($1,'the-odds-api',$2,$3,'fictional-local-only-rights',$4)`,
      ["a".repeat(64), JSON.stringify(payload), receivedAt, after],
    ),
    /retention/,
  );
  await pg.query(
    `insert into private.market_data_payloads values($1,'the-odds-api',$2,$3,'fictional-local-only-rights',$4)`,
    [
      rawId,
      JSON.stringify(payload),
      receivedAt,
      new Date(now + 2200).toISOString(),
    ],
  );
  await assert.rejects(
    pg.query(`delete from private.market_data_payloads where id=$1`, [rawId]),
    /expired/,
  );
  const f: ProviderFixture = {
    provider: "the-odds-api",
    providerEventId: `fixture-market-${randomUUID()}`,
    providerCompetitionId: "soccer_epl",
    competitionId: "soccer_epl",
    sport: "football",
    competition: "Fictional league",
    participants: ["Fictional C", "Fictional D"],
    startAt: new Date(now + 3600000).toISOString(),
    status: "scheduled",
    observedAt: receivedAt,
    sourceUpdatedAt: null,
  };
  const eventId = canonicalProviderEventId(f.provider, f.providerEventId),
    rules = fixtureRules(f)!;
  await pg.query(
    `insert into private.events(id,competition_id,participants,start_at,source_mappings) values($1,'soccer_epl',$2,$3,$4)`,
    [
      eventId,
      JSON.stringify(f.participants),
      f.startAt,
      JSON.stringify({ [f.provider]: f.providerEventId }),
    ],
  );
  await assert.rejects(
    pg.query(
      `insert into private.market_data_event_mappings(provider,provider_event_id,event_id,provider_competition_id,canonical_competition_id,mapping_evidence) values('the-odds-api',$1,$2,'soccer_epl','soccer_epl','unreviewed')`,
      [f.providerEventId, eventId],
    ),
    /mapping/,
  );
  await pg.query(
    `insert into private.market_data_event_mappings(provider,provider_event_id,event_id,provider_competition_id,canonical_competition_id,mapping_evidence) values('the-odds-api',$1,$2,'soccer_epl','soccer_epl',$3)`,
    [f.providerEventId, eventId, cfg.competitions[0].mappingEvidence],
  );
  const fixtureId = phase5Hash({ provider: f.provider, eventId, fixture: f });
  await pg.query(
    `insert into private.market_data_fixture_observations values($1,$2,$3,$4,$5,$6,$7)`,
    [
      fixtureId,
      f.provider,
      eventId,
      f.providerEventId,
      f.observedAt,
      JSON.stringify(f),
      rawId,
    ],
  );
  const marketId = hash(rules);
  await pg.query(
    `insert into private.markets(id,event_id,rules,rules_hash) values($1,$2,$3,$1)`,
    [marketId, eventId, JSON.stringify(rules)],
  );
  const q = {
    id: `market-${randomUUID()}`,
    bookmaker: "fixture_market",
    operator: book.operator,
    approved: true,
    rules,
    prices: { "Fictional C": "2", "Fictional D": "3", Draw: "3" },
    sourceAt: receivedAt,
    snapshotAt: receivedAt,
    receivedAt,
    suspended: false,
    rawPayloadId: rawId,
    communityMetadata: {
      sourceKind: "current_provider",
      sourceType: "bookmaker",
      receivedByDocked: true,
      providerEventId: f.providerEventId,
      observedStartAt: f.startAt,
      priceClass: "STANDARD_VERIFIED",
      classificationVersion: book.classificationVersion,
      classificationEvidence: book.classificationEvidence,
      promotionFlags: [],
    },
  };
  const insertQuote = (body: unknown) =>
    pg.query(
      `insert into private.odds_snapshots(id,market_id,provider,bookmaker,source_at,snapshot_at,received_at,payload,raw_private_path,provenance,evidence) values($1,$2,'the-odds-api','fixture_market',$3,$3,$3,$4,$5,'fictional-local-only-rights','market_data')`,
      [q.id, marketId, receivedAt, JSON.stringify(body), `db:${rawId}`],
    );
  await assert.rejects(insertQuote({ ...q, receivedAt: before }), /provenance/);
  await assert.rejects(
    insertQuote({
      ...q,
      communityMetadata: {
        ...q.communityMetadata,
        classificationEvidence: "invented",
      },
    }),
    /classification/,
  );
  await insertQuote(q);
  assert.equal(
    (
      await pg.query<{ allowed: boolean }>(
        "select private.market_data_source_current($1,clock_timestamp()) allowed",
        [q.id],
      )
    ).rows[0].allowed,
    true,
  );
  await pg.query(
    `update private.market_data_config set enabled=false where id=$1`,
    [cfgId],
  );
  assert.equal(
    (
      await pg.query<{ allowed: boolean }>(
        "select private.market_data_source_current($1,clock_timestamp()) allowed",
        [q.id],
      )
    ).rows[0].allowed,
    false,
  );
  await new Promise((resolve) => setTimeout(resolve, 2300));
  const purged = (
    await pg.query<{ deleted: number }>(
      "select private.purge_expired_market_payloads() deleted",
    )
  ).rows[0].deleted;
  assert.equal(purged, 1);
  assert.equal(
    (
      await pg.query<{ count: number }>(
        "select count(*)::int count from private.market_data_fixture_observations where id=$1",
        [fixtureId],
      )
    ).rows[0].count,
    1,
  );
  assert.equal(
    (
      await pg.query<{ count: number }>(
        "select count(*)::int count from private.odds_snapshots where id=$1",
        [q.id],
      )
    ).rows[0].count,
    1,
  );
});
test("actual operational queries distinguish outage, mapping spike, review queue and missing results ingestion", async () => {
  await pg.exec(
    `update private.source_health set diagnostics='{"mappingFailures":5}',credits_remaining=0 where provider='fixture-odds';insert into private.provider_poll_runs(provider,sport,status,error_code) values('fictional-results','results','failed','fictional-isolated-failure');`,
  );
  const maintenance = (
    await pg.query<Record<string, number>>(scannerMaintenanceCountsSQL)
  ).rows[0];
  assert.equal(maintenance.mapping_failure_spike, 1);
  assert.equal(maintenance.quota_low, 1);
  assert.equal(maintenance.results_ingestion_failure, 1);
  const daily = (await pg.query<Record<string, number>>(scannerDailyCountsSQL))
    .rows[0];
  assert.equal(daily.approved_research, 1);
  assert.equal(daily.live_publications, 0);
  assert.equal(daily.new_community_edges, 0);
});

test("banned staff and revoked originating sessions cannot mutate or resume a queued manual scan", async () => {
  const f = await scannerFixture();
  await pg.exec("alter table auth.users add column banned_until timestamptz");
  await pg.query(
    `update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=$1`,
    [admin],
  );
  await assert.rejects(
    pg.query("select private.scanner_assert_actor(false)"),
    /MFA/,
  );
  await assert.rejects(
    pg.query("select private.scanner_assert_worker($1)", [f.job]),
    /authorization/,
  );
  await pg.query("update auth.users set banned_until=null where id=$1", [
    admin,
  ]);
  await pg.query("select private.scanner_assert_worker($1)", [f.job]);
  await pg.query(
    `update auth.sessions set not_after=clock_timestamp()-interval '1 second' where id=$1`,
    [adminSid],
  );
  await assert.rejects(
    pg.query("select private.scanner_assert_worker($1)", [f.job]),
    /authorization/,
  );
  await pg.query("update auth.sessions set not_after=null where id=$1", [
    adminSid,
  ]);
  await pg.query(
    `delete from private.roles where user_id=$1 and role='admin'`,
    [admin],
  );
  await assert.rejects(
    pg.query("select private.scanner_assert_worker($1)", [f.job]),
    /authorization/,
  );
  await pg.query(`insert into private.roles values($1,'admin')`, [admin]);
});
