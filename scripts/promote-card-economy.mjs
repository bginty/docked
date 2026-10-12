import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const d = JSON.parse(
  readFileSync("docs/qa/friends-cutover/deployment-status.json"),
);
const check = JSON.parse(
  readFileSync("docs/qa/android-v21/wallet-candidate.json"),
);
assert.equal(d.id, "dpl_HewS9iMnD3dLNRZLA9sypP236jDJ");
assert.equal(check.passed, true);
assert.equal(check.deployment, d.id);
assert.equal(check.commit, d.commit);
const project = "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
  team = "team_tf6xweKKyVCj9bTppUKttJ4l";
assert.equal(d.project, project);
assert.equal(d.team, team);
const auth = JSON.parse(readFileSync("private-data/vercel-cli/auth.json"));
async function api(path, method = "GET", body) {
  const r = await fetch("https://api.vercel.com" + path + "?teamId=" + team, {
    method,
    headers: {
      Authorization: "Bearer " + auth.token,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  assert.ok(r.ok, "Vercel HTTP " + r.status);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}
const live = await api("/v13/deployments/" + d.id);
assert.equal(live.projectId, project);
assert.equal(live.target, "production");
assert.equal(live.readyState, "READY");
assert.equal(live.meta.githubCommitSha, d.commit);
const p = await api("/v9/projects/" + project);
assert.equal(p.accountId, team);
assert.equal(p.ssoProtection.deploymentType, "all_except_custom_domains");
const domains = await api("/v9/projects/" + project + "/domains");
assert.deepEqual(
  domains.domains
    .filter((x) => !x.name.endsWith(".vercel.app"))
    .map((x) => x.name)
    .sort(),
  ["docked.com.au", "www.docked.com.au"],
);
const before = [];
for (const name of ["docked.com.au", "www.docked.com.au"]) {
  const a = await api("/v4/aliases/" + name);
  before.push({ name, deployment: a.deployment?.id ?? a.deploymentId });
}
writeFileSync(
  "docs/qa/android-v21/rollback.json",
  JSON.stringify(
    { at: new Date().toISOString(), project, team, before },
    null,
    2,
  ) + "\n",
);
await api("/v10/projects/" + project + "/promote/" + d.id, "POST");
console.log(
  JSON.stringify({
    promotionRequested: true,
    deployment: d.id,
    commit: d.commit,
    rollback: before,
  }),
);
