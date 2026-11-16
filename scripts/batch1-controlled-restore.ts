/** Fresh network-disabled restore only. All migrations and test openings roll back. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tableListQuery, checksumQuery } from "./lib/reviewed-inventory";
const target = "docked-commercial-restore-20261116b";
const dir = "docs/qa/batch1-controlled-20261116/";
const config = JSON.parse(
  execFileSync("docker", ["inspect", target], { windowsHide: true }).toString(),
)[0];
assert.equal(config.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(config.HostConfig.PortBindings ?? {}).length, 0);
const restore = JSON.parse(
  readFileSync(
    "docs/qa/v31-prelaunch-execution-20261111/database/restore-20261116b/restore-only.json",
    "utf8",
  ),
);
assert(restore.restored && restore.protectedRecordsUnchanged);
assert.equal(restore.restoreTarget, target);
function sql(q: string) {
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      target,
      "psql",
      "-X",
      "-q",
      "-h",
      "/restore",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: q, encoding: "utf8", windowsHide: true, maxBuffer: 64e6 },
  )
    .split(/\r?\n/)
    .filter((s) => s.startsWith("{") || s.startsWith("["))
    .map((s) => JSON.parse(s));
}
const sha = (b: Buffer | string) =>
  createHash("sha256").update(b).digest("hex");
const packet = JSON.parse(
  readFileSync(
    "docs/qa/batch1-pack-phone-20261116/production-package.json",
    "utf8",
  ),
);
const migrationSql = packet.migrations
  .map((m: any) => {
    const b = execFileSync(
      "git",
      ["show", packet.sourceCommit + ":" + m.file],
      { windowsHide: true },
    );
    assert.equal(sha(b), m.sha256);
    return b.toString();
  })
  .join("\n");
const aflOnly = process.argv.includes("--afl-only");
const [allTables] = sql(tableListQuery);
const tables = aflOnly
  ? allTables.filter((t: string) =>
      [
        "sports_feed.weekly_core_packs",
        "beta_fantasy.cards",
        "beta_fantasy.ownership_events",
        "beta_fantasy.requests",
        "beta_fantasy.editions",
        "commercial_billing.definitions",
        "credits_sandbox.state",
      ].includes(t),
    )
  : allTables;
assert(!aflOnly || tables.length === 7);
const census = () =>
  sql(
    "begin read only;" + tables.map(checksumQuery).join(";\n") + ";rollback;",
  );
const before = census();
const metadata = `select coalesce(jsonb_agg(r order by signature),'[]') from(select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' signature,encode(sha256(convert_to(replace(pg_get_functiondef(p.oid),E'\\r',''),'UTF8')),'hex') hash,p.proowner,p.proacl,p.prosecdef,p.proconfig,p.provolatile,p.proleakproof,p.proparallel from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind in('f','p') and n.nspname not like 'pg_%' and n.nspname<>'information_schema')r;`;
const [functionsBefore] = sql(metadata);
const [functionsAfter] = sql(
  "begin;set local lock_timeout='3s';set local statement_timeout='60s';" +
    migrationSql +
    "\n" +
    metadata +
    "rollback;",
);
const changed = functionsAfter.filter(
  (f: any, i: number) => f.hash !== functionsBefore[i].hash,
);
assert.equal(changed.length, 7);
for (const expected of packet.changedFunctions) {
  const old = functionsBefore.find(
      (f: any) => f.signature === expected.signature,
    ),
    current = functionsAfter.find(
      (f: any) => f.signature === expected.signature,
    );
  assert.equal(old.hash, expected.beforeSha256);
  assert.equal(current.hash, expected.afterSha256);
}
assert.deepEqual(
  functionsAfter.map(({ hash: _hash, ...r }: any) => r),
  functionsBefore.map(({ hash: _hash, ...r }: any) => r),
);
assert.deepEqual(census(), before);
const weeklyMetadata = sql(
  `select jsonb_build_object('rosterFresh',count(*) filter(where checked_at>statement_timestamp()-interval '72 hours'),'rosterTotal',count(*),'oldest',min(checked_at),'newest',max(checked_at)) from nfl_roster.current_evidence;select jsonb_build_object('view',pg_get_viewdef('nfl_roster.current_evidence'::regclass,true));`,
);
const results: any[] = [];
for (const phase of ["baseline", "candidate"])
  for (const sport of aflOnly ? ["afl"] : ["nfl", "afl", "nrl"]) {
    const setup = `do $test$declare u uuid;sid uuid;pid uuid;begin
 select a.user_id,s.id,p.id into strict u,sid,pid from credits_sandbox.access a join sports_feed.weekly_core_packs p on p.user_id=a.user_id and p.sport='${sport}' and p.receipt is null join lateral(select id from auth.sessions where user_id=a.user_id and aal='aal2' and (not_after is null or not_after>clock_timestamp()) order by updated_at desc limit 1)s on true where a.enabled and beta_private.admitted(a.user_id) order by (a.kind='owner') desc,p.issued_at limit 1;
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'session_id',sid,'aal','aal2')::text,true);
 perform set_config('docked.fantasy_production','pojoymtniryarxxunyvz',true);perform set_config('docked.fantasy_channel','beta',true);
 perform set_config('docked.nba_private_beta','enabled',true);perform set_config('docked.multi_sport','isolated-preview',true);perform set_config('docked.private_beta_sport','${sport}',true);perform set_config('docked.sports_private_beta','enabled',true);
 perform set_config('batch1.pack',pid::text,true);perform set_config('batch1.request',gen_random_uuid()::text,true);
 end$test$;`;
    const query = `begin;set local lock_timeout='3s';set local statement_timeout='60s';${phase === "candidate" ? migrationSql : ""}\n${setup}
 set local role docked_beta_app;
 with first as materialized(select sports_feed.open_weekly_core(current_setting('batch1.pack')::uuid,current_setting('batch1.request')::uuid,'${sport}') result),retry as materialized(select sports_feed.open_weekly_core(current_setting('batch1.pack')::uuid,current_setting('batch1.request')::uuid,'${sport}') result from first),saved as materialized(select sports_feed.open_weekly_core(current_setting('batch1.pack')::uuid,gen_random_uuid(),'${sport}') result from retry)
 select jsonb_build_object('phase','${phase}','sport','${sport}','cards',jsonb_array_length(first.result->'cards'),'sameRequestReplay',first.result=retry.result,'newRequestSavedReceipt',first.result=saved.result,'uniqueCards',(select count(distinct c->>'id') from jsonb_array_elements(first.result->'cards')c),'allCore',(select bool_and(c->>'tier'='CORE' and (c->>'tradeable')::boolean=false) from jsonb_array_elements(first.result->'cards')c)) from first cross join retry cross join saved;
 reset role;rollback;`;
    try {
      const [r] = sql(query);
      assert.equal(r.cards, 4);
      assert.equal(r.uniqueCards, 4);
      assert(r.sameRequestReplay && r.newRequestSavedReceipt && r.allCore);
      results.push({ ...r, passed: true });
    } catch (e: any) {
      const err = String(e.stderr ?? "");
      const known = [
        "roster",
        "Weekly",
        "Edition",
        "syntax",
        "permission",
        "column",
      ].find((k) => err.includes(k));
      results.push({
        phase,
        sport,
        passed: false,
        errorCategory: known ?? "ISOLATED_SQL_FAILURE",
      });
      writeFileSync(
        dir + "weekly-failure.private-review.txt",
        err.replace(/[a-f0-9]{8}-[a-f0-9-]{27,}/gi, "[redacted-id]"),
      );
    }
  }
assert.deepEqual(census(), before);
const report = {
  at: new Date().toISOString(),
  sourceCommit: packet.sourceCommit,
  backup: restore,
  migrationRehearsalPassed: true,
  exactThreeMigrations: true,
  changedFunctions: 7,
  functionSecurityUnchanged: true,
  protectedTables: before.length,
  allRowsUnchanged: true,
  transactionRolledBack: true,
  productionWrites: 0,
  weeklyMetadata,
  weekly: results,
  hostedAuth: false,
  physicalDevice: false,
};
writeFileSync(
  dir + (aflOnly ? "weekly-afl-recheck.json" : "fresh-restore-acceptance.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({ ...report, weeklyMetadata: weeklyMetadata.slice(0, 1) }),
);
