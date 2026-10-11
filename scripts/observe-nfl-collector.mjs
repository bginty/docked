// Read-only observation: never invokes a download or resets a lease/cooldown.
import { mkdirSync, writeFileSync } from "node:fs";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import { collectorReleaseEvidence } from "./collector-release-evidence.mjs";
const sql = ownerDatabase();
try {
  const report = {
    at: new Date().toISOString(),
    projectRef,
    readOnly: true,
    jobs: await sql`select jobname,schedule,active from cron.job where jobname like 'docked-nfl-%' order by jobname`,
    scheduledRuns:
      await sql`select j.jobname,d.status,d.start_time,d.end_time from cron.job j cross join lateral (select status,start_time,end_time from cron.job_run_details where jobid=j.jobid and start_time>clock_timestamp()-interval '24 hours' order by start_time desc limit 6) d where j.jobname like 'docked-nfl-%' order by d.start_time desc`,
    httpResponses:
      // Filter and whitelist locally: response bodies may contain unrelated private
      // service data. Never write or print those bodies or headers.
      (
        await sql`select id,status_code,timed_out,created,content from net._http_response where created>clock_timestamp()-interval '24 hours' order by created desc limit 400`
      ).flatMap((r) => {
        try {
          const body = JSON.parse(r.content);
          if (
            !["weekly", "pbp", "rosters", "reconcile"].includes(body.task) ||
            body.season !== 2026
          )
            return [];
          return [
            {
              id: r.id,
              status_code: r.status_code,
              timed_out: r.timed_out,
              created: r.created,
              task: body.task,
              season: body.season,
              outcome: body.status,
              rawId: body.rawId ?? null,
            },
          ];
        } catch {
          return [];
        }
      }),
    workerRuns:
      await sql`select started_at,finished_at,status,detail from sports_feed.nfl_worker_runs where started_at>clock_timestamp()-interval '24 hours' order by started_at desc limit 200`,
    sources:
      await sql`select r.body->>'dataset' dataset,c.checked_at,c.next_attempt,c.error_code,r.id raw_revision,r.body_hash,r.observed_at,r.expires_at from sports_feed.postgame_cache c left join sports_feed.raw_revisions r on r.id=c.raw_id order by c.resource`,
    memberRounds:
      await sql`select stream_id,locked_at,last_checked,next_check,issues from sports_feed.nfl_rounds where purpose='member'`,
    interpretation:
      "Cron submission, HTTP completion and task result are separate evidence. idle/cooldown is not a source retrieval. downloaded/not-modified after the due time demonstrates source access, not a completed future member round. Do not fabricate finalisation.",
  };
  report.collectionAcceptance = collectorReleaseEvidence(report);
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
        collectionAcceptance: report.collectionAcceptance,
      },
      null,
      2,
    ),
  );
} finally {
  await sql.end();
}
