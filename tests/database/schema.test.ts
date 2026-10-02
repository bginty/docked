import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let pg: PGlite;
const user1 = "00000000-0000-4000-8000-000000000001",
  user2 = "00000000-0000-4000-8000-000000000002";
before(async () => {
  pg = new PGlite();
  await pg.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`,
  );
  await pg.exec(await readFile("db/schema.sql", "utf8"));
  await pg.exec(
    `insert into auth.users values ('${user1}'),('${user2}');insert into public.profiles(id,country,state,accepted_version) values ('${user1}','AU','VIC','test'),('${user2}','AU','VIC','test');`,
  );
});
after(async () => {
  await pg?.close();
});
test("every exposed table and private table has RLS", async () => {
  const result = await pg.query<{ relname: string }>(
    "select relname from pg_class c join pg_namespace n on c.relnamespace=n.oid where n.nspname in ('public','private') and c.relkind='r' and not c.relrowsecurity",
  );
  assert.deepEqual(result.rows, []);
});
test("member cannot read another profile or escalate own row", async () => {
  await pg.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${user1}',false)`,
  );
  const result = await pg.query<{ id: string }>(
    "select id from public.profiles",
  );
  assert.deepEqual(
    result.rows.map((x) => x.id),
    [user1],
  );
  await assert.rejects(
    () =>
      pg.exec(
        `update public.profiles set age_attested=true where id='${user1}'`,
      ),
    /permission denied/,
  );
  await assert.rejects(
    () => pg.exec("select * from private.roles"),
    /permission denied/,
  );
  await pg.exec("reset role");
});
test("anonymous cannot access accounts or provider payloads", async () => {
  await pg.exec("set role anon");
  await assert.rejects(
    () => pg.exec("select * from public.profiles"),
    /permission denied/,
  );
  await assert.rejects(
    () => pg.exec("select * from private.odds_snapshots"),
    /permission denied/,
  );
  await pg.exec("reset role");
});
test("audit and launch evidence cannot be rewritten", async () => {
  await pg.exec(
    `insert into private.audit_events(actor,action,subject) values('test','test','fixture');insert into private.launch_record(launched_at,actor,authority) values(now(),'${user1}','fixture authority')`,
  );
  await assert.rejects(
    () => pg.exec("update private.audit_events set action='hidden'"),
    /Append-only/,
  );
  await assert.rejects(
    () => pg.exec("delete from private.launch_record"),
    /Append-only/,
  );
  await assert.rejects(
    () =>
      pg.exec(
        `insert into private.launch_record(launched_at,actor,authority) values(now(),'${user1}','second launch')`,
      ),
    /duplicate key/,
  );
});
test("outbox deduplication and lease recovery", async () => {
  await pg.exec(
    "insert into private.outbox(dedupe_key,kind,payload,expires_at) values('fixture','edge','{}',now()+interval '1 hour')",
  );
  await assert.rejects(
    () =>
      pg.exec(
        "insert into private.outbox(dedupe_key,kind,payload,expires_at) values('fixture','edge','{}',now()+interval '1 hour')",
      ),
    /duplicate key/,
  );
  await pg.exec(
    "update private.outbox set state='leased',lease_until=now()-interval '1 minute' where dedupe_key='fixture'",
  );
  const result = await pg.query(
    "update private.outbox set lease_until=now()+interval '1 minute',attempts=attempts+1 where id=(select id from private.outbox where state='leased' and lease_until<now() for update skip locked limit 1) returning attempts",
  );
  assert.equal(result.rows.length, 1);
});
test("frozen strategy config cannot be changed", async () => {
  await pg.exec(
    "insert into private.strategy_versions(id,config,config_hash,frozen_at) values('fixture','{}','fixture',now())",
  );
  await assert.rejects(
    () =>
      pg.exec(
        "update private.strategy_versions set config=' {\"changed\":true}' where id='fixture'",
      ),
    /Frozen configuration/,
  );
});
test("migration matches canonical schema", async () => {
  assert.equal(
    await readFile(
      "supabase/migrations/20261002113546_docked_platform.sql",
      "utf8",
    ),
    await readFile("db/schema.sql", "utf8"),
  );
});
test("publication lifecycle enforces pre-start, immutable ledger, atomic outbox, withdrawal and settlement idempotency", async () => {
  const policyId = "00000000-0000-4000-8000-000000000010",
    candidateId = "00000000-0000-4000-8000-000000000020";
  await pg.exec(
    `insert into private.roles(user_id,role) values('${user1}','analyst');insert into private.sports values('test','Fictional',false);insert into private.competitions values('test','test',false,'{}');insert into private.events values('test','test','["A","B"]',now()+interval '6 hours','scheduled','{}');insert into private.strategy_versions(id,config,config_hash,frozen_at,research_approved_at,paper_approved_at,owner_approved_at,active) values('approved','{}','approved',now(),now(),now(),now(),true);insert into private.region_policies(id,country,state,version,effective_from,effective_to,review_at,approved,minimum_age,features,evidence) values('${policyId}','XX','TEST','fixture',now()-interval '1 day',now()+interval '1 day',now()+interval '1 day',true,18,array['tips'],'fixture only');insert into private.candidate_decisions(id,event_id,strategy_id,decision_at,window_seconds,payload) values('${candidateId}','test','approved',now(),21600,'{}');`,
  );
  const insert = `insert into private.tip_publications(candidate_id,event_id,strategy_id,evidence,selection,market_rules,probability,odds,minimum_odds,estimated_ev,config_hash,sources,publication_payload,approved_by,region_policy_id,published_at) values('${candidateId}','test','approved','live_published','A','{}',.55,2,1.88,.1,'approved',jsonb_build_array(jsonb_build_object('sourceAt',now()),jsonb_build_object('sourceAt',now()),jsonb_build_object('sourceAt',now())),'{}','${user1}','${policyId}','2020-01-01') returning id,published_at`;
  await assert.rejects(() => pg.query(insert), /Publication paused/);
  await pg.exec(
    "update private.feature_flags set enabled=true where key='publication'",
  );
  const created = await pg.query<{ id: string; published_at: Date }>(insert);
  const id = created.rows[0].id;
  assert.ok(new Date(created.rows[0].published_at).getFullYear() > 2020);
  assert.equal(
    (await pg.query("select id from private.outbox where kind='publication'"))
      .rows.length,
    1,
  );
  await assert.rejects(
    () =>
      pg.exec(`update private.tip_publications set odds=3 where id='${id}'`),
    /Append-only/,
  );
  await pg.exec(
    `insert into private.tip_status_events(tip_id,status,reason) values('${id}','withdrawn','Fixture price expired');insert into private.settlement_events(tip_id,result,source,source_event_id,revision,evidence) values('${id}','lost','fixture','test','1','{}')`,
  );
  await assert.rejects(
    () =>
      pg.exec(
        `insert into private.settlement_events(tip_id,result,source,source_event_id,revision,evidence) values('${id}','won','fixture','test','1','{}')`,
      ),
    /duplicate key/,
  );
  assert.equal(
    (
      await pg.query<{ result: string }>(
        `select result from private.settlement_events where tip_id='${id}'`,
      )
    ).rows[0].result,
    "lost",
  );
  await pg.exec(
    "update private.events set start_at=now()-interval '1 minute' where id='test'",
  );
  await assert.rejects(() => pg.query(insert), /pre-start/);
});
test("backup restores local immutable evidence and policy schema", async () => {
  const dump = await pg.dumpDataDir();
  const restored = new PGlite({ loadDataDir: dump });
  try {
    const count = await restored.query<{ n: number }>(
      "select count(*)::int n from private.audit_events",
    );
    assert.ok(count.rows[0].n > 0);
    await assert.rejects(
      () => restored.exec("delete from private.audit_events"),
      /Append-only/,
    );
  } finally {
    await restored.close();
  }
});
