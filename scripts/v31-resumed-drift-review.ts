/** Diagnose rejected drift without widening the accepted deployment conditions. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { tableListQuery, checksumQuery } from "./lib/reviewed-inventory";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
import {
  captureSchedulerState,
  reconcileOriginalWarningCorrection,
  schedulerTables,
  driftAuthority,
} from "./lib/v31-resumed-drift";
import { verifyInventorySchedulerDrift } from "./lib/inventory-scheduler-drift";
import { assertOnlyRoundTelemetryChanged } from "./lib/round-backup-compare";
import { digest } from "../src/core/scoring-engine";
import {
  privateDir,
  readJson,
  writePrivate,
  writeEvidence,
  sourceCommit,
  packageSha256,
  packet,
} from "./lib/v31-commercial-approval.mjs";
async function main() {
  driftAuthority();
  const p = packet(),
    before = readJson(privateDir + "/resumed-local-a.private.json");
  const cwd = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(cwd);
  try {
    const result = await sql.begin(
      "isolation level repeatable read read only",
      async (tx: any) => {
        const schema = (await tx.unsafe(v31SchemaFingerprintSql))[0];
        assert.deepEqual(schema, p.baselineProductionSchema);
        const names = (await tx.unsafe(tableListQuery))[0].value;
        assert.deepEqual([...names].sort(), Object.keys(before.tables).sort());
        const tables: any = {};
        for (let i = 0; i < names.length; i += 30)
          for (const r of await tx.unsafe(
            names
              .slice(i, i + 30)
              .map(checksumQuery)
              .join(" union all "),
          )) {
            const { table, ...value } = r.value;
            tables[table] = value;
          }
        const changed = names.filter(
          (t: string) => digest(tables[t]) !== digest(before.tables[t]),
        );
        const unexpectedTables = changed.filter(
          (t: string) =>
            ![
              ...schedulerTables,
              "private.audit_events",
              "credits_sandbox.store_notifications",
            ].includes(t),
        );
        const warning = await reconcileOriginalWarningCorrection(tx, before);
        const current = await captureSchedulerState(tx);
        const immutable = assertOnlyRoundTelemetryChanged(
          before.scheduler.rounds,
          current.rounds,
        );
        for (const r of before.scheduler.runs)
          assert.deepEqual(
            current.runs.find((n: any) => n.id === r.id),
            r,
            "Previous NFL audit changed",
          );
        const last = Math.max(...before.scheduler.runs.map((r: any) => r.id));
        const extra = current.runs.filter((r: any) => r.id > last);
        const outside = extra.filter(
          (r: any) =>
            r.status !== "pending-review" || r.detail?.task !== "reconcile",
        );
        const bookkeeping = await verifyInventorySchedulerDrift(
          tx,
          before.scheduler.bookkeeping,
          current.bookkeeping,
          before.tables,
        );
        const rows = outside.map((r: any) => ({
          id: r.id,
          status: r.status,
          task: r.detail?.task,
          startedAt: r.started_at,
          finishedAt: r.finished_at,
          detailKeys: Object.keys(r.detail).sort(),
          errorCode: r.detail?.error,
          recordSha256: digest(r),
          detailSha256: digest(r.detail),
          priorIdenticalFailures: before.scheduler.runs.filter(
            (old: any) =>
              old.status === r.status &&
              digest(old.detail) === digest(r.detail),
          ).length,
        }));
        const baseline = readJson(
          privateDir + "/database-preflight.private.json",
        );
        const roles = [
          ...(await tx`select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls,rolcanlogin,rolconnlimit from pg_roles where rolname !~ '^pg_' order by rolname`),
        ];
        assert.deepEqual(roles, baseline.roles);
        const memberships = [
          ...(await tx`select r.rolname role,m.rolname member,g.rolname grantor,a.admin_option,a.inherit_option,a.set_option from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor order by r.rolname,m.rolname,g.rolname`),
        ];
        assert.deepEqual(memberships, baseline.memberships);
        const migrations =
          await tx`select version from supabase_migrations.schema_migrations where version in ('20261113002000','20261113003000')`;
        writePrivate("resumed-drift-review.private.json", {
          at: new Date().toISOString(),
          tables,
          outside,
        });
        return {
          at: new Date().toISOString(),
          sourceCommit,
          packageSha256,
          schema,
          unchangedTables: names.length - changed.length,
          changedTables: changed,
          unexpectedTables,
          warning,
          immutableRoundRows: immutable.length,
          immutableRoundDigest: digest(immutable),
          priorNflAuditRowsUnchanged: before.scheduler.runs.length,
          permittedReconcileRows: extra.length - outside.length,
          outsideAllowance: rows,
          bookkeeping,
          rolesAndMembershipsUnchanged: true,
          newMigrationsPresent: migrations.length,
          productionWrites: 0,
          deploymentAllowed: false,
        };
      },
    );
    writeEvidence("resumed-drift-review.json", result);
    console.log(JSON.stringify(result));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  writeFileSync(
    privateDir + "/resumed-drift-review-error.private.txt",
    String(e),
  );
  console.error("Read-only review stopped; private diagnostic retained");
  process.exitCode = 1;
});
