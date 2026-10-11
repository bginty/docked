// Read-only observation: never invokes a download or resets a lease/cooldown.
import { mkdirSync, writeFileSync } from "node:fs";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const sql = ownerDatabase();
try {
  const report = {
    at: new Date().toISOString(),
    projectRef,
    readOnly: true,
    jobs: await sql`select jobname,schedule,active from cron.job where jobname like 'docked-nfl-%' order by jobname`,
    scheduledRuns:
      await sql`select j.jobname,d.status,d.start_time,d.end_time from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname like 'docked-nfl-%' and d.start_time>clock_timestamp()-interval '24 hours' order by d.start_time desc limit 30`,
    httpResponses:
      await sql`select id,status_code,timed_out,created from net._http_response order by created desc limit 20`,
    workerRuns:
      await sql`select started_at,finished_at,status,detail from sports_feed.nfl_worker_runs order by started_at desc limit 30`,
    sources:
      await sql`select r.body->>'dataset' dataset,c.checked_at,c.next_attempt,c.error_code,r.id raw_revision,r.body_hash,r.observed_at,r.expires_at from sports_feed.postgame_cache c left join sports_feed.raw_revisions r on r.id=c.raw_id order by c.resource`,
    memberRounds:
      await sql`select stream_id,locked_at,last_checked,next_check,issues from sports_feed.nfl_rounds where purpose='member'`,
    interpretation:
      "Cron submission, HTTP completion and task result are separate evidence. idle/cooldown is not a source retrieval. downloaded/not-modified after the due time demonstrates source access, not a completed future member round. Do not fabricate finalisation.",
  };
  mkdirSync("docs/qa/friends-cutover", { recursive: true });
  writeFileSync(
    "docs/qa/friends-cutover/collector-observation.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        at: report.at,
        latest: report.workerRuns[0],
        sources: report.sources,
        memberRounds: report.memberRounds,
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end();
}
