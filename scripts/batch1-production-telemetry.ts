/** Independently reconcile scheduler bookkeeping with the fresh isolated backup. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const target = "docked-commercial-restore-20261116c";
const config = JSON.parse(
  execFileSync("docker", ["inspect", target], { windowsHide: true }).toString(),
)[0];
assert.equal(config.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(config.HostConfig.PortBindings ?? {}).length, 0);
const local = (q: string) =>
  JSON.parse(
    execFileSync(
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
      { input: q, encoding: "utf8", windowsHide: true, maxBuffer: 2e6 },
    ),
  );
const fingerprint = (table: string, key: string, maximum?: string) =>
  `select jsonb_build_object('rows',count(*),'maximum',max(${key})::text,'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) value from ${table} t ${maximum ? `where ${key}<='${maximum.replaceAll("'", "''")}'` : ""}`;
const entries = [
  { table: "cron.job_run_details", key: "runid" },
  { table: "sports_feed.weekly_core_job_runs", key: "started_at" },
];
const baseline = entries.map((e) => ({
  ...e,
  value: local(fingerprint(e.table, e.key)),
}));
const mailSql = `select jsonb_build_object('immutable',md5((to_jsonb(t)-'last_tick_at')::text),'lastTick',last_tick_at) value from private.docked_mail_scheduler t`;
const mail = local(mailSql);
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const report = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='60s'`;
        for (const e of baseline) {
          assert.match(
            e.value.maximum,
            e.key === "runid" ? /^\d+$/ : /^2026-\d\d-\d\d[ T][\d:.+ -]+$/,
          );
          const now = (
            await tx.unsafe(fingerprint(e.table, e.key, e.value.maximum))
          )[0].value;
          assert.deepEqual(
            now,
            e.value,
            "Previously captured scheduler rows changed",
          );
        }
        const now = (await tx.unsafe(mailSql))[0].value;
        assert.equal(now.immutable, mail.immutable);
        assert(Date.parse(now.lastTick) >= Date.parse(mail.lastTick));
        assert(Date.parse(now.lastTick) <= Date.now() + 60000);
        const newCron =
          await tx`select r.status,count(*)::int rows,count(*)filter(where j.jobid is null or r.command is distinct from j.command or r.database is distinct from j.database or r.username is distinct from j.username)::int command_mismatches from cron.job_run_details r left join cron.job j using(jobid) where r.runid>${baseline[0].value.maximum}::bigint group by 1 order by 1`;
        assert(
          newCron.every(
            (r) =>
              [
                "succeeded",
                "running",
                "starting",
                "connecting",
                "sending",
              ].includes(r.status) && r.command_mismatches === 0,
          ),
          "Unexpected scheduler failure or changed command",
        );
        const weekly =
          await tx`select status,issued,failures,count(*)::int rows from sports_feed.weekly_core_job_runs where started_at>${baseline[1].value.maximum}::timestamptz group by 1,2,3 order by 1,2,3`;
        assert(
          weekly.every(
            (r) => Number(r.issued) === 0 && Number(r.failures) === 0,
          ),
          "New issuance or failures require reconciliation",
        );
        return {
          previousRowsUnchanged: baseline.map((e) => ({
            table: e.table,
            rows: e.value.rows,
            maximum: e.value.maximum,
          })),
          newCron,
          weekly,
          mailOnlyLastTickAdvanced: true,
        };
      },
    );
    const result = {
      at: new Date().toISOString(),
      freshBackup: "restore-20261116c",
      ...report,
      productionWrites: 0,
    };
    writeFileSync(
      "docs/qa/batch1-production-execution-20261116/scheduler-reconciliation.json",
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify(result));
  } finally {
    await sql.end({ timeout: 3 });
  }
}
main().catch((e) => {
  console.error(
    "Scheduler reconciliation stopped",
    e instanceof assert.AssertionError
      ? e.message.split("\n")[0]
      : (e.code ?? "UNAVAILABLE"),
  );
  process.exitCode = 1;
});
