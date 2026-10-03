import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
let pg: PGlite;
const admin = "60000000-0000-4000-8000-000000000001";
const member = "60000000-0000-4000-8000-000000000002";
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
    try {
      await pg.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
    } catch (error) {
      throw new Error(`Migration failed: ${file}`, { cause: error });
    }
  await pg.query(
    "insert into auth.users(id,email_confirmed_at) values($1,now()),($2,now())",
    [admin, member],
  );
  await pg.query("insert into private.roles(user_id,role) values($1,'admin')", [
    admin,
  ]);
});
after(async () => {
  await pg?.close();
});

test("commercial tables have RLS, no direct API grants, no card or subscription activation", async () => {
  const tables = [
    "membership_plans",
    "plan_prices",
    "plan_entitlements",
    "member_subscriptions",
    "subscription_events",
    "commercial_approvals",
    "community_competitions",
    "competition_rules",
    "competition_prizes",
    "competition_qualifications",
    "competition_rankings",
    "prize_award_events",
    "community_deals",
  ];
  for (const table of tables) {
    const row = await pg.query<{ relrowsecurity: boolean }>(
      "select relrowsecurity from pg_class where oid=($1)::regclass",
      [`private.${table}`],
    );
    assert.equal(row.rows[0].relrowsecurity, true);
    for (const role of ["anon", "authenticated"]) {
      await pg.exec(`set role ${role}`);
      await assert.rejects(
        () => pg.query(`select * from private.${table}`),
        /permission denied/,
      );
      await assert.rejects(
        () => pg.query(`delete from private.${table}`),
        /permission denied/,
      );
      await pg.exec("reset role");
    }
  }
  await assert.rejects(
    () =>
      pg.exec(
        "update private.membership_plans set enabled=true where id='PRO'",
      ),
    /check constraint/,
  );
  await assert.rejects(
    () =>
      pg.exec(
        "insert into private.plan_entitlements values('PRO','leaderboard_advantage',true)",
      ),
    /check constraint/,
  );
  await assert.rejects(
    () =>
      pg.exec(
        "insert into private.member_subscriptions(plan_id,state) values('PRO','ACTIVE')",
      ),
    /check constraint/,
  );
  await assert.rejects(
    () =>
      pg.exec(
        "insert into private.member_subscriptions(customer_reference) values('real-customer')",
      ),
    /check constraint/,
  );
});

test("competition drafts are audited, frozen append-only, and cannot produce rankings or awards", async () => {
  const insert =
    "insert into private.community_competitions(title,description,country,state,starts_at,ends_at,entry_cutoff,minimum_age,membership,mechanics,actor,draft_hash,reason) values('Isolated fixture','No real prize or event','XX','TEST','2030-01-01','2030-02-01','2030-01-01',18,'FREE','STANDARD_VERIFIED_PERFORMANCE',$1,repeat('b',64),'Isolated software test only') returning id";
  await assert.rejects(
    () => pg.query(insert, [member]),
    /Administrator required/,
  );
  const c = (await pg.query<{ id: string }>(insert, [admin])).rows[0].id;
  // A retried request must not create another draft or an orphan audit event.
  const retry = await pg.query(
    insert.replace(
      " returning id",
      " on conflict(actor,draft_hash) do nothing returning id",
    ),
    [admin],
  );
  assert.equal(retry.rows.length, 0);
  assert.equal(
    (
      await pg.query(
        "select * from private.audit_events where action='commercial_draft.community_competitions'",
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await pg.query(
        "select * from private.audit_events where action='commercial_draft.community_competitions' and subject=$1",
        [c],
      )
    ).rows.length,
    1,
  );
  const rules = (
    await pg.query<{ id: string }>(
      "insert into private.competition_rules(competition_id,version,ranking_rule_version,config,config_hash,minimum_settled,minimum_active_days,entry_limit,tie_breaker,actor) values($1,'fixture','fixture','{}',$2,20,7,1,'NET_UNITS_ROI_SETTLED_EARLIEST',$3) returning id",
      [c, "a".repeat(64), admin],
    )
  ).rows[0].id;
  await assert.rejects(
    () =>
      pg.query(
        "update private.competition_rules set minimum_settled=21 where id=$1",
        [rules],
      ),
    /Append-only evidence/i,
  );
  await assert.rejects(
    () =>
      pg.query("delete from private.community_competitions where id=$1", [c]),
    /Append-only evidence/i,
  );
  await assert.rejects(
    () =>
      pg.query(
        "insert into private.competition_rankings(competition_id,rule_id,rankings,export_hash) values($1,$2,'[]','fixture')",
        [c, rules],
      ),
    /disabled in Phase 3/,
  );
  await assert.rejects(
    () =>
      pg.query(
        "insert into private.competition_qualifications(competition_id,member_id,rule_id,eligible,reason,qualifying_edge_ids) values($1,$2,$3,true,'fixture','{}')",
        [c, member, rules],
      ),
    /disabled in Phase 3/,
  );
  await assert.rejects(
    () =>
      pg.query(
        "insert into private.prize_award_events(competition_id,prize_id,candidate_member_id,ranking_id,state,actor,reason,evidence) values($1,$1,$2,$1,'AWARDED',$3,'Isolated attempt only','fixture')",
        [c, member, admin],
      ),
    /disabled in Phase 3/,
  );
});

test("deal drafts retain disclosure and audit and cannot become active through direct SQL", async () => {
  const row = (
    await pg.query<{ id: string }>(
      "insert into private.community_deals(title,description,sponsor,category,country,state,membership,starts_at,ends_at,terms,disclosure,tracking_class,actor,draft_hash,reason) values('Isolated fixture','No live deal','Fixture sponsor','MERCHANDISE','XX','TEST','FREE','2030-01-01','2030-02-01','Draft terms','Draft sponsorship disclosure','NONE',$1,repeat('b',64),'Isolated software test only') returning id",
      [admin],
    )
  ).rows[0];
  await assert.rejects(
    () =>
      pg.query(
        "update private.community_deals set state_code='ACTIVE' where id=$1",
        [row.id],
      ),
    /Append-only evidence/i,
  );
  await assert.rejects(
    () => pg.query("delete from private.community_deals where id=$1", [row.id]),
    /Append-only evidence/i,
  );
  assert.equal(
    (
      await pg.query(
        "select * from private.audit_events where action='commercial_draft.community_deals' and subject=$1",
        [row.id],
      )
    ).rows.length,
    1,
  );
});
