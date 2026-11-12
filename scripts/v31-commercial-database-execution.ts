/** Exact founder-approved DDL only. No customer, inventory, Auth or gate writes. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createDecipheriv } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  custodyQuery,
  tableListQuery,
  checksumQuery,
} from "./lib/reviewed-inventory";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
import { authenticateDatabaseBackup } from "./lib/authenticated-database-backup";
import { digest } from "../src/core/scoring-engine";
import { approvedSchedulerDrift } from "./lib/v31-scheduler-drift";
import {
  authority,
  packet,
  blob,
  root,
  evidence,
  privateDir,
  writeEvidence,
  writePrivate,
  sourceCommit,
  packageSha256,
} from "./lib/v31-commercial-approval.mjs";
const mode = process.argv[2];
assert(["preflight", "apply", "verify"].includes(mode));
const p =
  mode === "apply" ? authority("two-new-production-migrations") : packet();
const versions = ["20261113002000", "20261113003000"];
const oldVersions = [
  "20261109231834",
  "20261109232000",
  "20261109232124",
  "20261110005726",
  "20261110010050",
];
const fields =
  v31SchemaFingerprintSql.slice(
    0,
    v31SchemaFingerprintSql.lastIndexOf("\nselect md5"),
  ) + "\nselect kind,identity,definition from entries order by kind,identity";
async function checksums(tx: any) {
  const names: string[] = (await tx.unsafe(tableListQuery))[0].value;
  const sums: Record<string, unknown> = {};
  for (let n = 0; n < names.length; n += 25) {
    const rows = await tx.unsafe(
      names
        .slice(n, n + 25)
        .map(checksumQuery)
        .join(" union all "),
    );
    for (const r of rows) {
      const { table, ...value } = r.value;
      sums[table] = value;
    }
  }
  return sums;
}
async function baseline(tx: any) {
  const [r] = await tx`select
    (select count(*)::int from commercial_billing.definitions) definitions,
    (select count(*)::int from commercial_billing.definitions where approved) approved,
    (select sum(legacy_issued)::int from commercial_billing.definitions) consumed,
    (select count(*)::int from commercial_billing.cards) cards,
    (select count(*)::int from commercial_billing.packs) packs,
    (select count(*)::int from commercial_billing.accounts) accounts,
    (select count(*)::int from commercial_billing.receipts) receipts,
    (select count(*)::int from commercial_billing.control where environment='commercial' and not sales_enabled and not issuance_enabled and not transfers_enabled and not gameplay_enabled) closed_control,
    (select count(*)::int from public_gameplay.rounds where enabled) enabled_rounds,
    (select count(*)::int from private.feature_flags where enabled) active_flags,
    (select count(*)::int from operations.retention_policy where enabled) retention_enabled`;
  assert.deepEqual(r, {
    definitions: 6540,
    approved: 0,
    consumed: 888,
    cards: 0,
    packs: 0,
    accounts: 0,
    receipts: 0,
    closed_control: 1,
    enabled_rounds: 0,
    active_flags: 0,
    retention_enabled: 0,
  });
  const custody = (await tx.unsafe(custodyQuery))[0].value;
  assert.equal(custody.length, 906);
  assert.equal(
    digest(custody),
    "a1bbdf806cee3f51d870b31f5fcb74d6cae0df93846f34bb4c291ffaae99cb8e",
  );
  const prior =
    await tx`select version from supabase_migrations.schema_migrations where version=any(${oldVersions}) order by version`;
  assert.deepEqual(
    prior.map((x: any) => x.version),
    oldVersions,
  );
  const roles =
    await tx`select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls,rolcanlogin,rolconnlimit from pg_roles where rolname !~ '^pg_' order by rolname`;
  const memberships =
    await tx`select r.rolname role,m.rolname member,g.rolname grantor,a.admin_option,a.inherit_option,a.set_option from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor order by r.rolname,m.rolname,g.rolname`;
  const [operator] =
    await tx`select current_user name,rolsuper,rolcreaterole,exists(select 1 from pg_auth_members m where m.member=(select oid from pg_roles where rolname=current_user) and m.roleid='docked_commercial_app'::regrole and m.admin_option) commercial_admin from pg_roles where rolname=current_user`;
  assert.equal(operator.name, "postgres");
  assert.equal(operator.rolsuper, false);
  assert.equal(operator.rolcreaterole, true);
  assert.equal(operator.commercial_admin, true);
  return {
    counts: r,
    custodyRecords: 906,
    custodyDigest: digest(custody),
    roles: [...roles],
    memberships: [...memberships],
    operator,
  };
}
async function grants(tx: any) {
  const [r] = await tx.unsafe(`select jsonb_build_object(
    'indexesValid',(select count(*)=2 and bool_and(indisvalid) from pg_index where indexrelid in ('commercial_billing.commercial_market_request_identity'::regclass,'commercial_billing.commercial_market_listing_activity'::regclass)),
    'collectionRuntimeAllowed',has_function_privilege('docked_commercial_app','commercial_billing.preserved_collection_rows(uuid,text)','execute'),
    'marketRuntimeAllowed',has_function_privilege('docked_commercial_app','commercial_billing.market_party_allowed(uuid,uuid,text,text)','execute'),
    'memberRuntimeAllowed',has_function_privilege('docked_app','commercial_billing.member_record(text)','execute'),
    'unauthorisedExecute',exists(select 1 from unnest(array['anon','authenticated','service_role','docked_app','docked_beta_app']) r where has_function_privilege(r,'commercial_billing.preserved_collection_rows(uuid,text)','execute') or has_function_privilege(r,'commercial_billing.market_party_allowed(uuid,uuid,text,text)','execute')),
    'triggerCallable',exists(select 1 from unnest(array['anon','authenticated','service_role','docked_app','docked_beta_app','docked_commercial_app']) r where has_function_privilege(r,'commercial_billing.market_listing_guard()','execute')),
    'triggerPresent',exists(select 1 from pg_trigger where tgrelid='commercial_billing.listings'::regclass and tgname='commercial_listing_terms' and tgenabled='O'),
    'outboxExposed',exists(select 1 from unnest(array['anon','authenticated','docked_app','docked_commercial_app']) r where has_table_privilege(r,'private.outbox','select,insert,update,delete')),
    'unclaimedViewerDenied',not commercial_billing.market_party_allowed(null,null,'','')) value`);
  assert.deepEqual(r.value, {
    indexesValid: true,
    collectionRuntimeAllowed: true,
    marketRuntimeAllowed: true,
    memberRuntimeAllowed: true,
    unauthorisedExecute: false,
    triggerCallable: false,
    triggerPresent: true,
    outboxExposed: false,
    unclaimedViewerDenied: true,
  });
  return r.value;
}
let committed = false;
async function main() {
  const cwd = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(cwd);
  try {
    if (mode === "preflight") {
      const result = await sql.begin(
        "isolation level repeatable read read only",
        async (tx: any) => {
          await tx`set local statement_timeout='60s'`;
          const b = await baseline(tx),
            schema = (await tx.unsafe(v31SchemaFingerprintSql))[0];
          assert.deepEqual(schema, p.baselineProductionSchema);
          assert(
            !b.roles.some(
              (x: any) => x.rolname === "docked_commercial_runtime",
            ),
          );
          assert.equal(
            (
              await tx`select count(*)::int n from supabase_migrations.schema_migrations where version=any(${versions})`
            )[0].n,
            0,
          );
          return { ...b, schema, tables: await checksums(tx) };
        },
      );
      writePrivate("database-preflight.private.json", {
        at: new Date().toISOString(),
        ...result,
      });
      writeEvidence("database-preflight.json", {
        at: new Date().toISOString(),
        sourceCommit,
        packageSha256,
        schema: result.schema,
        counts: result.counts,
        custodyRecords: 906,
        protectedTables: Object.keys(result.tables).length,
        operatorCanGrantReviewedRole: true,
        productionWrites: 0,
      });
      console.log(
        "Exact Production schema, five original migrations, custody and role preflight passed",
      );
      return;
    }
    if (mode === "verify") {
      const result = await sql.begin(
        "isolation level repeatable read read only",
        async (tx: any) => {
          const b = await baseline(tx);
          const original = JSON.parse(
            readFileSync(
              privateDir + "/database-preflight.private.json",
              "utf8",
            ),
          );
          assert.deepEqual(
            b.roles.filter(
              (r: any) => r.rolname !== "docked_commercial_runtime",
            ),
            original.roles,
            "Existing roles changed",
          );
          assert.deepEqual(
            b.memberships.filter(
              (r: any) =>
                r.role !== "docked_commercial_runtime" &&
                r.member !== "docked_commercial_runtime",
            ),
            original.memberships,
            "Existing memberships changed",
          );
          const sums = await checksums(tx);
          const schedulerDrift = await approvedSchedulerDrift(tx);
          const exclusions = [
            "cron.job_run_details",
            "private.docked_mail_scheduler",
            "sports_feed.weekly_core_job_runs",
            "supabase_migrations.schema_migrations",
          ];
          const protectedNames = Object.keys(sums).filter(
            (t) =>
              !exclusions.includes(t) && !schedulerDrift?.tables.includes(t),
          );
          for (const t of protectedNames)
            assert.deepEqual(
              sums[t],
              original.tables[t],
              "Protected data changed: " + t,
            );
          return {
            ...b,
            schema: (await tx.unsafe(v31SchemaFingerprintSql))[0],
            grants: await grants(tx),
            protectedTablesUnchanged: protectedNames.length,
            checksumExclusions: exclusions,
            schedulerDrift,
          };
        },
      );
      assert.equal(
        (
          await sql`select count(*)::int n from supabase_migrations.schema_migrations where version=any(${versions})`
        )[0].n,
        2,
      );
      console.log(
        JSON.stringify({
          verified: true,
          schema: result.schema,
          counts: result.counts,
          custodyRecords: 906,
          grants: result.grants,
          protectedTablesUnchanged: result.protectedTablesUnchanged,
          checksumExclusions: result.checksumExclusions,
          existingRolesAndMembershipsUnchanged: true,
          schedulerDrift: result.schedulerDrift,
        }),
      );
      return;
    }
    const backupDirectory = root + "/private-data/commercial-restore-20261113a";
    const authentication = await authenticateDatabaseBackup({
      manifestPath: backupDirectory + "/manifest.aes",
      archivePath: backupDirectory + "/production.dump.aes",
      keyPath:
        process.env.USERPROFILE +
        "/.docked-secrets/launch-migration-backup-key.hex",
      projectRef: p.databaseProject,
      maxAgeMs: 3600000,
    });
    const restored = JSON.parse(
      readFileSync(evidence + "/fresh-restore/restore-only.json", "utf8"),
    );
    assert.equal(restored.archiveSha256, authentication.plaintextSha256);
    assert.equal(restored.restored, true);
    assert.equal(restored.protectedRecordsUnchanged, true);
    const b = readFileSync(backupDirectory + "/manifest.aes"),
      key = Buffer.from(
        readFileSync(
          process.env.USERPROFILE +
            "/.docked-secrets/launch-migration-backup-key.hex",
          "utf8",
        ).trim(),
        "hex",
      );
    const d = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    const backup = JSON.parse(
      Buffer.concat([d.update(b.subarray(28)), d.final()]).toString(),
    );
    key.fill(0);
    const original = JSON.parse(
      readFileSync(privateDir + "/database-preflight.private.json", "utf8"),
    );
    const result = await sql.begin(
      "isolation level repeatable read",
      async (tx: any) => {
        authority("two-new-production-migrations");
        await tx`set local lock_timeout='3s'`;
        await tx`set local statement_timeout='60s'`;
        const before = await baseline(tx),
          schema = (await tx.unsafe(v31SchemaFingerprintSql))[0];
        assert.deepEqual(schema, p.baselineProductionSchema);
        assert.deepEqual(before.roles, original.roles);
        assert.deepEqual(before.memberships, original.memberships);
        assert.equal(
          (
            await tx`select count(*)::int n from supabase_migrations.schema_migrations where version=any(${versions})`
          )[0].n,
          0,
        );
        const sums = await checksums(tx);
        const schedulerDrift = await approvedSchedulerDrift(tx);
        for (const table of Object.keys(sums).filter(
          (x) =>
            ![
              "cron.job_run_details",
              "private.docked_mail_scheduler",
              "sports_feed.weekly_core_job_runs",
            ].includes(x) && !schedulerDrift?.tables.includes(x),
        )) {
          const quoted = table
            .split(".")
            .map((x) => '"' + x + '"')
            .join(".");
          assert.deepEqual(
            sums[table],
            backup.sums[quoted],
            "Backup data drift: " + table,
          );
        }
        const entriesBefore = await tx.unsafe(fields);
        for (const f of p.productionMigrations)
          await tx.unsafe(blob(f.file).toString());
        const permissions = await grants(tx);
        assert.deepEqual(
          await checksums(tx),
          sums,
          "DDL changed protected data",
        );
        const entriesAfter = await tx.unsafe(fields);
        const map = (v: any[]) =>
          Object.fromEntries(
            v.map((x) => [x.kind + ":" + x.identity, x.definition]),
          );
        const a = map(entriesBefore),
          z = map(entriesAfter);
        const changes = Object.keys({ ...a, ...z })
          .filter((x) => JSON.stringify(a[x]) !== JSON.stringify(z[x]))
          .sort();
        assert.equal(changes.length, 7);
        assert(
          changes.every((x) =>
            /^(function:commercial_billing\.(preserved_collection_rows|member_record|market_party_allowed|market_listing_guard)\(|index:commercial_billing\.commercial_market_(request_identity|listing_activity)$|trigger:commercial_billing\.listings\.commercial_listing_terms$)/.test(
              x,
            ),
          ),
          "Unexpected changed schema object",
        );
        for (const [i, f] of p.productionMigrations.entries())
          await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${versions[i]},${f.file.split("/").at(-1).slice(15, -4)},${[blob(f.file).toString()]})`;
        assert.deepEqual((await baseline(tx)).counts, before.counts);
        return {
          at: new Date().toISOString(),
          sourceCommit,
          packageSha256,
          backup: authentication,
          counts: before.counts,
          schedulerDrift,
          custodyRecords: 906,
          protectedTablesUnchanged: Object.keys(sums).length,
          expectedMigrationHistoryRowsAdded: 2,
          schemaBefore: schema,
          schemaAfter: (await tx.unsafe(v31SchemaFingerprintSql))[0],
          changedSchemaObjects: changes,
          grants: permissions,
          originalFiveReapplied: false,
          customerMutations: 0,
        };
      },
    );
    committed = true;
    writeEvidence("database-applied.json", result);
    console.log(JSON.stringify(result));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e: any) => {
  writeFileSync(privateDir + "/database-error.private.txt", String(e), {
    mode: 0o600,
  });
  console.error(
    JSON.stringify({
      mode,
      committed,
      error: "Stopped; private diagnostic retained; no automatic retry",
    }),
  );
  process.exitCode = 1;
});
