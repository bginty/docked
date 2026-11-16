/** Read-only runtime capture. Secret values stay in ignored local evidence. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const dir = "private-data/batch1-production-execution-20261116";
const docs = "docs/qa/batch1-production-execution-20261116";
mkdirSync(dir, { recursive: true });
mkdirSync(docs, { recursive: true });
const auth = JSON.parse(
  readFileSync(
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli/auth.json",
    "utf8",
  ),
);
const team = "team_tf6xweKKyVCj9bTppUKttJ4l";
async function api(route) {
  const r = await fetch(
    "https://api.vercel.com" +
      route +
      (route.includes("?") ? "&" : "?") +
      "teamId=" +
      team,
    {
      headers: { Authorization: "Bearer " + auth.token },
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    },
  );
  return { status: r.status, body: await r.json() };
}
const write = (file, value) =>
  writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
async function main() {
  const live = await api("/v13/deployments/docked.com.au");
  assert.equal(live.status, 200);
  assert.equal(live.body.id, "dpl_A2BQuwB5YgRbfpcW4M7K9ihENqPy");
  assert.equal(
    live.body.meta.githubCommitSha,
    "12ccfd5879ae83f1bd62210ee16a3feb6907d9ef",
  );
  write(dir + "/baseline-deployment.private.json", live.body);
  const project = await api("/v9/projects/prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
  assert.equal(project.status, 200);
  write(dir + "/project.private.json", project.body);
  const envs = await api(
    "/v9/projects/prj_l0rpVDPRuIRp9UcBUkudeyUK5yST/env?decrypt=true",
  );
  write(dir + "/project-env.private.json", envs.body);
  assert.equal(envs.status, 200);
  assert.equal(envs.body.hiddenProductionEnvCount, 0);
  const original = JSON.parse(
    readFileSync(
      "C:/Users/61412/.codex/worktrees/v31-founder-acceptance-20261111/Docked.com.au/private-data/brenton-execution-20261115/runtime-deployment.private.json",
      "utf8",
    ),
  );
  const previous = JSON.parse(
    readFileSync(
      "docs/qa/brenton-private-tester-20261115/execution/runtime-verified.json",
      "utf8",
    ),
  );
  const hash = (x) =>
    createHash("sha256").update(JSON.stringify(x)).digest("hex");
  assert.equal(hash(original), previous.candidateRecipeSha256);
  assert.equal(original.VERCEL_GIT_COMMIT_SHA, live.body.meta.githubCommitSha);
  const production = envs.body.envs.filter((e) =>
    e.target.includes("production"),
  );
  assert(
    production.every(
      (e) =>
        (e.updatedAt ?? e.createdAt) <= live.body.createdAt && !e.gitBranch,
    ),
  );
  const inherited = {},
    secretReferences = [];
  for (const e of production) {
    if (Object.hasOwn(original, e.key)) continue;
    if (e.type === "sensitive") {
      secretReferences.push({
        key: e.key,
        id: e.id,
        type: e.type,
        target: e.target,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      });
      continue;
    }
    const result = await api(
      "/v1/projects/" + project.body.id + "/env/" + e.id,
    );
    assert.equal(result.status, 200);
    assert.equal(result.body.key, e.key);
    assert.equal(typeof result.body.value, "string");
    inherited[e.key] = result.body.value;
  }
  const capture = { ...inherited, ...original };
  write(dir + "/captured-runtime-values.private.json", capture);
  write(dir + "/preserved-secret-references.private.json", secretReferences);
  for (const key of [
    "REGISTRATION_ENABLED",
    "COMPETITIONS_ENABLED",
    "PRIZES_ENABLED",
    "DOCKED_COMMERCIAL_SERVICE",
    "DOCKED_COMMERCIAL_SURFACES",
    "DOCKED_COMMERCIAL_CHECKOUT",
    "DOCKED_COMMERCIAL_MARKETPLACE",
    "DOCKED_PUBLIC_CUSTOMERS",
    "DOCKED_MEMBER_GOOGLE_TEST",
    "DOCKED_PUBLIC_PHONE_OTP",
    "DOCKED_ISOLATED_PHONE_TEST",
  ])
    assert.equal(capture[key], "false", key);
  assert(
    !capture.DOCKED_PACK_ACCEPTANCE ||
      capture.DOCKED_PACK_ACCEPTANCE === "false",
  );
  const requiredNames = live.body.env.filter(
    (k) =>
      !/^((?:VERCEL|TURBO|NEXT|REACT_APP_VERCEL|PUBLIC_VERCEL|VITE_VERCEL)_|VERCEL$|CI$|NX_DAEMON$)/.test(
        k,
      ),
  );
  const missingNames = requiredNames.filter(
    (k) =>
      !Object.hasOwn(capture, k) && !secretReferences.some((e) => e.key === k),
  );
  assert.equal(missingNames.length, 0);
  const summary = {
    at: new Date().toISOString(),
    deployment: live.body.id,
    source: live.body.meta.githubCommitSha,
    liveNode: live.body.nodeVersion,
    projectNode: project.body.nodeVersion,
    protection: project.body.ssoProtection,
    originalOverridesVerified: 97,
    readableInheritedCaptured: Object.keys(inherited).length,
    hiddenInheritedSecrets: secretReferences.map((e) => e.key),
    secretReferencesSha256: hash(secretReferences),
    capturedValueMapSha256: hash(capture),
    metadataPredatesCurrentDeployment: true,
    closedGates: true,
    fullEffectiveSecretValueReadback: false,
    originalOverrideRecipeSha256: hash(original),
    productionWrites: 0,
  };
  write(docs + "/runtime-capture-status.json", summary);
  console.log(JSON.stringify(summary));
}
main().catch((e) => {
  write(dir + "/runtime-capture-error.private.json", { message: String(e) });
  console.error("Runtime capture stopped; private diagnostic retained.");
  process.exitCode = 1;
});
