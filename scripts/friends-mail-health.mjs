// Read-only release evidence. Does not enqueue mail or trigger collector jobs.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const db = ownerDatabase();
try {
  const health = (await db`select private.docked_mail_health() health`)[0]
    .health;
  const runs =
    await db`select status,start_time,end_time from cron.job_run_details where jobid in (select jobid from cron.job where jobname='docked-auth-mail-drain') order by start_time desc limit 3`;
  const evidence = {
    at: new Date().toISOString(),
    health,
    runs,
    scope:
      "Scheduled idle mail cleanup observed; not a new email delivery or sports collection",
  };
  writeFileSync(
    "docs/qa/friends-cutover/mail-idle-health.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  assert.equal(health.enabled, true);
  assert.equal(health.stale_tick, false);
  assert.equal(health.pending, 0);
  assert.equal(health.last_error_code, null);
  assert.ok(runs.length && runs.every((r) => r.status === "succeeded"));
  console.log(JSON.stringify(evidence));
} finally {
  await db.end();
}
