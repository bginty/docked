/** SELECT profiling of a disconnected restored snapshot, always rolled back. No schema or product changes. */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
const target = "docked-commercial-restore-20261115m";
const cfg = JSON.parse(
  execFileSync("docker", ["inspect", target], { windowsHide: true }),
)[0];
assert.equal(cfg.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(cfg.HostConfig.PortBindings ?? {}).length, 0);
const out = "docs/qa/overnight-audit-20261115/restored-read-profile.json";
const args = [
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
  "-At",
  "-v",
  "ON_ERROR_STOP=1",
];
// Eligibility SELECTs use FOR SHARE. READ ONLY disallows those locks; a normal
// transaction retains the genuine guards and is rolled back after every SELECT.
const pre = `begin;set local statement_timeout='60s';
do $identity$ declare u uuid;s uuid;begin
select a.user_id into u from credits_sandbox.access a where a.kind='owner' and a.enabled limit 1;
select id into s from auth.sessions where user_id=u and aal='aal2' order by updated_at desc limit 1;
if u is null or s is null then raise exception 'Restored founder fixture unavailable';end if;
perform set_config('request.jwt.claim.sub',u::text,true);
perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'aal','aal2','session_id',s)::text,true);
perform set_config('docked.nba_private_beta','enabled',true);
perform set_config('docked.multi_sport','isolated-preview',true);
perform set_config('docked.private_beta_sport','nfl',true);
perform set_config('docked.sports_private_beta','enabled',true);
perform set_config('docked.fixture_commerce','enabled',true);
perform set_config('docked.fantasy_channel',beta_fantasy.production_channel(),true);
perform set_config('docked.fantasy_production','pojoymtniryarxxunyvz',true);
end $identity$;set local role docked_beta_app;`;
const queries = {
  review: "select sports_feed.member_review_context()",
  fantasy: "select beta_fantasy.production_read_state()",
  jerseys:
    "select c.*,j.verified_jersey_number from credits_sandbox.current_player_status c left join credits_sandbox.current_player_jerseys j on j.id=c.id",
  wallet: "select revision,document from credits_sandbox.state where id",
};
const reports = [];
for (const [name, sql] of Object.entries(queries))
  for (let repeat = 1; repeat <= 2; repeat++) {
    const run = spawnSync("docker", args, {
      input:
        pre + "\nEXPLAIN(ANALYZE,BUFFERS,FORMAT JSON) " + sql + ";rollback;",
      encoding: "utf8",
      windowsHide: true,
      timeout: 90000,
      maxBuffer: 10e6,
    });
    if (run.status !== 0) {
      reports.push({
        name,
        repeat,
        status: "failed",
        error: run.stderr.replace(
          /[0-9a-f]{8}-[0-9a-f-]{27,}/gi,
          "[redacted-id]",
        ),
      });
    } else {
      const plan = JSON.parse(run.stdout)[0];
      reports.push({
        name,
        repeat,
        status: "passed",
        executionMs: plan["Execution Time"],
        planningMs: plan["Planning Time"],
        plan: plan.Plan,
      });
    }
    fs.writeFileSync(
      out,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          environment:
            "Disconnected restored PostgreSQL snapshot; SELECT-only queries with eligibility locks, each transaction rolled back; not Production or network latency",
          snapshot: "2026-11-15 11:08 UTC, before Brenton migration",
          productionWrites: 0,
          productChanges: 0,
          cacheStateControlled: false,
          reports,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      JSON.stringify(reports.at(-1), (k, v) => (k === "plan" ? undefined : v)),
    );
  }
