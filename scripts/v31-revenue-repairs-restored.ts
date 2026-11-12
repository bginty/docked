/** Authenticated retained restore only. No network client or Production credentials. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { digest } from "../src/core/scoring-engine";
import {
  reviewedInventorySql,
  custodyQuery,
  tableListQuery,
  checksumQuery,
} from "./lib/reviewed-inventory";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";

const target = "docked-commercial-restore-20261112d-attempt-2";
const directory = "docs/qa/v31-revenue-launch-20261113/";
const migrations = [
  "supabase/migrations/20261113002000_preserved_commercial_collection_read.sql",
  "supabase/migrations/20261113003000_commercial_market_request_guards.sql",
];
const marketRollback = `drop trigger commercial_listing_terms on commercial_billing.listings;
drop function commercial_billing.market_listing_guard();
drop function commercial_billing.market_party_allowed(uuid,uuid,text,text);
drop index commercial_billing.commercial_market_listing_activity;
drop index commercial_billing.commercial_market_request_identity;
`;
let stage = "isolation";
async function run(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn("docker", args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    p.stdout.on("data", (c) => (out += c));
    p.stderr.on("data", (c) => (err += c));
    p.stdin.on("error", () => {});
    p.on("error", reject);
    p.on("exit", (code) =>
      code === 0 ? resolve(out) : reject(new Error(err)),
    );
    p.stdin.end(input);
  });
}
async function sql(query: string) {
  const result = await run(
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
    query,
  );
  return result
    .split("\n")
    .filter((s) => s.startsWith("{") || s.startsWith("["))
    .map((s) => JSON.parse(s));
}
async function capture() {
  const [tables] = await sql(tableListQuery);
  const values = await sql(
    `begin isolation level repeatable read read only;${tables.map(checksumQuery).join(";\n")};${custodyQuery};commit;`,
  );
  return {
    tables: Object.fromEntries(
      values
        .slice(0, tables.length)
        .map((v) => [v.table, { count: v.count, hash: v.hash }]),
    ),
    custody: values[tables.length],
  };
}
async function fingerprint() {
  return (
    await sql(`select row_to_json(f) from (${v31SchemaFingerprintSql}) f`)
  )[0];
}
async function schemaEntries() {
  return (
    await sql(
      v31SchemaFingerprintSql.slice(
        0,
        v31SchemaFingerprintSql.lastIndexOf("\nselect md5"),
      ) +
        "\nselect jsonb_agg(jsonb_build_object('kind',kind,'identity',identity,'definition',definition) order by kind,identity) from entries",
    )
  )[0];
}
async function main() {
  const resumedApplied = process.argv.includes("--resume-applied");
  const resumed =
    process.argv.includes("--resume-rolled-back") || resumedApplied;
  assert.deepEqual(
    process.argv.slice(2),
    resumed
      ? [
          "--isolated-restored",
          resumedApplied ? "--resume-applied" : "--resume-rolled-back",
        ]
      : ["--isolated-restored"],
  );
  const [container] = JSON.parse(await run(["inspect", target]));
  assert.equal(container.HostConfig.NetworkMode, "none");
  assert.equal(container.State.Running, true);
  assert.equal(Object.keys(container.HostConfig.PortBindings ?? {}).length, 0);
  const restore = JSON.parse(
    readFileSync(
      directory + "restored-production-market/restore-only.json",
      "utf8",
    ),
  );
  assert.equal(restore.restoreTarget, target);
  assert.equal(restore.protectedTables, 558);
  if (resumedApplied) {
    const prior = JSON.parse(
      readFileSync(directory + "revenue-repairs-restored.json", "utf8"),
    );
    assert.equal(prior.target, target);
    for (const file of prior.migrations)
      assert.equal(
        createHash("sha256").update(readFileSync(file.file)).digest("hex"),
        file.sha256,
      );
    await sql(
      `begin;${readFileSync(directory + "revenue-repairs-rollback.sql", "utf8")}commit;`,
    );
  }
  const [preflight] = await sql(
    `select jsonb_build_object('superuser',(select rolsuper from pg_roles where rolname=current_user),'cron',current_setting('cron.launch_active_jobs'),'network',current_setting('pg_net.database_name'),'definitions',(select count(*) from commercial_billing.definitions),'cards',(select count(*) from commercial_billing.cards),'listings',(select count(*) from commercial_billing.listings),'newFunction',to_regprocedure('commercial_billing.market_party_allowed(uuid,uuid,text,text)'),'newCollection',to_regprocedure('commercial_billing.preserved_collection_rows(uuid,text)'))`,
  );
  assert.deepEqual(preflight, {
    superuser: false,
    cron: "off",
    network: "network_worker_disabled",
    definitions: resumed ? 6540 : 0,
    cards: 0,
    listings: 0,
    newFunction: null,
    newCollection: null,
  });
  stage = "reconstruct approved dormant baseline in isolated restore";
  const planBytes = readFileSync(
    "private-data/v31-card-research-20261111/complete-proposal.private.json",
  );
  assert.equal(
    createHash("sha256").update(planBytes).digest("hex"),
    "4b039916c4ef00698e10bfa9d14c41ce23b9febf06cf78e035ae595a08dd3ee4",
  );
  const plan = JSON.parse(planBytes.toString());
  if (!resumed) await sql(`begin;${reviewedInventorySql(plan)}commit;`);
  const before = await capture(),
    original = await fingerprint();
  const entriesBefore = await schemaEntries();
  assert.equal(
    new Set(entriesBefore.map((e: any) => e.kind + ":" + e.identity)).size,
    entriesBefore.length,
    "Qualified schema identities must be unique and untruncated",
  );
  writeFileSync(
    "private-data/v31-revenue-launch-20261113/repair-schema-before.private.json",
    JSON.stringify(entriesBefore),
  );
  assert.equal(digest(before.custody), plan.protectedCustodyDigest);
  assert.equal(before.custody.length, 906);
  const [permissionsBefore] = await sql(
    `select coalesce(jsonb_agg(jsonb_build_array(c.relname,c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='commercial_billing' and c.relkind='r'`,
  );
  stage = "apply exact proposed repairs as non-superuser owner";
  const files = migrations.map((file) => ({
    file,
    bytes: readFileSync(file, "utf8"),
  }));
  const timings: number[] = [];
  for (const file of files) {
    const start = performance.now();
    await sql(
      `begin;set local lock_timeout='3s';set local statement_timeout='60s';${file.bytes}commit;`,
    );
    timings.push(Math.round(performance.now() - start));
  }
  const applied = await fingerprint();
  for (const file of files) await sql(`begin;${file.bytes}commit;`);
  assert.deepEqual(
    await fingerprint(),
    applied,
    "Reapplication changed schema",
  );
  const [permissionsAfter] = await sql(
    `select coalesce(jsonb_agg(jsonb_build_array(c.relname,c.relacl,c.relrowsecurity,c.relforcerowsecurity) order by c.relname),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='commercial_billing' and c.relkind='r'`,
  );
  assert.deepEqual(permissionsAfter, permissionsBefore);
  const [grants] = await sql(
    `select jsonb_build_object('unauthorisedExecute',exists(select 1 from unnest(array['anon','authenticated','service_role','docked_app','docked_beta_app'])r cross join unnest(array['commercial_billing.market_party_allowed(uuid,uuid,text,text)','commercial_billing.preserved_collection_rows(uuid,text)'])f where has_function_privilege(r,f,'execute')),'runtimeAllowed',has_function_privilege('docked_commercial_app','commercial_billing.market_party_allowed(uuid,uuid,text,text)','execute'),'triggerExecuteDenied',not has_function_privilege('docked_commercial_app','commercial_billing.market_listing_guard()','execute'),'unclaimedViewerDenied',not commercial_billing.market_party_allowed('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','invalid','invalid'),'indexesValid',not exists(select 1 from pg_index i join pg_class c on c.oid=i.indexrelid where c.relname in('commercial_market_request_identity','commercial_market_listing_activity') and not i.indisvalid))`,
  );
  assert.deepEqual(grants, {
    unauthorisedExecute: false,
    runtimeAllowed: true,
    triggerExecuteDenied: true,
    unclaimedViewerDenied: true,
    indexesValid: true,
  });
  assert.deepEqual(
    await capture(),
    before,
    "Repair migration changed protected records",
  );
  stage = "conditional rollback and forward recovery";
  const rollback =
    marketRollback +
    readFileSync(directory + "collection-rollback.sql", "utf8");
  await sql(`begin;set local lock_timeout='3s';${rollback}commit;`);
  const entriesAfter = await schemaEntries();
  const map = (entries: any[]) =>
    Object.fromEntries(
      entries.map((e) => [e.kind + ":" + e.identity, e.definition]),
    );
  const a = map(entriesBefore),
    b = map(entriesAfter);
  const changes = Object.keys({ ...a, ...b })
    .filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((identity) => ({ identity, before: a[identity], after: b[identity] }));
  writeFileSync(
    "private-data/v31-revenue-launch-20261113/repair-schema-diff.private.json",
    JSON.stringify(changes),
  );
  console.log(
    JSON.stringify({
      rollbackDifferentObjects: changes.map((c) => c.identity),
    }),
  );
  assert.deepEqual(
    await fingerprint(),
    original,
    "Rollback failed to restore exact schema and ACLs",
  );
  for (const file of files) await sql(`begin;${file.bytes}commit;`);
  assert.deepEqual(await fingerprint(), applied);
  assert.deepEqual(await capture(), before);
  const report = {
    at: new Date().toISOString(),
    environment: "network-isolated authenticated Production restore",
    target,
    sourceArchiveAt: restore.backupAt,
    sourceArchiveSha256: restore.archiveSha256,
    productionWrites: 0,
    providerCalls: 0,
    originalFiveMigrationsReapplied: false,
    baselineReconstructedLocally: true,
    dormantDefinitions: 6540,
    lifetimeConsumed: 888,
    custodyRecords: 906,
    protectedTablesUnchanged: Object.keys(before.tables).length,
    migrationOperatorSuperuser: false,
    migrations: files.map((f, i) => ({
      file: f.file,
      sha256: createHash("sha256").update(f.bytes).digest("hex"),
      localApplicationMs: timings[i],
    })),
    grants,
    tableGrantsAndRlsUnchanged: true,
    schemaBefore: original,
    schemaAfter: applied,
    rollbackExactSchemaAndAclMatch: true,
    reapplicationPassed: true,
    forwardRecoveryPassed: true,
    hostedAcceptance: false,
    fingerprintAlgorithm: "v2-text-identities-no-name-truncation",
  };
  writeFileSync(directory + "revenue-repairs-v2-rollback.sql", rollback, {
    flag: "wx",
  });
  writeFileSync(
    directory + "revenue-repairs-v2-restored.json",
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
  console.log(JSON.stringify(report));
}
main().catch((error) => {
  writeFileSync(
    "private-data/v31-revenue-launch-20261113/revenue-restore-error.private.txt",
    String(error),
  );
  console.error(
    `Isolated repair rehearsal failed at ${stage}; private diagnostic retained. No Production connection.`,
  );
  process.exitCode = 1;
});
