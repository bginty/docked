/** Authorised catalogue correction only; no member pack opening or gate writes. */
import assert from "node:assert/strict";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { digest } from "../src/core/scoring-engine";
import {
  custodyQuery,
  tableListQuery,
  checksumQuery,
} from "./lib/reviewed-inventory";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
import {
  commercialPermissionQuery,
  expectedCommercialPermissions,
} from "./lib/v31-commercial-permissions";
import {
  captureInventoryScheduler,
  verifyInventorySchedulerDrift,
  inventorySchedulerTables,
} from "./lib/inventory-scheduler-drift";
import { assertOnlyRoundTelemetryChanged } from "./lib/round-backup-compare";
import { authenticateDatabaseBackup } from "./lib/authenticated-database-backup";
import {
  authority,
  packet,
  blob,
  root,
  privateDir,
  readJson,
  writeEvidence,
  writePrivate,
  sourceCommit,
  packageSha256,
} from "./lib/season-catalogue-package.mjs";
const mode = process.argv[2];
assert(["preflight", "apply", "verify"].includes(mode));
const p =
  mode === "apply" ? authority("catalogue-migrations-and-adoption") : packet();
const schedulerTables = [
  ...inventorySchedulerTables,
  "sports_feed.nfl_rounds",
  "sports_feed.nfl_worker_runs",
];
async function invariants(tx: any) {
  const [r] = await tx`select
 (select count(*)::int from commercial_billing.definitions) definitions,
 (select sum(issued)::int from commercial_billing.definitions) issued,
 (select count(*)::int from commercial_billing.definitions where approved) approved,
 (select count(*)::int from commercial_billing.cards) cards,
 (select count(*)::int from commercial_billing.packs) packs,
 (select count(*)::int from commercial_billing.accounts) accounts,
 (select count(*)::int from commercial_billing.receipts) receipts,
 (select count(*)::int from commercial_billing.control where not sales_enabled and not issuance_enabled and not transfers_enabled and not gameplay_enabled) closed,
 (select count(*)::int from public_gameplay.rounds where enabled) "activeRounds",
 (select count(*)::int from private.feature_flags where enabled) "activeFlags",
 (select count(*)::int from operations.retention_policy where enabled) "deletionSchedules"`;
  assert.deepEqual(r, {
    definitions: 6540,
    issued: 888,
    approved: 0,
    cards: 0,
    packs: 0,
    accounts: 0,
    receipts: 0,
    closed: 1,
    activeRounds: 0,
    activeFlags: 0,
    deletionSchedules: 0,
  });
  const custody = (await tx.unsafe(custodyQuery))[0].value;
  assert.equal(custody.length, 906);
  assert.equal(
    digest(custody),
    "a1bbdf806cee3f51d870b31f5fcb74d6cae0df93846f34bb4c291ffaae99cb8e",
  );
  assert.deepEqual(
    (await tx.unsafe(commercialPermissionQuery))[0].value,
    expectedCommercialPermissions,
  );
  const [exists] =
    await tx`select to_regnamespace('season_catalogue') is not null present`;
  let pool = null;
  if (exists.present) {
    pool =
      await tx`select sport,count(*)::int members,count(*) filter(where season_catalogue.can_issue(sport,season,player_id,scope))::int eligible from season_catalogue.members group by sport order by sport`;
    assert.deepEqual(
      [...pool],
      [
        { sport: "afl", members: 545, eligible: 545 },
        { sport: "nfl", members: 478, eligible: 478 },
        { sport: "nrl", members: 337, eligible: 337 },
      ],
    );
    const [access] =
      await tx`select count(*)::int n from information_schema.role_table_grants where table_schema='season_catalogue' and grantee in('PUBLIC','anon','authenticated','service_role','docked_app','docked_beta_app','docked_nfl_worker','docked_commercial_app')`;
    assert.equal(access.n, 0);
  }
  return {
    ...r,
    custodyRecords: custody.length,
    custodyDigest: digest(custody),
    pool,
  };
}
async function sums(tx: any, names?: string[]) {
  const all = names ?? (await tx.unsafe(tableListQuery))[0].value;
  const out: Record<string, any> = {};
  for (const table of all) {
    const v = (await tx.unsafe(checksumQuery(table)))[0].value;
    out[table] = { count: v.count, hash: v.hash };
  }
  return out;
}
async function scheduler(tx: any) {
  return {
    bookkeeping: await captureInventoryScheduler(tx),
    rounds: (
      await tx.unsafe(
        "select coalesce(jsonb_agg(to_jsonb(t) order by competition_id),'[]') value from sports_feed.nfl_rounds t",
      )
    )[0].value,
    runs: (
      await tx.unsafe(
        "select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') value from sports_feed.nfl_worker_runs t",
      )
    )[0].value,
  };
}
async function checkDrift(tx: any, before: any, current: any, previous: any) {
  assertOnlyRoundTelemetryChanged(before.rounds, current.rounds);
  for (const r of before.runs)
    assert.deepEqual(
      current.runs.find((n: any) => n.id === r.id),
      r,
      "Existing worker audit changed",
    );
  const oldIds = new Set(before.runs.map((r: any) => r.id));
  for (const r of current.runs.filter((r: any) => !oldIds.has(r.id)))
    assert(
      r.detail?.task === "reconcile" &&
        r.status === "pending-review" &&
        r.finished_at,
      "Unexplained worker change",
    );
  return verifyInventorySchedulerDrift(
    tx,
    before.bookkeeping,
    current.bookkeeping,
    previous,
  );
}
let committed = false;
async function main() {
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    if (mode === "verify") {
      const r = await sql.begin("read only", async (tx) => ({
        verified: true,
        ...(await invariants(tx)),
      }));
      console.log(JSON.stringify(r));
      return;
    }
    if (mode === "preflight") {
      const b = await sql.begin(
        "isolation level repeatable read read only",
        async (tx) => {
          await tx`set local statement_timeout='120s'`;
          await tx.unsafe(blob(p.preflight.file).toString());
          return {
            baseline: await invariants(tx),
            tables: await sums(tx),
            scheduler: await scheduler(tx),
            schema: (await tx.unsafe(v31SchemaFingerprintSql))[0],
            roles:
              await tx`select rolname,rolsuper,rolcanlogin,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname!~'^pg_' order by rolname`,
            memberships:
              await tx`select r.rolname role,m.rolname member,g.rolname grantor,a.admin_option,a.inherit_option,a.set_option from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor order by r.rolname,m.rolname,g.rolname`,
          };
        },
      );
      writePrivate("preflight.private.json", {
        at: new Date().toISOString(),
        ...b,
      });
      writeEvidence("database-preflight.json", {
        at: new Date().toISOString(),
        sourceCommit,
        packageSha256,
        protectedTables: Object.keys(b.tables).length,
        baseline: b.baseline,
        schema: b.schema,
      });
      console.log(
        JSON.stringify({
          preflight: true,
          protectedTables: Object.keys(b.tables).length,
        }),
      );
      return;
    }
    const backup = await authenticateDatabaseBackup({
      manifestPath:
        root + "/private-data/commercial-restore-20261115/manifest.aes",
      archivePath:
        root + "/private-data/commercial-restore-20261115/production.dump.aes",
      keyPath:
        process.env.USERPROFILE +
        "/.docked-secrets/launch-migration-backup-key.hex",
      projectRef: "pojoymtniryarxxunyvz",
      maxAgeMs: 3600000,
    });
    const restored = readJson(
      root +
        "/docs/qa/v31-prelaunch-execution-20261111/database/restore-20261115/restore-only.json",
    );
    assert.equal(restored.restored, true);
    assert.equal(restored.protectedRecordsUnchanged, true);
    assert.equal(restored.archiveSha256, backup.plaintextSha256);
    const before = readJson(privateDir + "/preflight.private.json");
    assert(
      Date.now() - Date.parse(before.at) < 600000,
      "Fresh preflight required",
    );
    const unchanged = [
      "beta_fantasy.editions",
      "beta_fantasy.cards",
      "beta_fantasy.ownership_events",
      "sports_feed.weekly_core_packs",
      "credits_sandbox.state",
      "credits_sandbox.card_instances",
      "credits_sandbox.nba_fixture_instances",
      "commercial_billing.definitions",
      "commercial_billing.cards",
      "commercial_billing.packs",
    ];
    const result = await sql.begin(
      "isolation level repeatable read",
      async (tx) => {
        await tx`set local lock_timeout='3s'`;
        await tx`set local statement_timeout='120s'`;
        await tx.unsafe(blob(p.preflight.file).toString());
        assert.deepEqual(
          (await tx.unsafe(v31SchemaFingerprintSql))[0],
          before.schema,
          "Schema changed after preflight",
        );
        assert.deepEqual(
          [
            ...(await tx`select rolname,rolsuper,rolcanlogin,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname!~'^pg_' order by rolname`),
          ],
          before.roles,
        );
        assert.deepEqual(
          [
            ...(await tx`select r.rolname role,m.rolname member,g.rolname grantor,a.admin_option,a.inherit_option,a.set_option from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor order by r.rolname,m.rolname,g.rolname`),
          ],
          before.memberships,
        );
        const current = await sums(tx);
        assert.deepEqual(Object.keys(current), Object.keys(before.tables));
        for (const t of Object.keys(current))
          if (!schedulerTables.includes(t))
            assert.deepEqual(
              current[t],
              before.tables[t],
              "Unexplained Production drift: " + t,
            );
        const drift = await checkDrift(
          tx,
          before.scheduler,
          await scheduler(tx),
          before.tables,
        );
        const original = await sums(tx, unchanged);
        await tx`select pg_advisory_xact_lock(71820342)`;
        for (const f of p.productionMigrations)
          await tx.unsafe(blob(f.file).toString());
        await tx.unsafe(blob(p.adoption.file).toString());
        for (const f of p.productionMigrations)
          await tx`insert into supabase_migrations.schema_migrations(version,name,statements)values(${f.version},${f.name},${[blob(f.file).toString()]})`;
        await tx`set constraints all immediate`;
        assert.deepEqual(
          await sums(tx, unchanged),
          original,
          "Protected rows changed inside migration",
        );
        return {
          baseline: await invariants(tx),
          drift,
          schemaAfter: (await tx.unsafe(v31SchemaFingerprintSql))[0],
        };
      },
    );
    committed = true;
    writeEvidence("database-applied.json", {
      at: new Date().toISOString(),
      sourceCommit,
      packageSha256,
      committed: true,
      backup,
      ...result,
      existingRowsUnchanged: true,
      newMemberships: 1360,
      heldNflCandidates: 20,
      newSourceCollections: 0,
      commercialWrites: 0,
      newCards: 0,
    });
    const after = await sql.begin(
      "read only",
      async (tx) => await invariants(tx),
    );
    assert.deepEqual(after, result.baseline);
    console.log(
      JSON.stringify({
        applied: true,
        sourceCommit,
        newMemberships: 1360,
        ...after,
      }),
    );
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(JSON.stringify({ stopped: true, committed, error: String(e) }));
  process.exitCode = 1;
});
