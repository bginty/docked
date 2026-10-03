import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
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
test("community private tables RLS deny anonymous/member reads and writes; no new definer", async () => {
  for (const table of [
    "community_edges",
    "community_quote_evidence",
    "community_settlements",
    "community_corrections",
    "community_result_sources",
    "community_edge_status",
    "leaderboard_snapshots",
  ]) {
    assert.equal(
      (
        await pg.query<{ relrowsecurity: boolean }>(
          "select relrowsecurity from pg_class where oid=$1::regclass",
          [`private.${table}`],
        )
      ).rows[0].relrowsecurity,
      true,
    );
    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`set role ${role}`);
      await assert.rejects(
        () => pg.exec(`select * from private.${table}`),
        /permission denied/,
      );
      await assert.rejects(
        () => pg.exec(`delete from private.${table}`),
        /permission denied/,
      );
      await pg.exec("reset role");
    }
  }
  assert.equal(
    (
      await pg.query(
        "select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.prosecdef",
      )
    ).rows.length,
    1,
  );
});
test("unknown provider classification, promotions and historical/demo records cannot be promoted", async () => {
  const unknown = await market({ metadata: false });
  await assert.rejects(() => register(unknown), /UNKNOWN_REVIEW/);
  for (const evidence of ["demo", "retrospective_backtest"]) {
    const source = await market(),
      id = randomUUID();
    await pg.query(
      `insert into private.odds_snapshots(id,market_id,provider,bookmaker,source_at,snapshot_at,received_at,payload,provenance,evidence) values($1,$2,'fixture-odds','fixture-book',$3,$4,$4,$5,'fictional-isolated-rights',$6)`,
      [
        id,
        source.marketId,
        source.source,
        source.received,
        JSON.stringify({ ...source.payload, id }),
        evidence,
      ],
    );
    await assert.rejects(() => register({ ...source, id }), /UNKNOWN_REVIEW/);
  }
  const promo = await market({ flags: ["boost"] }),
    proof = await register(promo);
  assert.equal(
    (
      await pg.query<{ classification: string }>(
        "select classification from private.community_quote_evidence where id=$1",
        [proof],
      )
    ).rows[0].classification,
    "PROMOTIONAL_EXCLUDED",
  );
  await assert.rejects(() => submit(promo, proof), /non-standard/);
});
test("atomic submission locks exact quote, rejects inflated odds/cross-user, stamps server time and stays immutable", async () => {
  await claims();
  const m = await market(),
    proof = await register(m);
  await assert.rejects(
    () => submit(m, proof, { odds: "20" }),
    /Verified provider price/,
  );
  await assert.rejects(
    () => submit(m, proof, { profileId: otherProfile }),
    /authenticated|author mismatch/,
  );
  await assert.rejects(
    () => submit(m, proof, { confirmation: false }),
    /check constraint/,
  );
  const key = randomUUID(),
    edge = await submit(m, proof, { key });
  assert.equal(
    (
      await pg.query<{ id: string }>(
        "select private.community_submission_retry($1,$2,$3) id",
        [profile, key, "a".repeat(64)],
      )
    ).rows[0].id,
    edge.id,
  );
  await assert.rejects(
    () =>
      pg.query("select private.community_submission_retry($1,$2,$3)", [
        profile,
        key,
        "b".repeat(64),
      ]),
    /IDEMPOTENCY_CONFLICT/,
  );
  assert.ok(new Date(edge.submitted_at).getFullYear() >= 2026);
  assert.equal(Number(edge.standard_units), 1);
  await assert.rejects(() => submit(m, proof, { key }), /unique constraint/);
  for (const statement of [
    "update private.community_edges set odds=50 where id=$1",
    "delete from private.community_edges where id=$1",
  ])
    await assert.rejects(() => pg.query(statement, [edge.id]), /Append-only/);
  await claims(admin, adminSid, "aal2");
  await assert.rejects(
    () =>
      pg.query(
        "update private.community_edges set selection='Draw' where id=$1",
        [edge.id],
      ),
    /Append-only/,
  );
  await claims();
});
test("newer price observation invalidates older confirmation; stale and cutoff quotes rejected", async () => {
  const m = await market(),
    proof = await register(m),
    id = randomUUID();
  const time = (await pg.query<{ at: Date }>("select clock_timestamp() at"))
    .rows[0].at;
  const at = new Date(time).toISOString();
  const payload = {
    ...m.payload,
    id,
    sourceAt: at,
    snapshotAt: at,
    receivedAt: at,
    prices: { ...m.payload.prices, "Fictional A": "2.1" },
  };
  await pg.query(
    `insert into private.odds_snapshots(id,market_id,provider,bookmaker,source_at,snapshot_at,received_at,payload,provenance,evidence) values($1,$2,'fixture-odds','fixture-book',$3,$3,$3,$4,'fictional-isolated-rights','forward_paper')`,
    [id, m.marketId, at, JSON.stringify(payload)],
  );
  await assert.rejects(() => submit(m, proof), /Current provider/);
  const stale = await market({ sourceAge: 181 }),
    staleProof = await register(stale);
  await assert.rejects(() => submit(stale, staleProof), /STALE/);
  const cutoff = await market({ startSeconds: 599 }),
    cutoffProof = await register(cutoff);
  await assert.rejects(() => submit(cutoff, cutoffProof), /SUBMISSIONS CLOSED/);
});
test("latest policy and 21+ restriction cannot be bypassed with an older 18+ approval", async () => {
  const m = await market(),
    proof = await register(m);
  await pg.query(
    "update private.region_policies set minimum_age=21 where id=$1",
    [policy],
  );
  await assert.rejects(() => submit(m, proof), /restricted|jurisdiction/);
  await pg.query(
    "update private.region_policies set minimum_age=18 where id=$1",
    [policy],
  );
  const recent = (
    await pg.query<{ id: string }>(
      `insert into private.region_policies(country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,operators,evidence) values('XX','TEST','new-unapproved',now()-interval '1 minute',now()+interval '1 day',now()+interval '1 day',false,18,'{}','{}','Isolated pending approval') returning id`,
    )
  ).rows[0].id;
  await assert.rejects(() => submit(m, proof), /restricted|jurisdiction/);
  await pg.query(
    "update private.region_policies set effective_to=clock_timestamp() where id=$1",
    [recent],
  );
});
test("canonical records survive social tombstone, private identity and blocking", async () => {
  const m = await market(),
    proof = await register(m),
    edge = await submit(m, proof);
  await pg.query(
    "insert into private.social_posts(author_id,kind,body,community_edge_id) values($1,'edge','Fictional commentary',$2)",
    [profile, edge.id],
  );
  await pg.query(
    "update private.social_posts set body='',deleted_at=now() where community_edge_id=$1",
    [edge.id],
  );
  await pg.query(
    "update private.social_profiles set visibility='private' where id=$1",
    [profile],
  );
  await pg.query(
    "insert into private.social_blocks(actor_id,target_id) values($1,$2)",
    [profile, otherProfile],
  );
  const projection = await pg.query<{ display: string; id: string }>(
    "select e.id,case when private.social_profile_visible($1,p.id,false) then p.display_name else 'Community member' end display from private.community_edges e join private.social_profiles p on p.id=e.profile_id where e.id=$2",
    [otherProfile, edge.id],
  );
  assert.equal(projection.rows[0].id, edge.id);
  assert.equal(projection.rows[0].display, "Community member");
  assert.equal(
    (
      await pg.query(
        "select id from private.community_edges where profile_id=$1",
        [profile],
      )
    ).rows.length > 0,
    true,
  );
  await pg.query("delete from private.social_blocks where actor_id=$1", [
    profile,
  ]);
  await pg.query(
    "update private.social_profiles set visibility='members' where id=$1",
    [profile],
  );
});
test("authorized results only, no silent correction, finite scores, append-only approval revocation", async () => {
  const m = await market(),
    proof = await register(m),
    edge = await submit(m, proof);
  const past = new Date(Date.now() - 7200000).toISOString();
  // Isolated historical fixture to exercise result guards without waiting for a sporting event.
  // Only the harness owner disables this trigger during fixture time construction.
  await pg.exec(
    "alter table private.community_edges disable trigger immutable",
  );
  await pg.query(
    "update private.community_edges set start_at=$1,submitted_at=$1::timestamptz-interval '1 hour' where id=$2",
    [past, edge.id],
  );
  await pg.exec("alter table private.community_edges enable trigger immutable");
  const evidence = {
    authorised: true,
    source: "fixture-results",
    sourceEventId: m.event,
    revision: "r1",
    eventId: m.event,
    status: "final",
    rules: m.rules,
    scores: { "Fictional A": 0, "Fictional B": 1 },
    observedAt: new Date(Date.now() - 1000).toISOString(),
  };
  const result = async (
    value: Record<string, unknown>,
    outcome = "LOST",
    previous: string | null = null,
    reason: string | null = null,
    actor = "results-provider:fixture-results",
  ) =>
    (
      await pg.query<{ id: string }>(
        "insert into private.community_settlements(edge_id,result,provider,provider_event_id,revision,observed_at,evidence,actor,previous_id,correction_reason) values($1,$2,'fixture-results',$3,$4,$5,$6,$7,$8,$9) returning id",
        [
          edge.id,
          outcome,
          m.event,
          value.revision,
          value.observedAt,
          JSON.stringify(value),
          actor,
          previous,
          reason,
        ],
      )
    ).rows[0].id;
  await assert.rejects(() => result(evidence), /Authorised matching/);
  await claims(admin, adminSid, "aal2");
  await pg.query(
    "insert into private.community_result_sources(provider,rights_reference,approved,reviewed_by,review_at,reason) values('fixture-results','Fictional rights only',true,$1,now()+interval '1 day','Isolated authorized source test')",
    [admin],
  );
  await assert.rejects(
    () =>
      result({
        ...evidence,
        scores: { "Fictional A": "NaN", "Fictional B": 1 },
      }),
    /Invalid scores/,
  );
  await assert.rejects(() => result(evidence, "WON"), /cannot choose/);
  const old = await result(evidence);
  const correction = {
    ...evidence,
    revision: "r2",
    supersedesRevision: "r1",
    scores: { "Fictional A": 1, "Fictional B": 0 },
  };
  await claims();
  await assert.rejects(
    () => result(correction, "WON", old, "Fictional result correction", member),
    /administrator correction/,
  );
  await claims(admin, adminSid, "aal2");
  const corrected = await result(
    correction,
    "WON",
    old,
    "Fictional result correction",
    admin,
  );
  const audit = (
    await pg.query<{ old_result: string; new_result: string }>(
      "select * from private.community_corrections where new_settlement_id=$1",
      [corrected],
    )
  ).rows[0];
  assert.equal(audit.old_result, "LOST");
  assert.equal(audit.new_result, "WON");
  await assert.rejects(
    () =>
      pg.query("delete from private.community_settlements where id=$1", [old]),
    /Append-only/,
  );
  await pg.query(
    "insert into private.community_result_sources(provider,rights_reference,approved,reviewed_by,review_at,reason) values('fixture-results','Fictional rights only',false,$1,now()+interval '1 day','Revoked authorization in fixture')",
    [admin],
  );
  await assert.rejects(
    () =>
      result(
        { ...correction, revision: "r3", supersedesRevision: "r2" },
        "WON",
        corrected,
        "After revoked source review",
        admin,
      ),
    /Authorised matching/,
  );
  await assert.rejects(
    () => pg.exec("update private.community_result_sources set approved=true"),
    /Append-only/,
  );
  await claims();
});

