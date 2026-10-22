import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const dir = "docs/qa/multi-sport/nba-acceptance/";
const saved = JSON.parse(
  await readFile(dir + "deployment-submitted.json", "utf8"),
);
assert.equal(saved.projectId, "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR");
const auth = JSON.parse(
  await readFile(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli/auth.json",
    "utf8",
  ),
);
const r = await fetch(
  "https://api.vercel.com/v13/deployments/" +
    new URL(saved.url).hostname +
    "?teamId=team_tf6xweKKyVCj9bTppUKttJ4l",
  {
    headers: { Authorization: "Bearer " + auth.token },
    signal: AbortSignal.timeout(30000),
  },
);
assert.equal(r.status, 200);
const d = await r.json();
assert.equal(d.projectId, saved.projectId);
assert.equal(d.target, null);
assert.equal(d.meta.dockedSourceCommit, saved.commit);
const report = {
  ...saved,
  id: d.id,
  state: d.readyState,
  checkedAt: new Date().toISOString(),
  production: false,
};
await writeFile(
  dir + "deployment-status.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
