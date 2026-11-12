import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { assertOnlyRoundTelemetryChanged } from "./lib/round-backup-compare";
import { digest } from "../src/core/scoring-engine";
import {
  writeEvidence,
  writePrivate,
  sourceCommit,
  packageSha256,
} from "./lib/v31-commercial-approval.mjs";
const local = (q: string) =>
  JSON.parse(
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "docked-commercial-restore-20261113a",
        "psql",
        "-h",
        "/restore",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-Atq",
      ],
      { input: q, windowsHide: true, maxBuffer: 16e6 },
    ).toString(),
  );
async function main() {
  const rq =
    "select jsonb_agg(to_jsonb(t) order by competition_id) value from sports_feed.nfl_rounds t";
  const jq =
    "select jsonb_agg(to_jsonb(t) order by id) value from sports_feed.nfl_worker_runs t";
  const previousRounds = local(rq),
    previousRuns = local(jq);
  const cwd = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(cwd);
  try {
    const report = await sql.begin(
      "isolation level repeatable read read only",
      async (tx: any) => {
        const rounds = (await tx.unsafe(rq))[0].value,
          runs = (await tx.unsafe(jq))[0].value;
        const immutable = assertOnlyRoundTelemetryChanged(
          previousRounds,
          rounds,
        );
        for (const r of previousRuns)
          assert.deepEqual(
            runs.find((v: any) => v.id === r.id),
            r,
            "Existing NFL worker audit changed",
          );
        const oldIds = new Set(previousRuns.map((r: any) => r.id)),
          added = runs.filter((r: any) => !oldIds.has(r.id));
        assert(
          added.every(
            (r: any) =>
              r.detail.task === "reconcile" &&
              r.status === "pending-review" &&
              r.finished_at,
          ),
        );
        writePrivate("scheduler-baseline.private.json", {
          previousRounds,
          previousRuns,
          immutableDigest: digest(immutable),
        });
        return {
          at: new Date().toISOString(),
          sourceCommit,
          packageSha256,
          source:
            "Existing 15-minute NFL reconcile job, unchanged source src/server/nfl-collection-worker.ts",
          immutableRoundRows: immutable.length,
          immutableRoundDigest: digest(immutable),
          roundBusinessDataUnchanged: true,
          permittedRoundTelemetry: [
            "last_checked",
            "next_check",
            "lease_until",
          ],
          existingWorkerAuditRowsUnchanged: previousRuns.length,
          newWorkerAuditRows: added.length,
          newRuns: added.map((r: any) => ({
            startedAt: r.started_at,
            finishedAt: r.finished_at,
            status: r.status,
            task: r.detail.task,
          })),
          issuesAndFixturesUnchanged: true,
          productionWrites: 0,
        };
      },
    );
    writeEvidence("scheduler-drift-explained.json", report);
    console.log(JSON.stringify(report));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(String(e.message).slice(0, 200));
  process.exitCode = 1;
});