test("integrity status cannot be self-cleared; account deletion retains pseudonymous complete ledger", async () => {
  await claims();
  const m = await market(),
    proof = await register(m),
    edge = await submit(m, proof);
  await pg.query(
    "insert into private.community_edge_status(edge_id,status,actor,reason) values($1,'PENDING',$2,'Fictional initial pending test')",
    [edge.id, member],
  );
  await assert.rejects(
    () =>
      pg.query(
        "insert into private.community_edge_status(edge_id,status,actor,reason) values($1,'INTEGRITY_CLEARED',$2,'Self clearance not permitted')",
        [edge.id, member],
      ),
    /Administrator/,
  );
  await claims(admin, adminSid, "aal2");
  await pg.query(
    "insert into private.community_edge_status(edge_id,status,actor,reason) values($1,'INTEGRITY_REVIEW',$2,'Audited fictional integrity review')",
    [edge.id, admin],
  );
  await assert.rejects(
    () =>
      pg.query("delete from private.community_edge_status where edge_id=$1", [
        edge.id,
      ]),
    /Append-only/,
  );
  const count = (
    await pg.query<{ count: number }>(
      "select count(*)::int count from private.community_edges where profile_id=$1",
      [profile],
    )
  ).rows[0].count;
  await pg.query("delete from public.profiles where id=$1", [member]);
  const durable = (
    await pg.query<{ user_id: string | null; status: string }>(
      "select user_id,status from private.social_profiles where id=$1",
      [profile],
    )
  ).rows[0];
  assert.equal(durable.user_id, null);
  assert.equal(durable.status, "deleted");
  assert.equal(
    (
      await pg.query<{ count: number }>(
        "select count(*)::int count from private.community_edges where profile_id=$1",
        [profile],
      )
    ).rows[0].count,
    count,
  );
});
test("leaderboard milestone queue requires a comparable prior immutable snapshot and remains private", async () => {
  await claims(admin, adminSid, "aal2");
  const snapshot = async (
    asOf: string,
    from: string,
    previous: string | null,
  ) =>
    (
      await pg.query<{ id: string }>(
        "insert into private.leaderboard_snapshots(rule_version,period,as_of,source_hash,snapshot_hash,payload,previous_id,actor,reason) values('top-docked-net-units-v1','month',$1,$2,$2,$3,$4,$5,'Isolated empty audit snapshot fixture') returning id",
        [
          asOf,
          "c".repeat(64),
          JSON.stringify({
            period: "month",
            from,
            sport: null,
            rule: { version: "top-docked-net-units-v1" },
            rows: [],
          }),
          previous,
          admin,
        ],
      )
    ).rows[0].id;
  const baseline = await snapshot(
    "2020-09-30T00:00:00Z",
    "2020-09-01T00:00:00Z",
    null,
  );
  const newMonth = await snapshot(
    "2020-10-01T00:00:00Z",
    "2020-10-01T00:00:00Z",
    baseline,
  );
  assert.equal(
    (await pg.query("select * from private.leaderboard_notification_jobs")).rows
      .length,
    0,
  );
  const comparable = await snapshot(
    "2020-10-02T00:00:00Z",
    "2020-10-01T00:00:00Z",
    newMonth,
  );
  assert.equal(
    (
      await pg.query<{ snapshot_id: string }>(
        "select * from private.leaderboard_notification_jobs",
      )
    ).rows[0].snapshot_id,
    comparable,
  );
  await pg.query(
    "insert into private.leaderboard_notification_jobs(snapshot_id) values($1) on conflict do nothing",
    [comparable],
  );
  assert.equal(
    (await pg.query("select * from private.leaderboard_notification_jobs")).rows
      .length,
    1,
  );
  assert.equal(
    (
      await pg.query<{ relrowsecurity: boolean }>(
        "select relrowsecurity from pg_class where oid='private.leaderboard_notification_jobs'::regclass",
      )
    ).rows[0].relrowsecurity,
    true,
  );
  for (const role of ["anon", "authenticated"]) {
    await pg.exec(`set role ${role}`);
    await assert.rejects(
      () => pg.exec("select * from private.leaderboard_notification_jobs"),
      /permission denied/,
    );
    await pg.exec("reset role");
  }
});
