import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { ownerDatabase } from "../../scripts/owner-gameplay-db.mjs";

const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const report = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='30s'`;
        const [mode] =
          await tx`select current_setting('transaction_read_only') read_only,clock_timestamp() observed_at`;
        assert.equal(mode.read_only, "on");
        const coverage =
          await tx`select team,count(*)::int candidates from nfl_roster.refresh_candidates() group by team order by team`;
        const functions =
          await tx`select p.proname,p.provolatile,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='nfl_roster' and p.proname in('refresh_candidates','record_refresh') order by p.proname`;
        const runs =
          await tx`select id,started_at,finished_at,status,detail->>'task' task,detail->>'stage' stage,detail->>'diagnostic' diagnostic,detail#>>'{officialRoster,status}' official_status,
        (select jsonb_agg(x) from jsonb_array_elements(coalesce(detail#>'{officialRoster,teams}','[]'::jsonb)) x where x->>'team' in('ARI','MIA','TEN')) target_outcomes,
        jsonb_array_length(coalesce(detail#>'{officialRoster,teams}','[]'::jsonb)) teams_checked
        from sports_feed.nfl_worker_runs where detail->>'task'='rosters' order by started_at desc limit 12`;
        const jobs =
          await tx`select jobid,jobname,schedule,active,strpos(command,'scoring/collect')>0 node_destination,strpos(command,'nfl-postgame')>0 edge_destination,strpos(command,'task=rosters')>0 roster_task from cron.job where jobname='docked-nfl-rosters'`;
        const history =
          await tx`select d.start_time,d.end_time,d.status from cron.job_run_details d join cron.job j using(jobid) where j.jobname='docked-nfl-rosters' order by d.start_time desc limit 8`;
        const observations =
          await tx`select team,count(*)::int observations,min(checked_at) oldest,max(checked_at) newest,max(checked_at) filter(where status='active' and identity_verified) newest_verified_active from nfl_roster.observations where team in('ARI','MIA','TEN') group by team order by team`;
        return {
          at: new Date(mode.observed_at).toISOString(),
          readOnly: true,
          productionWrites: 0,
          sourceRequests: 0,
          coverage,
          functions,
          runs,
          jobs,
          history,
          observations,
        };
      },
    );
    writeFileSync(
      path.join(
        root,
        "docs/ops-launch-20261105/nfl-pool-omissions/observer-readback.json",
      ),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      JSON.stringify(
        {
          at: report.at,
          readOnly: report.readOnly,
          productionWrites: 0,
          sourceRequests: 0,
          targets: report.coverage.filter((r) =>
            ["ARI", "MIA", "TEN"].includes(r.team),
          ),
          latestRuns: report.runs.slice(0, 4),
          jobs: report.jobs,
          history: report.history,
        },
        null,
        2,
      ),
    );
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(
    e.code ?? e.name,
    e instanceof assert.AssertionError
      ? e.message
      : "Read-only observer inspection failed",
  );
  process.exitCode = 1;
});
