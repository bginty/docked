/** Deployment prerequisite investigation only. Every hosted SQL transaction is read-only. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { custodyQuery } from "./lib/reviewed-inventory";
import { digest } from "../src/core/scoring-engine";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
const root = process.cwd();
const main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const out = root + "/docs/qa/batch1-production-execution-20261116";
mkdirSync(out, { recursive: true });
const save = (file: string, value: unknown) =>
  writeFileSync(out + "/" + file, JSON.stringify(value, null, 2) + "\n");
const sha = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
async function run() {
  if (process.argv.includes("--preview")) {
    const c = JSON.parse(
      readFileSync(
        main + "/private-data/hosted-preview/connection.json",
        "utf8",
      ),
    );
    assert.equal(c.projectRef, "bckkllmndoxzpzdqrevb");
    const u = new URL(c.databaseUrl);
    assert.equal(decodeURIComponent(u.username), "postgres." + c.projectRef);
    assert.match(u.hostname, /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/);
    const sql = postgres(u.href, {
      max: 1,
      prepare: false,
      connect_timeout: 15,
      ssl: {
        rejectUnauthorized: true,
        ca: readFileSync(root + "/certs/supabase-prod-ca-2021.crt", "utf8"),
      },
      onnotice: () => {},
    });
    try {
      const value = await sql.begin("read only", async (tx) => {
        const rows =
          await tx`select current_database() database,version() version,to_regclass('credits_sandbox.state')::text wallet,to_regnamespace('season_catalogue') is not null season_catalogue`;
        const migrations =
          await tx`select version from supabase_migrations.schema_migrations where version>='20261109000000' order by version`;
        const functions =
          await tx`select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' signature,encode(sha256(convert_to(replace(pg_get_functiondef(p.oid),E'\r',''),'UTF8')),'hex') hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and n.nspname in('credits_sandbox','commercial_billing','sports_feed','beta_packs') and p.proname in('capture','prevent_parallel_inventory','guard_economy_state','guard_redemption','marketplace_guard','project_fixture_inventory','rarity_transfer_guard') order by 1`;
        const expected = JSON.parse(
          readFileSync(
            root + "/docs/qa/batch1-pack-phone-20261116/database-schema.json",
            "utf8",
          ),
        ).changedFunctions;
        return {
          rows,
          recentMigrations: migrations,
          predecessors: expected.map((f: any) => ({
            signature: f.signature,
            present: functions.some((r) => r.signature === f.signature),
            matches:
              functions.find((r) => r.signature === f.signature)?.hash ===
              f.beforeSha256,
          })),
        };
      });
      save("preview-access.json", {
        at: new Date().toISOString(),
        projectRef: c.projectRef,
        connected: true,
        tlsVerified: true,
        ...value,
        productionWrites: 0,
      });
      console.log(
        "Existing Preview database connection and dependency checks completed read-only",
      );
    } catch (e: any) {
      save("preview-access.json", {
        at: new Date().toISOString(),
        projectRef: c.projectRef,
        connected: false,
        code: /^[A-Z0-9_]+$/.test(e.code ?? "") ? e.code : "UNAVAILABLE",
        productionWrites: 0,
      });
      console.log(
        "Existing Preview database connection unavailable; no credentials emitted",
      );
    } finally {
      await sql.end({ timeout: 3 });
    }
    return;
  }
  process.chdir(main);
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    if (process.argv.includes("--custody")) {
      const value = await sql.begin(
        "read only",
        async (tx) => (await tx.unsafe(custodyQuery))[0].value,
      );
      const report = {
        at: new Date().toISOString(),
        custodyRecords: value.length,
        custodyDigest: digest(value),
        productionWrites: 0,
      };
      const previous = JSON.parse(
        readFileSync(out + "/production-readonly.json", "utf8"),
      );
      assert.equal(report.custodyRecords, previous.custodyRecords);
      assert.equal(report.custodyDigest, previous.custodyDigest);
      save("final-custody.json", report);
      console.log(JSON.stringify(report));
      return;
    }
    const value = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='90s'`;
        const custody = (await tx.unsafe(custodyQuery))[0].value;
        const [counts] = await tx`select
    (select count(*)::int from commercial_billing.definitions) definitions,
    (select sum(issued)::int from commercial_billing.definitions) lifetime,
    (select sum(legacy_issued)::int from commercial_billing.definitions) legacy,
    (select count(*)::int from beta_packs.issued) beta_allocations,
    (select count(*)::int from commercial_billing.cards) commercial_cards,
    (select count(*)::int from public_gameplay.rounds where enabled) active_competitions,
    (select count(*)::int from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled) open_commercial_controls,
    (select count(*)::int from private.feature_flags where enabled) public_flags,
    (select count(*)::int from operations.retention_policy where enabled) deletion_schedules`;
        const [financialHashes] =
          await tx`select md5((document->'journal')::text) journal,md5((document->'lots')::text) lots,md5((document->'cases')::text) cases,md5(document::text) aggregate from credits_sandbox.state where id`;
        const schema = (await tx.unsafe(v31SchemaFingerprintSql))[0];
        const functions =
          await tx`select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' signature,encode(sha256(convert_to(replace(pg_get_functiondef(p.oid),E'\r',''),'UTF8')),'hex') hash,pg_get_userbyid(p.proowner) owner,p.proacl,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind in('f','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema' order by 1`;
        const tables =
          await tx`select n.nspname,c.relname,c.relacl,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema' order by 1,2`;
        const policies =
          await tx`select * from pg_policies order by schemaname,tablename,policyname`;
        const roles =
          await tx`select rolname,rolsuper,rolcanlogin,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname!~'^pg_' order by rolname`;
        const memberships =
          await tx`select r.rolname role,m.rolname member,a.admin_option,a.inherit_option,a.set_option from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member order by 1,2`;
        const migrations =
          await tx`select version from supabase_migrations.schema_migrations where version in('20261115113306','20261115211545','20261115235000') order by version`;
        const weekly =
          await tx`select sport,count(*)::int entitlements,count(*) filter(where receipt is null)::int unopened,count(*) filter(where receipt is not null)::int opened,md5(string_agg(to_jsonb(p)::text,E'\n' order by id)) digest from sports_feed.weekly_core_packs p group by sport order by sport`;
        const season =
          await tx`select sport,season,scope,count(*)::int members,count(*) filter(where season_catalogue.can_issue(sport,season,player_id,scope))::int eligible from season_catalogue.members group by sport,season,scope order by sport,season,scope`;
        const weeklyFunctions =
          await tx`select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' signature,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and ((n.nspname='sports_feed' and p.proname in('open_weekly_core','weekly_core_allowed')) or (n.nspname='nfl_roster' and p.proname in('guard_mint','can_issue')) or (n.nspname='season_catalogue' and p.proname='can_issue') or (n.nspname='beta_fantasy' and p.proname in('mint','card_guard'))) order by 1`;
        const weeklyTriggers =
          await tx`select n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid,true) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and ((n.nspname='beta_fantasy' and c.relname in('cards','editions')) or (n.nspname='sports_feed' and c.relname='weekly_core_packs')) order by 1,2,3`;
        return {
          counts,
          custodyRecords: custody.length,
          custodyDigest: digest(custody),
          financialHashes,
          schema,
          functions,
          tableSecurityDigest: sha(tables),
          policyDigest: sha(policies),
          roles,
          memberships,
          alreadyApplied: migrations,
          weekly,
          season,
          weeklyFunctions,
          weeklyTriggers,
        };
      },
    );
    const release = await fetch("https://docked.com.au/api/beta-release").then(
      (r) => r.json(),
    );
    const old = JSON.parse(
      readFileSync(
        root +
          "/docs/qa/batch1-beta-alignment-20261116/production-schema-current.json",
        "utf8",
      ),
    );
    const review = JSON.parse(
      readFileSync(
        root + "/docs/qa/batch1-pack-phone-20261116/database-schema.json",
        "utf8",
      ),
    );
    const compared = Object.fromEntries(
      ["counts", "custodyRecords", "custodyDigest", "financialHashes"].map(
        (k) => [
          k,
          JSON.stringify((value as any)[k]) === JSON.stringify(old[k]),
        ],
      ),
    );
    const predecessorMatches = review.changedFunctions.map((f: any) => ({
      signature: f.signature,
      expected: f.beforeSha256,
      actual: value.functions.find((r) => r.signature === f.signature)?.hash,
    }));
    const report = {
      at: new Date().toISOString(),
      release,
      ...value,
      comparisonToApprovedEvidence: compared,
      predecessorMatches,
      productionWrites: 0,
    };
    save("production-readonly.json", report);
    console.log(
      JSON.stringify({
        at: report.at,
        release,
        counts: value.counts,
        custodyRecords: value.custodyRecords,
        comparisonToApprovedEvidence: compared,
        predecessorsMatch: predecessorMatches.every(
          (f: any) => f.expected === f.actual,
        ),
        alreadyApplied: value.alreadyApplied,
        weekly: value.weekly,
        season: value.season,
        productionWrites: 0,
      }),
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}
run().catch((e) => {
  console.error(
    "Read-only investigation failed:",
    /^[A-Z0-9_]+$/.test(e.code ?? "")
      ? e.code
      : e instanceof assert.AssertionError
        ? "ASSERTION"
        : "UNAVAILABLE",
  );
  process.exitCode = 1;
});
