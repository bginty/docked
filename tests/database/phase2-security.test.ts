import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let pg: PGlite;
const member = "00000000-0000-4000-8000-000000000101",
  other = "00000000-0000-4000-8000-000000000102",
  admin = "00000000-0000-4000-8000-000000000103";
const session = "00000000-0000-4000-8000-000000000201",
  otherSession = "00000000-0000-4000-8000-000000000202",
  commit = "a".repeat(40);
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
  await pg.exec(
    `insert into auth.users(id,email_confirmed_at) values('${member}',now()),('${other}',now()),('${admin}',now());insert into auth.sessions values('${session}','${member}',null),('${otherSession}','${other}',null);insert into public.profiles(id,country,state,accepted_version) values('${member}','XX','TEST','fixture'),('${other}','XX','TEST','fixture');insert into public.notification_preferences(user_id) values('${member}'),('${other}');insert into public.personal_entries(user_id,label,odds,result) values('${member}','Fictional isolated test',2,'pending'),('${other}','Other isolated fixture',2,'pending');insert into private.roles(user_id,role) values('${admin}','admin');`,
  );
});
after(async () => {
  await pg?.close();
});
async function asMember(id = member, sid = session) {
  await pg.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);select set_config('request.jwt.claims','{"sub":"${id}","session_id":"${sid}"}',false)`,
  );
}
async function transition(
  id: string,
  to: string,
  run: string | null = null,
  actor = admin,
) {
  return pg.query("select private.transition_strategy($1,$2,$3,$4,$5,$6)", [
    id,
    to,
    actor,
    "Explicit fixture review only",
    commit,
    run,
  ]);
}
async function draft(
  id: string,
  bounds = { minEV: "0.03", minOdds: "1.50", maxOdds: "5.00" },
) {
  await pg.query(
    "insert into private.strategy_versions(id,config,config_hash,code_commit) values($1,$3,$1,$2)",
    [id, commit, JSON.stringify(bounds)],
  );
}
async function validation(
  id: string,
  evidence = "retrospective_backtest",
  fixture = false,
) {
  return (
    await pg.query<{ id: string }>(
      "insert into private.validation_runs(strategy_id,evidence,manifest,report,code_commit,seed) values($1,$2,$3,$4,$5,1) returning id",
      [
        id,
        evidence,
        JSON.stringify({
          fixture,
          configHash: id,
          datasetHashes: { canonical: "isolated-test-only" },
        }),
        JSON.stringify({
          validation: { valid: true },
          fixtureEvidence: "No real-world performance",
        }),
        commit,
      ],
    )
  ).rows[0].id;
}
test("ordered migrations leave all new tables RLS protected and no public private-payload grants", async () => {
  assert.deepEqual(
    (
      await pg.query(
        "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity",
      )
    ).rows,
    [],
  );
  const grants = await pg.query(
    "select grantee,table_name from information_schema.role_table_grants where table_schema='private' and grantee in ('anon','authenticated','PUBLIC')",
  );
  assert.deepEqual(grants.rows, []);
  const definers = await pg.query<{ proname: string; proconfig: string[] }>(
    "select proname,proconfig from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname in ('private','public') and p.prosecdef",
  );
  assert.equal(definers.rows.length, 1);
  assert.equal(definers.rows[0].proname, "active_member_session");
  assert.ok(
    definers.rows[0].proconfig.some((v) => v.startsWith("search_path=")),
  );
});
test("anonymous denied; active members only see own rows and cannot forge another session", async () => {
  await pg.exec("set role anon");
  for (const table of [
    "public.profiles",
    "private.odds_snapshots",
    "private.strategy_transitions",
  ])
    await assert.rejects(
      () => pg.query(`select * from ${table}`),
      /permission denied/,
    );
  await pg.exec("reset role");
  await asMember();
  assert.equal(
    (await pg.query("select * from public.personal_entries")).rows.length,
    1,
  );
  assert.equal(
    (await pg.query("select * from public.notification_preferences")).rows
      .length,
    1,
  );
  await pg.exec("reset role");
  await asMember(member, otherSession);
  assert.equal(
    (await pg.query("select * from public.personal_entries")).rows.length,
    0,
  );
  assert.equal(
    (await pg.query("select * from public.profiles")).rows.length,
    0,
  );
  await pg.exec("reset role");
});
test("staff metadata does not grant direct SQL mutation or provider payload access to authenticated role", async () => {
  for (const role of ["analyst", "editor", "admin", "auditor"]) {
    await pg.query(
      "insert into private.roles(user_id,role) values($1,$2) on conflict(user_id) do update set role=excluded.role",
      [member, role],
    );
    await asMember();
    for (const query of [
      "select * from private.odds_snapshots",
      "select * from private.roles",
      "update private.strategy_versions set active=true",
      "delete from private.tip_publications",
      "update public.profiles set age_attested=true",
      "select private.disable_account('" + other + "')",
    ]) {
      await assert.rejects(() => pg.query(query), /permission denied/);
    }
    await assert.rejects(
      () => transition("x", "RESEARCH", null, member),
      /permission denied/,
    );
    await pg.exec("reset role");
  }
  await pg.query("delete from private.roles where user_id=$1", [member]);
});
test("disabled profile and revoked or expired session block every member Data API table", async () => {
  await pg.query("update public.profiles set disabled_at=now() where id=$1", [
    member,
  ]);
  await asMember();
  for (const t of [
    "profiles",
    "notification_preferences",
    "personal_entries",
    "saved_tips",
  ])
    assert.equal((await pg.query(`select * from public.${t}`)).rows.length, 0);
  await pg.exec("reset role");
  await pg.query("update public.profiles set disabled_at=null where id=$1", [
    member,
  ]);
  await pg.query(
    "update auth.sessions set not_after=now()-interval '1 minute' where id=$1",
    [session],
  );
  await asMember();
  assert.equal(
    (await pg.query("select * from public.profiles")).rows.length,
    0,
  );
  await pg.exec("reset role");
  await pg.query("update auth.sessions set not_after=null where id=$1", [
    session,
  ]);
});
test("strategy lifecycle disallows skipped states, unauthorised actors, fixture validation and unreviewed direct updates", async () => {
  await draft("gated");
  await assert.rejects(
    () => transition("gated", "APPROVED_FOR_LIVE"),
    /Invalid strategy/,
  );
  await assert.rejects(
    () => transition("gated", "RESEARCH", null, member),
    /Administrator/,
  );
  await assert.rejects(
    () =>
      pg.query(
        "update private.strategy_versions set lifecycle='RESEARCH' where id='gated'",
      ),
    /audited strategy/,
  );
  await transition("gated", "RESEARCH");
  await assert.rejects(
    () => transition("gated", "VALIDATED"),
    /genuine validation/,
  );
  const demo = await validation("gated", "retrospective_backtest", true);
  await assert.rejects(
    () => transition("gated", "VALIDATED", demo),
    /genuine validation/,
  );
  const realShape = await validation("gated");
  await transition("gated", "VALIDATED", realShape);
  await transition("gated", "FROZEN_FOR_FORWARD_PAPER");
  await transition("gated", "FORWARD_PAPER");
  await assert.rejects(
    () =>
      pg.query(
        "update private.strategy_versions set config='{\"changed\":true}' where id='gated'",
      ),
    /Frozen configuration/,
  );
  await assert.rejects(
    () =>
      pg.query(
        "update private.strategy_versions set code_commit=$1 where id='gated'",
        ["b".repeat(40)],
      ),
    /Frozen configuration/,
  );
  await assert.rejects(
    () => pg.query("delete from private.strategy_transitions"),
    /Append-only/,
  );
  assert.equal(
    (
      await pg.query(
        "select * from private.strategy_transitions where strategy_id='gated'",
      )
    ).rows.length,
    4,
  );
});
let paperId: string;
test("paper publication is pre-event immutable and never creates public notification outbox", async () => {
  await pg.exec(
    `insert into private.sports values('fixture','Fictional only',false);insert into private.competitions values('fixture','fixture',false,'{}');insert into private.events values('fixture-paper','fixture','["A","B"]',now()+interval '6 hours','scheduled','{}');insert into private.region_policies(id,country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence) values('00000000-0000-4000-8000-000000000300','XX','TEST','fixture',now()-interval '1 day',now()+interval '1 day',now()+interval '1 day',true,18,array['tips'],'ISOLATED TEST ONLY');insert into private.candidate_decisions(id,event_id,strategy_id,decision_at,window_seconds,payload) values('00000000-0000-4000-8000-000000000400','fixture-paper','gated',now(),21600,'{}');update private.feature_flags set enabled=true where key='forward_paper';`,
  );
  const insert = `insert into private.tip_publications(candidate_id,event_id,strategy_id,evidence,selection,market_rules,probability,odds,minimum_odds,estimated_ev,config_hash,sources,publication_payload,approved_by,region_policy_id) values('00000000-0000-4000-8000-000000000400','fixture-paper','gated','forward_paper','A','{}',.55,2,1.88,.1,'gated',(select jsonb_agg(jsonb_build_object('sourceAt',now(),'snapshotAt',now(),'receivedAt',now(),'operator','fixture-'||i,'rules','{}'::jsonb)) from generate_series(1,3) i),'{}','${admin}','00000000-0000-4000-8000-000000000300') returning id`;
  const result = await pg.query<{ id: string }>(insert);
  paperId = result.rows[0].id;
  assert.equal(
    (await pg.query("select * from private.outbox where kind='publication'"))
      .rows.length,
    0,
  );
  await assert.rejects(
    () =>
      pg.query("update private.tip_publications set odds=3 where id=$1", [
        paperId,
      ]),
    /Append-only/,
  );
  await assert.rejects(
    () =>
      pg.query("delete from private.tip_publications where id=$1", [paperId]),
    /Append-only/,
  );
});
test("mismatched candidate event and malformed EV fail closed", async () => {
  await pg.exec(
    "insert into private.events values('wrong-event','fixture','[\"C\",\"D\"]',now()+interval '6 hours','scheduled','{}')",
  );
  const insert = `insert into private.tip_publications(candidate_id,event_id,strategy_id,evidence,selection,market_rules,probability,odds,minimum_odds,estimated_ev,config_hash,sources,publication_payload,approved_by,region_policy_id) select candidate_id,'wrong-event',strategy_id,evidence,selection,market_rules,probability,odds,minimum_odds,estimated_ev,config_hash,sources,publication_payload,approved_by,region_policy_id from private.tip_publications where id='${paperId}'`;
  await assert.rejects(() => pg.query(insert), /Candidate linkage/);
  const sameEvent = insert.replace("'wrong-event'", "'fixture-paper'");
  await assert.rejects(
    () =>
      pg.query(
        sameEvent.replace(
          "minimum_odds,estimated_ev,config_hash,sources,publication_payload,approved_by,region_policy_id from",
          "minimum_odds,estimated_ev+0.01,config_hash,sources,publication_payload,approved_by,region_policy_id from",
        ),
      ),
    /EV\/probability/,
  );
});
test("correction cannot link settlements from different publications or rewrite original outcome", async () => {
  const first = await pg.query<{ id: string }>(
    "insert into private.settlement_events(tip_id,result,source,source_event_id,revision,evidence) values($1,'lost','fixture','fixture-paper','1','{}') returning id",
    [paperId],
  );
  await assert.rejects(
    () =>
      pg.query(
        "insert into private.correction_events(tip_id,settlement_id,replacement_settlement_id,reason,actor) values($1,$2,$2,'Invalid same evidence',$3)",
        [paperId, first.rows[0].id, admin],
      ),
    /linkage invalid/,
  );
  const next = await pg.query<{ id: string }>(
    "insert into private.settlement_events(tip_id,result,source,source_event_id,revision,evidence) values($1,'void','fixture','fixture-paper','2','{}') returning id",
    [paperId],
  );
  await pg.query(
    "insert into private.correction_events(tip_id,settlement_id,replacement_settlement_id,reason,actor) values($1,$2,$3,'Reviewed fixture correction',$4)",
    [paperId, first.rows[0].id, next.rows[0].id, admin],
  );
  assert.equal(
    (
      await pg.query(
        "select * from private.settlement_events where tip_id=$1",
        [paperId],
      )
    ).rows.length,
    2,
  );
  await assert.rejects(
    () =>
      pg.query("delete from private.settlement_events where tip_id=$1", [
        paperId,
      ]),
    /Append-only/,
  );
});
test("account disable atomically revokes access, scrubs mutable personal records and queues idempotent erasure", async () => {
  await pg.query(
    "insert into private.outbox(dedupe_key,kind,user_id,payload,expires_at) values('delete-fixture','education',$1,'{\"address\":\"never-sent@example.invalid\"}',now()+interval '1 hour')",
    [member],
  );
  await pg.query(
    "insert into private.analytics_events(user_id,event) values($1,'landing_view')",
    [member],
  );
  await pg.query(
    "insert into private.consent_events(user_id,purpose,granted,version,actor) values($1::uuid,'education',true,'fixture',$1::text)",
    [member],
  );
  await pg.query("select private.disable_account($1)", [member]);
  await pg.query("select private.disable_account($1)", [member]);
  assert.equal(
    (await pg.query("select * from auth.sessions where user_id=$1", [member]))
      .rows.length,
    0,
  );
  assert.equal(
    (
      await pg.query(
        "select * from private.analytics_events where user_id=$1",
        [member],
      )
    ).rows.length,
    0,
  );
  const erased = await pg.query<{
    user_id: string | null;
    payload: unknown;
    state: string;
  }>(
    "select user_id,payload,state from private.outbox where dedupe_key like 'erased:%'",
  );
  assert.equal(erased.rows[0].user_id, null);
  assert.deepEqual(erased.rows[0].payload, {});
  assert.equal(erased.rows[0].state, "suppressed");
  assert.equal(
    (
      await pg.query(
        "select * from private.job_runs where kind='account_deletion'",
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await pg.query("select * from private.consent_events where user_id=$1", [
        member,
      ])
    ).rows.length,
    1,
  );
  await asMember();
  assert.equal(
    (await pg.query("select * from public.personal_entries")).rows.length,
    0,
  );
  await pg.exec("reset role");
});
test("candidate and observation evidence cannot be silently rewritten or removed", async () => {
  await assert.rejects(
    () =>
      pg.query(
        "update private.candidate_decisions set payload='{}'::jsonb || '{\"hide_loss\":true}'::jsonb",
      ),
    /immutable evidence/,
  );
  await assert.rejects(
    () => pg.query("delete from private.candidate_decisions"),
    /immutable evidence/,
  );
  await pg.query(
    "insert into private.availability_observations(tip_id,observed_at,target_minutes,odds,qualifies,source_resolution_seconds) values($1,now(),5,1.9,true,60)",
    [paperId],
  );
  await assert.rejects(
    () =>
      pg.query("update private.availability_observations set qualifies=false"),
    /Append-only/,
  );
});
test("Phase 2 backup restores session policies and immutable strategy/paper evidence", async () => {
  const restored = new PGlite({ loadDataDir: await pg.dumpDataDir() });
  try {
    assert.equal(
      (
        await restored.query(
          "select id from private.tip_publications where evidence='forward_paper'",
        )
      ).rows.length,
      1,
    );
    await assert.rejects(
      () => restored.query("delete from private.strategy_transitions"),
      /Append-only/,
    );
    await restored.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${member}',false);select set_config('request.jwt.claims','{"session_id":"${session}"}',false)`,
    );
    assert.equal(
      (await restored.query("select * from public.notification_preferences"))
        .rows.length,
      0,
    );
  } finally {
    await restored.close();
  }
});
test("quota reservations survive external failure and preserve unknown balances", async () => {
  await pg.exec(
    "insert into private.source_health(provider,credits_remaining) values('test-provider',10),('unknown-provider',null)",
  );
  await pg.transaction(async (tx) => {
    await tx.exec(
      "insert into private.provider_poll_runs(provider,sport,status,error_code,quota_charge) values('test-provider','fixture','failed','request_in_progress_or_interrupted',3)",
    );
    await tx.exec(
      "update private.source_health set credits_remaining=case when credits_remaining is null then null else greatest(0,credits_remaining-3) end where provider in ('test-provider','unknown-provider')",
    );
  });
  // A timeout occurs outside this committed transaction; never refund an unconfirmed provider charge.
  await pg.exec(
    "update private.provider_poll_runs set error_code='provider_or_ingestion_failed',completed_at=now() where provider='test-provider'",
  );
  const balance = await pg.query<{ credits_remaining: number | null }>(
    "select credits_remaining::int from private.source_health where provider='test-provider'",
  );
  assert.equal(balance.rows[0].credits_remaining, 7);
  assert.equal(
    (
      await pg.query<{ credits_remaining: null }>(
        "select credits_remaining from private.source_health where provider='unknown-provider'",
      )
    ).rows[0].credits_remaining,
    null,
  );
  assert.equal(
    (
      await pg.query<{ spent: number }>(
        "select sum(quota_charge)::int spent from private.provider_poll_runs where provider='test-provider'",
      )
    ).rows[0].spent,
    3,
  );
});
test("policy renewal preserves that jurisdiction's historical publications while restrictions still fail closed", async () => {
  const oldPolicy = "00000000-0000-4000-8000-000000000300",
    renewed = "00000000-0000-4000-8000-000000000301",
    elsewhere = "00000000-0000-4000-8000-000000000302";
  await pg.query(
    "insert into private.region_policies(id,country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence) values($1,'XX','TEST','renewed',now()-interval '1 hour',now()+interval '1 day',now()+interval '1 day',true,18,array['tips'],'Isolated fixture policy'),($2,'XX','OTHER','elsewhere',now()-interval '1 hour',now()+interval '1 day',now()+interval '1 day',true,18,array['tips'],'Isolated fixture policy')",
    [renewed, elsewhere],
  );
  await pg.query(
    "update private.region_policies set approved=false,effective_to=now() where id=$1",
    [oldPolicy],
  );
  assert.equal(
    (
      await pg.query<{ allowed: boolean }>(
        "select private.publication_region_matches($1,$2) allowed",
        [oldPolicy, renewed],
      )
    ).rows[0].allowed,
    true,
  );
  assert.equal(
    (
      await pg.query<{ allowed: boolean }>(
        "select private.publication_region_matches($1,$2) allowed",
        [oldPolicy, elsewhere],
      )
    ).rows[0].allowed,
    false,
  );
  await pg.query(
    "update private.region_policies set approved=false where id=$1",
    [renewed],
  );
  assert.equal(
    (
      await pg.query<{ allowed: boolean }>(
        "select private.publication_region_matches($1,$2) allowed",
        [oldPolicy, renewed],
      )
    ).rows[0].allowed,
    false,
  );
});
test("as-of reports retain the earlier loss when a later correction was unavailable at report cutoff", async () => {
  const settlements = await pg.query<{
    id: string;
    created_at: Date;
    result: string;
  }>(
    "select id,created_at,result from private.settlement_events where tip_id=$1 order by created_at,id",
    [paperId],
  );
  const first = settlements.rows.find((r) => r.result === "lost")!;
  const asof = await pg.query<{ result: string }>(
    "select result from private.settlement_events where tip_id=$1 and created_at<=$2 order by created_at desc,id desc limit 1",
    [paperId, first.created_at],
  );
  assert.equal(asof.rows[0].result, "lost");
});
test("completion analytics cannot double count repeated or concurrent callbacks", async () => {
  await pg.query(
    "insert into private.analytics_events(user_id,event) values($1,'email_verified')",
    [other],
  );
  await assert.rejects(
    () =>
      pg.query(
        "insert into private.analytics_events(user_id,event) values($1,'email_verified')",
        [other],
      ),
    /duplicate key/,
  );
  await pg.query(
    "insert into private.analytics_events(user_id,event) values($1,'email_verified') on conflict do nothing",
    [other],
  );
  assert.equal(
    (
      await pg.query(
        "select id from private.analytics_events where user_id=$1 and event='email_verified'",
        [other],
      )
    ).rows.length,
    1,
  );
});
test("research sensitivity settings cannot freeze below the release floor or outside the release odds range", async () => {
  for (const [id, bounds] of [
    ["low-edge", { minEV: "0.01", minOdds: "1.50", maxOdds: "5.00" }],
    ["low-price", { minEV: "0.03", minOdds: "1.40", maxOdds: "5.00" }],
    ["high-price", { minEV: "0.03", minOdds: "1.50", maxOdds: "6.00" }],
  ] as const) {
    await draft(id, bounds);
    await transition(id, "RESEARCH");
    await transition(id, "VALIDATED", await validation(id));
    await assert.rejects(
      () => transition(id, "FROZEN_FOR_FORWARD_PAPER"),
      /3% EV release floor/,
    );
    const row = await pg.query<{ lifecycle: string; frozen_at: null }>(
      "select lifecycle,frozen_at from private.strategy_versions where id=$1",
      [id],
    );
    assert.equal(row.rows[0].lifecycle, "VALIDATED");
    assert.equal(row.rows[0].frozen_at, null);
  }
});
test("repeating signup for an unconfirmed existing profile cannot append or flip initial consent", async () => {
  const id = "00000000-0000-4000-8000-000000000108";
  await pg.query(
    "insert into auth.users(id,email_confirmed_at) values($1,null)",
    [id],
  );
  const initialize = async (granted: boolean) =>
    pg.transaction(async (tx) => {
      const inserted = await tx.query(
        "insert into public.profiles(id,country,state,age_attested,accepted_version) values($1,'XX','TEST',true,'fixture') on conflict do nothing returning id",
        [id],
      );
      if (!inserted.rows.length) return false;
      await tx.query(
        "insert into public.notification_preferences(user_id,education) values($1,$2)",
        [id, granted],
      );
      await tx.query(
        "insert into private.consent_events(user_id,purpose,granted,version,actor) values($1::uuid,'education',$2,'fixture',$1::text)",
        [id, granted],
      );
      return true;
    });
  assert.equal(await initialize(false), true);
  assert.equal(await initialize(true), false);
  const consents = await pg.query<{ granted: boolean }>(
    "select granted from private.consent_events where user_id=$1 and purpose='education'",
    [id],
  );
  assert.deepEqual(consents.rows, [{ granted: false }]);
  assert.equal(
    (
      await pg.query<{ education: boolean }>(
        "select education from public.notification_preferences where user_id=$1",
        [id],
      )
    ).rows[0].education,
    false,
  );
});
