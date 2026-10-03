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
import { referenceStrategyV2 } from "../../src/core/reference-pricing";
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
      `insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,operators,evidence) values('XX','TEST','isolated',now()-interval '1 day',now()+interval '1 day',now()+interval '1 day',true,18,'{community_social,community_edges,public_profiles,leaderboards}','{fixture-book}','Fictional isolated approval') returning id`,
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
async function submit(
  m: Market,
  evidenceId: string,
  changes: {
    odds?: string;
    confirmation?: boolean;
    profileId?: string;
    key?: string;
  } = {},
) {
  return (
    await pg.query<{ id: string; submitted_at: Date; standard_units: string }>(
      `insert into private.community_edges(profile_id,event_id,market_id,snapshot_id,quote_evidence_id,provider,provider_event_id,bookmaker,selection,market_rules,sport,competition,odds,verification_rule,start_at,source_at,snapshot_at,received_at,submitted_at,region_policy_id,confirmed_permanent,review_hash,idempotency_key,request_hash)
    values($1,$2,$3,$4,$5,'ignored','ignored','ignored','Fictional A',$6,'ignored','ignored',$7,'community-standard-v1',$8,$9,$10,$10,'2000-01-01',$11,$12,$13,$14,$13) returning id,submitted_at,standard_units`,
      [
        changes.profileId ?? profile,
        m.event,
        m.marketId,
        m.id,
        evidenceId,
        JSON.stringify(m.rules),
        changes.odds ?? "2.501",
        m.start,
        m.source,
        m.received,
        policy,
        changes.confirmation ?? true,
        "a".repeat(64),
        changes.key ?? randomUUID(),
      ],
    )
  ).rows[0];
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
async function submitReference(
  f: Awaited<ReturnType<typeof referenceFixture>>,
  referenceId: string,
  odds = f.r.decimalPrice,
  author = profile,
) {
  return (
    await pg.query<{
      id: string;
      odds: string;
      personal_metadata: { price: string };
      pricing_model: string;
    }>(
      `insert into private.community_edges(profile_id,event_id,market_id,provider,provider_event_id,bookmaker,selection,market_rules,sport,competition,odds,verification_rule,start_at,source_at,snapshot_at,received_at,region_policy_id,confirmed_permanent,review_hash,idempotency_key,request_hash,pricing_model,market_reference_id) values($1,$2,$3,'ignored','ignored','ignored',$4,$5,'ignored','ignored',$6,'community-market-reference-v2',$7,$8,$9,$9,$10,true,$11,$12,$11,'market_reference_v1',$13) returning id,odds,pricing_model`,
      [
        author,
        f.m.event,
        f.m.marketId,
        f.r.selection,
        JSON.stringify(f.m.rules),
        odds,
        f.m.start,
        f.m.source,
        f.m.received,
        policy,
        "a".repeat(64),
        randomUUID(),
        referenceId,
      ],
    )
  ).rows[0];
}
test("reference tables have RLS and no browser data/function access", async () => {
  for (const table of ["market_references", "market_reference_movements"]) {
    assert.equal(
      (
        await pg.query<{ enabled: boolean }>(
          `select relrowsecurity enabled from pg_class where oid=$1::regclass`,
          [`private.${table}`],
        )
      ).rows[0].enabled,
      true,
    );
    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`set role ${role}`);
      await assert.rejects(
        () => pg.exec(`select * from private.${table}`),
        /permission denied/,
      );
      await pg.exec("reset role");
    }
  }
});
test("server lower median is immutable; price overrides and provider outage fail closed", async () => {
  const f = await referenceFixture();
  assert.equal(f.r.decimalPrice, "2.50");
  await assert.rejects(() => f.retain("9.00"), /lower median/);
  const id = await f.retain();
  await assert.rejects(
    () =>
      pg.query(
        "update private.market_references set decimal_price=9 where id=$1",
        [id],
      ),
    /Append-only/i,
  );
  await assert.rejects(
    () => pg.query("delete from private.market_references where id=$1", [id]),
    /Append-only/i,
  );
  await pg.exec(
    "update private.source_health set healthy=false where provider='fixture-odds'",
  );
  await assert.rejects(() => f.retain(), /source unavailable/);
  await pg.exec(
    "update private.source_health set healthy=true,last_success=clock_timestamp() where provider='fixture-odds'",
  );
});
test("community benchmark is server controlled; personal promotional odds cannot change accounting; legacy retains original version", async () => {
  const f = await referenceFixture(),
    id = await f.retain();
  await assert.rejects(
    () => submitReference(f, id, "99"),
    /Immutable submission reference/,
  );
  await assert.rejects(
    () => submitReference(f, id, f.r.decimalPrice, otherProfile),
    /authenticated|member required/i,
  );
  const edge = await submitReference(f, id);
  assert.equal(Number(edge.odds), 2.5);
  await pg.query(
    'insert into private.community_edge_personal_notes(edge_id,metadata) values($1,\'{"price":"99","bookmaker":"Personal promotion","promotional":true}\')',
    [edge.id],
  );
  assert.equal(
    (
      await pg.query<{ metadata: { price: string } }>(
        "select metadata from private.community_edge_personal_notes where edge_id=$1",
        [edge.id],
      )
    ).rows[0].metadata.price,
    "99",
  );
  const net = (
    await pg.query<{ net: string }>(
      `select odds*standard_units-standard_units net from private.community_edges where id=$1`,
      [edge.id],
    )
  ).rows[0].net;
  assert.equal(Number(net), 1.5);
  await assert.rejects(
    () =>
      pg.query("update private.community_edges set odds=99 where id=$1", [
        edge.id,
      ]),
    /Append-only/i,
  );
  const legacy = await market(),
    proof = await register(legacy),
    old = await submit(legacy, proof);
  const version = (
    await pg.query<{ pricing_model: string; odds: string }>(
      "select pricing_model,odds from private.community_edges where id=$1",
      [old.id],
    )
  ).rows[0];
  assert.equal(version.pricing_model, "legacy_bookmaker_v1");
  assert.equal(version.odds, "2.501");
});
test("official publication freezes reference and cannot reactivate after suspension", async () => {
  const f = await referenceFixture(),
    ref = await f.retain(),
    strategy = {
      ...referenceStrategyV2,
      version: `market-reference-edge-fixture-${randomUUID()}`,
      marketReference: f.configuration,
    };
  const strategyHash = hash(strategy),
    probability = f.r.pricing!.probability,
    odds = Number(f.r.decimalPrice),
    minimum = Math.ceil((1.03 / Number(probability)) * 100) / 100,
    ev = Number(probability) * odds - 1;
  await pg.query(
    `insert into private.strategy_versions(id,config,config_hash,code_commit,lifecycle,active,frozen_at,research_approved_at,paper_approved_at,owner_approved_at) values($1,$2,$3,$4,'APPROVED_FOR_LIVE',true,now(),now(),now(),now())`,
    [strategy.version, JSON.stringify(strategy), strategyHash, "a".repeat(40)],
  );
  await pg.exec(
    "update private.feature_flags set enabled=true where key='publication'",
  );
  await pg.query(
    "update private.region_policies set features=array_append(features,'tips') where id=$1",
    [policy],
  );
  const candidate = (
    await pg.query<{ id: string }>(
      `insert into private.candidate_decisions(event_id,strategy_id,decision_at,window_seconds,payload,rejection_reasons,status) values($1,$2,clock_timestamp(),3600,'{}','[]','review') returning id`,
      [f.m.event, strategy.version],
    )
  ).rows[0].id;
  const publication = (
    await pg.query<{ id: string }>(
      `insert into private.tip_publications(candidate_id,event_id,strategy_id,evidence,selection,market_rules,probability,odds,minimum_odds,estimated_ev,config_hash,sources,publication_payload,approved_by,region_policy_id,pricing_model,market_reference_id) values($1,$2,$3,'live_published',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'market_reference_v1',$15) returning id`,
      [
        candidate,
        f.m.event,
        strategy.version,
        f.r.selection,
        JSON.stringify(f.m.rules),
        probability,
        odds,
        minimum,
        ev,
        strategyHash,
        JSON.stringify(f.sources),
        JSON.stringify({
          reference: f.r,
          referenceConfig: f.configuration,
          offer: { bookmaker: "Market reference" },
          marketId: f.m.marketId,
        }),
        admin,
        policy,
        ref,
      ],
    )
  ).rows[0].id;
  await pg.query(
    "insert into private.market_reference_movements(tip_id,market_reference_id,status) values($1,$2,'ACTIVE')",
    [publication, ref],
  );
  await pg.query(
    "insert into private.market_reference_movements(tip_id,status) values($1,'SUSPENDED')",
    [publication],
  );
  await assert.rejects(
    () =>
      pg.query(
        "insert into private.market_reference_movements(tip_id,market_reference_id,status) values($1,$2,'ACTIVE')",
        [publication, ref],
      ),
    /reactivation disabled/,
  );
  await assert.rejects(
    () =>
      pg.query("update private.tip_publications set odds=99 where id=$1", [
        publication,
      ]),
    /Append-only/i,
  );
  assert.equal(
    Number(
      (
        await pg.query<{ odds: string }>(
          "select odds from private.tip_publications where id=$1",
          [publication],
        )
      ).rows[0].odds,
    ),
    2.5,
  );
});
test("reference evidence hashes and immutable methodology versions cannot be relabelled", async () => {
  const f = await referenceFixture(),
    id = await f.retain();
  await assert.rejects(
    () =>
      pg.query(
        `insert into private.market_references(market_id,selection,methodology_version,config_hash,configuration,reference,snapshot_ids,decimal_price,observed_at,region_policy_id) select market_id,selection,methodology_version,config_hash,configuration,jsonb_set(reference,'{evidenceHash}',to_jsonb($2::text)),snapshot_ids,decimal_price,observed_at,region_policy_id from private.market_references where id=$1`,
        [id, "0".repeat(64)],
      ),
    /evidence hash mismatch/,
  );
  const changed = { ...f.configuration, maxAgeSeconds: 179 },
    at = new Date(
      (await pg.query<{ at: Date }>("select clock_timestamp() at")).rows[0].at,
    ).toISOString();
  const result = buildMarketReference(
    {
      rules: f.m.rules as MarketSourceObservation["rules"],
      startAt: f.m.start,
      observedAt: at,
      selection: "Fictional A",
      sources: f.sources,
    },
    changed,
  );
  assert.equal(result.status, "READY");
  if (result.status !== "READY") return;
  const r = result.reference;
  await assert.rejects(
    () =>
      pg.query(
        `insert into private.market_references(market_id,selection,methodology_version,config_hash,configuration,reference,snapshot_ids,decimal_price,observed_at,region_policy_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          f.m.marketId,
          r.selection,
          r.methodologyVersion,
          r.configHash,
          JSON.stringify(changed),
          JSON.stringify(r),
          [...r.availability.sourceIds, ...r.pricing!.sourceIds],
          r.decimalPrice,
          r.observedAt,
          policy,
        ],
      ),
    /new methodology version/,
  );
});
test("invented probability with an empty pricing cohort is rejected before publication", async () => {
  const f = await referenceFixture(),
    id = await f.retain();
  await assert.rejects(
    () =>
      pg.query(
        `insert into private.market_references(market_id,selection,methodology_version,config_hash,configuration,reference,snapshot_ids,decimal_price,observed_at,region_policy_id)
 select market_id,selection,methodology_version,config_hash,configuration,reference||jsonb_build_object('pricing',jsonb_build_object('probability','0.55','fairPrice','1.818181818181818','sourceIds','[]'::jsonb,'operators','[]'::jsonb)),snapshot_ids[1:2],decimal_price,observed_at,region_policy_id from private.market_references where id=$1`,
        [id],
      ),
    /Probability requires independent pricing source evidence/,
  );
});
test("missing required market-rule scalars cannot exploit SQL NULL semantics", async () => {
  for (const field of ["period", "overtime", "draw"]) {
    const f = await referenceFixture(field);
    await assert.rejects(
      () => f.retain(),
      /Unsupported or mismatched community settlement rules/,
    );
  }
});
test("suspended authors keep canonical benchmarks while their optional social price claims are hidden", async () => {
  const f = await referenceFixture(),
    edge = await submitReference(f, await f.retain());
  await pg.query(
    `insert into private.community_edge_personal_notes(edge_id,metadata) values($1,'{"price":"99","promotional":true}')`,
    [edge.id],
  );
  async function projection() {
    return (
      await pg.query<{ odds: string; metadata: unknown }>(
        `select e.odds,(select n.metadata from private.community_edge_personal_notes n where n.edge_id=e.id and private.social_profile_visible($2,p.id,false)) metadata from private.community_edges e join private.social_profiles p on p.id=e.profile_id where e.id=$1`,
        [edge.id, otherProfile],
      )
    ).rows[0];
  }
  assert.ok((await projection()).metadata);
  await pg.query(
    "update private.social_profiles set status='suspended' where id=$1",
    [profile],
  );
  assert.equal((await projection()).metadata, null);
  assert.equal(Number((await projection()).odds), 2.5);
  await pg.query(
    "update private.social_profiles set status='active' where id=$1",
    [profile],
  );
  const source = await readFile("src/server/community-edges.ts", "utf8");
  assert.equal(
    (
      source.match(
        /social_profile_visible\(\$\{(?:profileId|viewerId)\},p.id,false\)\) personal_metadata/g,
      ) ?? []
    ).length,
    2,
  );
});
test("account erasure removes personal promotional claims while retaining benchmark ledger", async () => {
  const f = await referenceFixture(),
    edge = await submitReference(f, await f.retain());
  await pg.query(
    `insert into private.community_edge_personal_notes(edge_id,metadata) values($1,'{"price":"99","promotional":true}')`,
    [edge.id],
  );
  await pg.query("select private.disable_account($1)", [member]);
  assert.equal(
    (
      await pg.query(
        "select 1 from private.community_edge_personal_notes where edge_id=$1",
        [edge.id],
      )
    ).rows.length,
    0,
  );
  assert.equal(
    Number(
      (
        await pg.query<{ odds: string }>(
          "select odds from private.community_edges where id=$1",
          [edge.id],
        )
      ).rows[0].odds,
    ),
    2.5,
  );
});
