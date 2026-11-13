/** Read-only source-retention diagnosis; never restores or renews source rights. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { digest } from "../src/core/scoring-engine";
import {
  writeEvidence,
  writePrivate,
  readJson,
  privateDir,
  sourceCommit,
  packageSha256,
} from "./lib/v31-commercial-approval.mjs";
const q =
  "select coalesce(jsonb_agg((to_jsonb(t)-'body')||jsonb_build_object('bodyNull',body is null,'bodyMd5',md5(body::text)) order by id),'[]') value from sports_feed.raw_revisions t";
async function main() {
  const original = JSON.parse(
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
  const cwd = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(cwd);
  try {
    const report = await sql.begin(
      "isolation level repeatable read read only",
      async (tx: any) => {
        const current = (await tx.unsafe(q))[0].value;
        assert.equal(current.length, original.length);
        const changed = current.filter(
          (r: any) =>
            digest(r) !== digest(original.find((o: any) => o.id === r.id)),
        );
        const differences = changed.map((r: any) => {
          const old = original.find((o: any) => o.id === r.id);
          assert(old);
          const fields = Object.keys(r).filter(
            (k) => digest(r[k]) !== digest(old[k]),
          );
          return {
            id: r.id,
            provider: r.provider,
            resource: r.resource,
            fields,
            previousBodyPresent: !old.bodyNull,
            currentBodyNull: r.bodyNull,
            expiresAt: r.expires_at,
            purgedAt: r.purged_at,
            expiredBeforePurge:
              r.purged_at &&
              Date.parse(r.expires_at) <= Date.parse(r.purged_at),
            beforeRecordSha256: digest(old),
            afterRecordSha256: digest(r),
          };
        });
        const failures = [
          ...(await tx`select id,status,detail->>'task' task,detail->>'stage' stage,detail->>'diagnostic' diagnostic,started_at::text,finished_at::text from sports_feed.nfl_worker_runs where id in (3388,3389,3390) order by id`),
        ];
        const jobs = [
          ...(await tx`select jobid,jobname,schedule,md5(command) command_hash from cron.job where command ilike '%raw_revision%' or command ilike '%purge%' or command ilike '%retention%' order by jobid`),
        ];
        const baseline = readJson(
          privateDir + "/resumed-drift-review.private.json",
        );
        writePrivate("resumed-source-review.private.json", {
          original,
          current,
          failures,
          jobs,
        });
        return {
          at: new Date().toISOString(),
          sourceCommit,
          packageSha256,
          totalSourceRows: current.length,
          unchangedSourceRows: current.length - changed.length,
          differences,
          failures,
          existingRetentionJobs: jobs,
          originalSourceTableFingerprint: readJson(
            privateDir + "/resumed-local-a.private.json",
          ).tables["sports_feed.raw_revisions"],
          currentSourceTableFingerprint:
            baseline.tables["sports_feed.raw_revisions"],
          productionWrites: 0,
          retentionEnabledByThisSession: false,
          withinApprovedSchedulerAllowance: false,
        };
      },
    );
    writeEvidence("resumed-source-review.json", report);
    console.log(JSON.stringify(report));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(
    "Read-only source review stopped: " +
      String(e.message).split("\n")[0].slice(0, 180),
  );
  process.exitCode = 1;
});
