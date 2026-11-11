// Exact five migrations + restricted outbox. inspect is read-only; apply needs approval.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createDecipheriv } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  readExactPackage,
  requireV31Approval,
  v31MigrationSql,
} from "./lib/v31-exact-package.mjs";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint.ts";
const mode = process.argv[2];
assert(["inspect", "apply"].includes(mode));
const pack =
  mode === "apply"
    ? requireV31Approval("database-migrations-and-outbox")
    : readExactPackage();
const root = process.cwd(),
  main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const out = "docs/qa/v31-prelaunch-execution-20261111/database";
const key = Buffer.from(
  readFileSync(
    `${process.env.USERPROFILE}/.docked-secrets/launch-migration-backup-key.hex`,
    "utf8",
  ).trim(),
  "hex",
);
assert.match(
  pack.manifest.backupDirectory,
  /^private-data\/commercial-restore-2026\d{4}[a-z]?$/,
);
assert.match(
  pack.manifest.restoreEvidence,
  /^docs\/qa\/v31-prelaunch-execution-20261111\/database\/restore-2026\d{4}[a-z]?$/,
);
const b = readFileSync(`${pack.manifest.backupDirectory}/manifest.aes`);
const d = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
d.setAuthTag(b.subarray(12, 28));
const backup = JSON.parse(
  Buffer.concat([d.update(b.subarray(28)), d.final()]).toString(),
);
key.fill(0);
assert.equal(backup.project, pack.manifest.project);
const restore = JSON.parse(
  readFileSync(`${pack.manifest.restoreEvidence}/restore-drill.json`, "utf8"),
);
const integrity = JSON.parse(
  readFileSync(
    `${pack.manifest.restoreEvidence}/archive-integrity.json`,
    "utf8",
  ),
);
assert(
  restore.restored &&
    restore.migrationsReapplied &&
    restore.protectedRecordsUnchanged &&
    integrity.authenticated &&
    integrity.sha256Matches,
);
assert.equal(restore.archiveSha256, backup.sha256);
assert.equal(pack.manifest.archiveSha256, backup.sha256);
if (mode === "apply")
  assert(
    Date.now() - Date.parse(backup.at) < 24 * 3600_000,
    "Capture and review a fresh backup before applying this expired package",
  );
const names = Object.keys(backup.sums).filter((t) => !t.startsWith('"net".'));
assert.equal(names.length, 550);
assert(names.every((t) => /^"[a-z_0-9]+"\."[a-z_0-9]+"$/.test(t)));
const tableSql = (t, filter = "") =>
  `select jsonb_build_object('table','${t}','count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by md5(to_jsonb(r)::text)),''))) value from ${t} r ${filter}`;
