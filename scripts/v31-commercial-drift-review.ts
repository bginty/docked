/** Read-only diagnosis of the stopped deployment; no acceptance inferred. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { tableListQuery, checksumQuery } from "./lib/reviewed-inventory";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
import {
  privateDir,
  writePrivate,
  writeEvidence,
  readJson,
  sourceCommit,
  packageSha256,
} from "./lib/v31-commercial-approval.mjs";
import { digest } from "../src/core/scoring-engine";
const target = "docked-commercial-restore-20261113a";
const local = (q: string) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      target,
      "psql",
      "-h",
      "/restore",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { input: q, windowsHide: true, maxBuffer: 16e6 },
  )
    .toString()
    .trim();
async function main() {
  const before = readJson(privateDir + "/database-preflight.private.json");
  const roundQuery =
    "select coalesce(jsonb_agg(to_jsonb(t) order by competition_id),'[]') value from sports_feed.nfl_rounds t";
  const oldRounds = JSON.parse(local(roundQuery));
  const cwd = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(cwd);
  try {
    const result = await sql.begin(
      "isolation level repeatable read read only",
      async (tx: any) => {
        const tables = (await tx.unsafe(tableListQuery))[0].value,
          sums: Record<string, unknown> = {};
        for (let n = 0; n < tables.length; n += 25)
          for (const r of await tx.unsafe(
            tables
              .slice(n, n + 25)
              .map(checksumQuery)
              .join(" union all "),
          )) {
            const { table, ...s } = r.value;
            sums[table] = s;
          }
        const changed = tables.filter(
          (t: string) => digest(sums[t]) !== digest(before.tables[t]),
        );
        const rounds = (await tx.unsafe(roundQuery))[0].value;
        assert.equal(rounds.length, oldRounds.length);
        const roundChanges = rounds.flatMap((r: any) => {
          const old = oldRounds.find(
            (o: any) => o.competition_id === r.competition_id,
          );
          assert(old);
          const fields = Object.keys(r).filter(
            (k) => digest(r[k]) !== digest(old[k]),
          );
          return fields.length
            ? [
                {
                  recordDigest: digest(r.competition_id),
                  fields,
                  operationalTimestamps: Object.fromEntries(
                    fields
                      .filter((k) =>
                        ["last_checked", "next_check", "lease_until"].includes(
                          k,
                        ),
                      )
                      .map((k) => [k, { before: old[k], after: r[k] }]),
                  ),
                },
              ]
            : [];
        });
        const runs =
          await tx`select started_at,finished_at,status from sports_feed.nfl_worker_runs order by started_at desc limit 5`;
        const migrations =
          await tx`select version from supabase_migrations.schema_migrations where version in ('20261113002000','20261113003000')`;
        writePrivate("drift-review.private.json", {
          at: new Date().toISOString(),
          sums,
          rounds,
          oldRounds,
          runs,
        });
        return {
          at: new Date().toISOString(),
          sourceCommit,
          packageSha256,
          productionWrites: 0,
          schema: (await tx.unsafe(v31SchemaFingerprintSql))[0],
          changedTables: changed.map((table: string) => ({
            table,
            before: before.tables[table],
            after: sums[table],
          })),
          roundChanges,
          newMigrationsPresent: migrations.length,
          runtimeExists:
            (
              await tx`select count(*)::int n from pg_roles where rolname='docked_commercial_runtime'`
            )[0].n !== 0,
        };
      },
    );
    writeEvidence("deployment-drift-review.json", result);
    console.log(JSON.stringify(result));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(
    "Read-only drift review failed: " + String(e.message).slice(0, 200),
  );
  process.exitCode = 1;
});
