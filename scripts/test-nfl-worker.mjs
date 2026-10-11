import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const url =
  "https://pojoymtniryarxxunyvz.supabase.co/functions/v1/nfl-postgame";
const { token } = JSON.parse(
  readFileSync("private-data/nfl-worker/secrets.json", "utf8"),
);
const { anon } = JSON.parse(
  readFileSync("private-data/nfl-worker/anon.json", "utf8"),
);
const unauth = await fetch(url + "?task=weekly", { method: "POST" });
assert.equal(unauth.status, 401);
const denied = await fetch(url + "?task=weekly", {
  method: "POST",
  headers: { Authorization: "Bearer " + anon },
});
assert.equal(denied.status, 403);
const report = {
  at: new Date().toISOString(),
  unauthorised: unauth.status,
  missingWorkerToken: denied.status,
  tasks: [],
};
for (const task of ["weekly", "pbp", "rosters", "reconcile"]) {
  const r = await fetch(url + "?task=" + task, {
    method: "POST",
    headers: { Authorization: "Bearer " + anon, "x-docked-worker": token },
    signal: AbortSignal.timeout(145000),
  });
  const body = await r.text();
  report.tasks.push({ task, status: r.status, body });
}
writeFileSync(
  "docs/qa/nfl-member/worker-hosted.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(report);
if (report.tasks.some((t) => t.status !== 200)) process.exitCode = 1;
