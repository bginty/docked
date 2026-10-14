// Exact reviewed candidate only; domain promotion, no business transactions.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
const root = "docs/qa/marketplace-release";
const d = JSON.parse(
  readFileSync("docs/qa/friends-cutover/deployment-status.json"),
);
const candidate = JSON.parse(readFileSync(root + "/candidate.json"));
const decision = JSON.parse(readFileSync(root + "/decision.json"));
const migration = JSON.parse(readFileSync(root + "/migration-applied.json"));
assert.equal(candidate.passed, true);
assert.equal(candidate.deployment, d.id);
assert.equal(decision.decision, "RELEASE");
assert.equal(decision.commit, d.commit);
assert.equal(migration.commit, d.commit);
const project = "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
  team = "team_tf6xweKKyVCj9bTppUKttJ4l";
const auth = JSON.parse(readFileSync("private-data/vercel-cli/auth.json"));
async function api(path, method = "GET") {
  const r = await fetch("https://api.vercel.com" + path + "?teamId=" + team, {
    method,
    headers: { Authorization: "Bearer " + auth.token },
    signal: AbortSignal.timeout(30000),
  });
  assert.ok(r.ok, "Vercel HTTP " + r.status);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const deployment = await api("/v13/deployments/" + d.id);
assert.equal(deployment.projectId, project);
assert.equal(deployment.readyState, "READY");
assert.equal(deployment.meta.githubCommitSha, d.commit);
const p = await api("/v9/projects/" + project);
assert.equal(p.accountId, team);
assert.equal(p.ssoProtection.deploymentType, "all_except_custom_domains");
const before = [];
for (const name of ["docked.com.au", "www.docked.com.au"]) {
  const a = await api("/v4/aliases/" + name);
  assert.equal(a.projectId, project);
  before.push({ name, deployment: a.deployment?.id ?? a.deploymentId });
}
assert.ok(
  before.every((a) => a.deployment === "dpl_7WLNn8tA9Wdzz2ZJympK9CroCgba"),
  "Live target changed; review before promotion",
);
writeFileSync(
  root + "/rollback.json",
  JSON.stringify(
    { at: new Date().toISOString(), project, team, before },
    null,
    2,
  ),
);
await api("/v10/projects/" + project + "/promote/" + d.id, "POST");
console.log(
  JSON.stringify({
    promotionRequested: true,
    deployment: d.id,
    commit: d.commit,
  }),
);
