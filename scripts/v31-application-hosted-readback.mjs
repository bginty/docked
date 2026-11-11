// Read-only HTTP/deployment verification. No member session, SMS or business mutation.
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";

const sha = "60f9e66acecaa9ce6419ad07e2691b777400a3d4";
const deploymentId = "dpl_8QNLMcxa9ZBospuZk4pCnH2zjqkV";
const project = "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST";
const team = "team_tf6xweKKyVCj9bTppUKttJ4l";
const evidence = "docs/qa/v31-prelaunch-execution-20261111/backend";
const privateDir = path.resolve("private-data/nba-production/" + sha);
const receipt = JSON.parse(
  await fs.readFile(evidence + "/deployment-submitted.json", "utf8"),
);
assert.equal(receipt.commit, sha);
assert.equal(receipt.projectId, project);
const live = process.argv.includes("--live");
const target = live ? "https://docked.com.au" : receipt.url;
const authDir =
  "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli";
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const auth = JSON.parse(await fs.readFile(authDir + "/auth.json", "utf8"));
async function inspect(host) {
  const r = await fetch(
    "https://api.vercel.com/v13/deployments/" + host + "?teamId=" + team,
    {
      headers: { Authorization: "Bearer " + auth.token },
      signal: AbortSignal.timeout(30000),
    },
  );
  assert(r.ok, "Deployment inspection HTTP " + r.status);
  return r.json();
}
const deployment = await inspect(new URL(target).hostname);
assert.equal(deployment.id, deploymentId);
assert.equal(deployment.readyState, "READY");
assert.equal(deployment.meta.githubCommitSha, sha);
assert.equal(deployment.projectId, project);
const runtime = JSON.parse(
  await fs.readFile(privateDir + "/runtime.private.json", "utf8"),
);
const baseline = JSON.parse(
  await fs.readFile(privateDir + "/baseline.private.json", "utf8"),
);
const originalRuntime = JSON.parse(
  await fs.readFile(
    "C:/Users/61412/.codex/worktrees/scoring-pack-refinement/Docked.com.au/private-data/scoring-pack-refinement-release/f1b50b6f51d7429a36df9a8d5db99aed8886bd44/runtime.private.json",
    "utf8",
  ),
);
assert.equal(
  createHash("sha256").update(JSON.stringify(originalRuntime)).digest("hex"),
  "893b568f0f3e4b142cd5bff0bdaa5255d237388e7277ff0fabe0b498df5f1501",
);
for (const [key, value] of Object.entries(originalRuntime)) {
  if (["VERCEL_GIT_COMMIT_SHA", "VERCEL_GIT_COMMIT_REF"].includes(key))
    continue;
  assert.equal(runtime[key], value, "Changed baseline setting: " + key);
}
assert.equal(runtime.VERCEL_GIT_COMMIT_SHA, sha);
for (const key of [
  "REGISTRATION_ENABLED",
  "COMPETITIONS_ENABLED",
  "PRIZES_ENABLED",
  "DOCKED_COMMERCIAL_SERVICE",
  "DOCKED_COMMERCIAL_SURFACES",
  "DOCKED_COMMERCIAL_CHECKOUT",
  "DOCKED_PUBLIC_CUSTOMERS",
  "DOCKED_MEMBER_GOOGLE_TEST",
  "DOCKED_MULTI_SPORT_SANDBOX",
  "DOCKED_PUBLIC_PHONE_OTP",
  "DOCKED_ISOLATED_PHONE_TEST",
])
  assert.equal(runtime[key], "false", key);
for (const key of Object.keys(runtime))
  assert(
    deployment.env.includes(key),
    "Missing deployment environment key: " + key,
  );
assert.deepEqual(deployment.crons, baseline.crons);
if (!live)
  assert.equal(
    (await inspect("docked.com.au")).id,
    "dpl_9bwmvDvt5AEszaBtR311MjHLpHg7",
    "Live baseline changed before promotion",
  );