const sums = async (tx, excludeExpected = false) => {
  const result = {};
  for (let i = 0; i < names.length; i += 25) {
    const rows = await tx.unsafe(
      names
        .slice(i, i + 25)
        .map((t) =>
          tableSql(
            t,
            excludeExpected && t === '"private"."feature_flags"'
              ? "where key<>'billing_ops_alerts'"
              : excludeExpected &&
                  t === '"supabase_migrations"."schema_migrations"'
                ? "where version not in ('20261109231834','20261109232000','20261109232124','20261110005726','20261110010050')"
                : "",
          ),
        )
        .join(" union all "),
    );
    for (const r of rows) {
      const { table, ...v } = r.value;
      result[table] = v;
    }
  }
  return result;
};
process.chdir(main);
const sql = ownerDatabase();
process.chdir(root);
try {
  const report = await sql.begin(
    mode === "apply"
      ? "isolation level repeatable read"
      : "isolation level repeatable read read only",
    async (tx) => {
      await tx`set local lock_timeout='3s'`;
      await tx`set local statement_timeout='60s'`;
      const catalogue = (await tx.unsafe(v31SchemaFingerprintSql))[0];
      assert.equal(
        catalogue.fingerprint,
        pack.manifest.sourceCatalogue.fingerprint,
        "Production catalogue drift requires review",
      );
      const normalize = (rows) =>
        rows
          .map((row) =>
            Object.fromEntries(
              Object.entries(row).sort(([a], [b]) => a.localeCompare(b)),
            ),
          )
          .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      const roles =
        await tx`select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls from pg_roles where rolname !~ '^pg_'`;
      const members =
        await tx`select r.rolname role,m.rolname member from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member where r.rolname !~ '^pg_'`;
      assert.deepEqual(
        normalize(roles),
        normalize(backup.roles),
        "Role privilege drift requires review",
      );
      assert.deepEqual(
        normalize(members),
        normalize(backup.members),
        "Role membership drift requires review",
      );
      const gates =
        await tx`select sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled from commercial_billing.control`;
      assert.equal(gates.length, 1);
      assert(Object.values(gates[0]).every((v) => v === false));
      const counts = (
        await tx`select (select count(*) from commercial_billing.definitions)::int definitions,(select count(*) from commercial_billing.cards)::int cards,(select count(*) from commercial_billing.packs)::int packs,(select count(*) from commercial_billing.receipts)::int receipts,(select count(*) from public_gameplay.rounds where enabled)::int enabled_rounds`
      )[0];
      assert(
        Object.values(counts).every((v) => v === 0),
        "Inventory/customer/round state changed; independent approval required",
      );
      assert.equal(
        (
          await tx`select count(*)::int n from supabase_migrations.schema_migrations where version in ('20261109231834','20261109232000','20261109232124','20261110005726','20261110010050')`
        )[0].n,
        0,
      );
      assert.equal(
        (
          await tx`select to_regprocedure('private.billing_ops_window()') is null absent`
        )[0].absent,
        true,
      );
      const before = await sums(tx, true);
      // Mutable auth/worker telemetry may advance. Custody, protected schedules and
      // release controls must still match the reviewed consistent backup exactly.
      for (const t of [
        '"credits_sandbox"."card_instances"',
        '"credits_sandbox"."state"',
        '"credits_sandbox"."nba_fixture_instances"',
        '"credits_sandbox"."nba_fixture_definitions"',
        '"credits_sandbox"."pack_receipts"',
        '"beta_fantasy"."cards"',
        '"beta_fantasy"."ownership_events"',
        '"commercial_billing"."control"',
        '"cron"."job"',
      ])
        assert.deepEqual(
          before[t],
          backup.sums[t],
          `Protected source drift: ${t}`,
        );
      if (mode === "apply") {
        await tx.unsafe(v31MigrationSql(pack.manifest));
        assert.deepEqual(
          await sums(tx, true),
          before,
          "Protected data changed; abort whole transaction",
        );
        assert.equal(
          (
            await tx`select enabled from private.feature_flags where key='billing_ops_alerts'`
          )[0].enabled,
          false,
        );
        assert.equal(
          (await tx`select enabled from operations.retention_policy`)[0]
            .enabled,
          false,
        );
        assert.equal(
          (await tx`select private.billing_ops_window() open`)[0].open,
          false,
        );
        assert.equal(
          (
            await tx`select count(*)::int n from pg_index where indexrelid='auth.docked_verified_phone_canonical'::regclass and indisvalid and indisunique`
          )[0].n,
          1,
        );
      }
      return {
        at: new Date().toISOString(),
        mode,
        packageSha256: pack.digest,
        project: backup.project,
        archiveSha256: backup.sha256,
        catalogue,
        counts,
        protectedTables: names.length,
        protectedRowsUnchanged: mode === "apply" ? true : null,
        protectedRowsCheck:
          mode === "apply"
            ? "before/after transaction"
            : "read-only preflight; transaction comparison not applicable",
        migrationCount: mode === "apply" ? 5 : 0,
        outboxApplied: mode === "apply",
        activation: false,
        productionWrites:
          mode === "apply"
            ? "five migration-history rows, one disabled alert flag, dormant retention policy and reviewed DDL"
            : 0,
      };
    },
  );
  mkdirSync(out, { recursive: true });
  writeFileSync(
    `${out}/${mode}-result.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} catch (error) {
  mkdirSync("private-data/v31-prelaunch-execution-20261111", {
    recursive: true,
  });
  writeFileSync(
    "private-data/v31-prelaunch-execution-20261111/migration-error.private.log",
    String(error?.stack ?? error),
    { mode: 0o600 },
  );
  throw Error(
    "Exact package refused/transaction failed; private diagnostic retained; do not retry with weaker checks",
  );
} finally {
  await sql.end({ timeout: 5 });
}