const cases = [
  ["/api/beta-release", 200],
  ["/app/login", 200],
  ["/app/signup", 200],
  ["/app/invitation-setup", 200],
  ["/privacy", 200],
  ["/refund-policy", 200],
  ["/commercial-policy", 200],
  ["/retention", 200],
  ["/account-deletion", 200],
  ["/api/store/google/commercial", 403],
  ["/api/workspace-wallet", 403],
  ["/api/mobile/capabilities", 401],
  ...["nfl", "afl", "nrl", "basketball"].map((s) => [
    "/api/public-gameplay?sport=" + s,
    403,
  ]),
  ...["nfl", "afl", "nrl", "basketball"].map((s) => [
    "/api/fantasy/scoring-history?sport=" + s,
    s === "basketball" ? 400 : 401,
  ]),
  ["/profile/qa_billing", 503],
  ["/preview/pack-opening", 404],
  ["/api/admin/incidents", 403],
  ["/admin/incidents", 200],
  ["/api/admin/incidents", 403, "POST"],
  ["/api/auth/phone", 403, "POST"],
];
async function read(route, method = "GET") {
  if (live) {
    const r = await fetch(target + route, {
      method,
      redirect: "manual",
      signal: AbortSignal.timeout(45000),
      ...(method === "POST"
        ? {
            headers: {
              Origin: "https://invalid.example",
              "Content-Type": "application/json",
            },
            body: "{}",
          }
        : {}),
    });
    return {
      status: r.status,
      body: await r.text(),
      headers: Object.fromEntries(r.headers),
    };
  }
  const args = [
    cli,
    "curl",
    route,
    "--deployment",
    target,
    "--",
    "--silent",
    "--show-error",
    "--include",
    "--max-time",
    "45",
    "--write-out",
    "\nDOCKED_STATUS:%{http_code}",
  ];
  if (method === "POST")
    args.push(
      "--request",
      "POST",
      "--header",
      "Origin: https://invalid.example",
      "--header",
      "Content-Type: application/json",
      "--data",
      "{}",
    );
  const { stdout } = await promisify(execFile)(process.execPath, args, {
    cwd: privateDir + "/source",
    env: { ...process.env, VERCEL_TOKEN: auth.token },
    windowsHide: true,
    timeout: 55000,
    maxBuffer: 6e6,
  });
  return {
    status: Number(stdout.match(/DOCKED_STATUS:(\d+)/)?.[1]),
    body: stdout,
    headers: {},
  };
}
const checks = [];
let cursor = 0;
await Promise.all(
  Array.from({ length: 3 }, async () => {
    while (cursor < cases.length) {
      const [route, expected, method = "GET"] = cases[cursor++];
      const r = await read(route, method);
      assert.equal(r.status, expected, method + " " + route);
      const header = (k) =>
        r.headers[k] ??
        r.body.match(new RegExp(k + ":\\s*([^\\r\\n]+)", "i"))?.[1] ??
        "";
      if (route === "/api/beta-release") {
        assert(r.body.includes(sha));
        assert(r.body.includes('"publicRegistration":false'));
      }
      if (route === "/app/login") assert(r.body.includes("Welcome back"));
      if (route === "/app/invitation-setup")
        assert(r.body.includes("Log in to an existing account"));
      if (route === "/privacy")
        assert(r.body.includes(runtime.DOCKED_PUBLIC_PRIVACY_VERSION));
      if (route === "/profile/qa_billing")
        assert(r.body.includes("isolated test connection is closed"));
      if (route.startsWith("/api/fantasy/scoring-history")) {
        assert(header("cache-control").includes("no-store"));
        assert(header("cache-control").includes("private"));
        assert(r.body.includes("Scoring history is unavailable"));
      }
      if (route === "/api/admin/incidents") {
        assert(header("cache-control").includes("no-store"));
        assert(header("x-content-type-options").includes("nosniff"));
        assert(r.body.includes("Incident review unavailable"));
      }
      if (route === "/api/auth/phone") assert(r.body.includes("Origin denied"));
      checks.push({ method, route, status: r.status, pass: true });
    }
  }),
);
const report = {
  at: new Date().toISOString(),
  source: sha,
  package: "a3b61f2c9a17d17bc4db3a2c96038d91a123062b1fd0504b9c0a4da915eef1e9",
  deploymentId,
  target,
  live,
  ready: true,
  baselineRecipeValuesPreserved: true,
  runtimeKeysPresent: Object.keys(runtime).length,
  hostedSecretValuesReadBack: false,
  cronsUnchanged: true,
  checks: checks.sort((a, b) =>
    (a.route + a.method).localeCompare(b.route + b.method),
  ),
  memberAuthenticationTested: false,
  founderAcknowledgementTested: false,
  smsSent: false,
  businessMutation: false,
};
await fs.writeFile(
  evidence +
    "/" +
    (live
      ? "application-production-readback.json"
      : "application-staging-readback.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    pass: true,
    live,
    source: sha,
    deploymentId,
    httpChecks: checks.length,
    runtimeKeysPresent: report.runtimeKeysPresent,
    cronsUnchanged: true,
  }),
);
