// Exact approved policy publication operator. No SQL/Auth/Play mutations here.
import fs from "node:fs/promises";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const reportRoot =
  "C:/Users/61412/.codex/worktrees/v31-founder-acceptance-20261111/Docked.com.au";
const originalRoot =
  "C:/Users/61412/.codex/worktrees/v31-overnight-candidate-20261112/Docked.com.au";
const packagePath =
  reportRoot +
  "/docs/qa/v31-application-continuation-20261112/privacy-publication-package.json";
const packageDigest =
  "565589b6f748fccd138bd10018f7eb621adc9efb7677f4082963039d8eb0c33b";
const hash = (x) => createHash("sha256").update(x).digest("hex");
const normalized = (x) => x.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
const packageBytes = normalized(await fs.readFile(packagePath, "utf8"));
assert.equal(hash(packageBytes), packageDigest, "Approved package changed");
const packet = JSON.parse(packageBytes);
const git = (...args) =>
  execFileSync("git", args, { cwd: root, windowsHide: true, maxBuffer: 32e6 });
assert.equal(git("rev-parse", "HEAD").toString().trim(), packet.sourceCommit);
const actualDiff = git(
  "diff",
  "--name-only",
  packet.baseCommit,
  packet.sourceCommit,
)
  .toString()
  .trim()
  .split(/\r?\n/)
  .sort();
assert.deepEqual(actualDiff, Object.keys(packet.files).sort());
for (const [file, expected] of Object.entries({
  ...packet.files,
  ...packet.wordingFiles,
})) {
  assert.equal(
    hash(git("show", packet.sourceCommit + ":" + file)),
    expected,
    file + " committed bytes",
  );
  assert.equal(
    hash(normalized(await fs.readFile(file, "utf8"))),
    expected,
    file + " working bytes",
  );
}
assert(
  !git(
    "diff",
    "HEAD",
    "--name-only",
    "--",
    "src",
    "public",
    "config",
    "vercel.json",
    "package.json",
    "package-lock.json",
  )
    .toString()
    .trim(),
  "Uncommitted application changes",
);
const mode = process.argv[2];
assert(
  ["preflight", "stage", "verify-staging", "promote", "verify-live"].includes(
    mode,
  ),
);
const evidence = path.join(root, "docs/qa/v31-phone-privacy-hosted-20261112");
const privateDir = path.join(
  root,
  "private-data/nba-production",
  packet.sourceCommit,
);
const source = path.join(privateDir, "source");
await fs.mkdir(evidence, { recursive: true });
const json = async (file) => JSON.parse(await fs.readFile(file, "utf8"));
const write = async (name, data) =>
  fs.writeFile(path.join(evidence, name), JSON.stringify(data, null, 2) + "\n");
const approval = await json(
  path.join(root, "private-data/phone-privacy-founder-approved.json"),
);
function authority(scope) {
  assert.equal(approval.approved, true);
  assert.equal(approval.sourceCommit, packet.sourceCommit);
  assert.equal(approval.packageSha256, packageDigest);
  const start = Date.parse(approval.approvedAt),
    end = Date.parse(approval.expiresAt);
  assert(
    start <= Date.now() && end > Date.now() && end - start <= 86400000,
    "Expired approval",
  );
  assert(approval.scopes.includes(scope));
  for (const k of [
    "playPublication",
    "sms",
    "registration",
    "inventory",
    "commercialActivation",
    "migrations",
  ])
    assert.equal(approval[k], false);
}
const authDir =
  "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli";
const auth = await json(authDir + "/auth.json");
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
async function inspect(host) {
  const r = await fetch(
    "https://api.vercel.com/v13/deployments/" +
      host +
      "?teamId=" +
      packet.teamId,
    {
      headers: { Authorization: "Bearer " + auth.token },
      signal: AbortSignal.timeout(30000),
    },
  );
  assert(r.ok, "Deployment inspection failed: " + r.status);
  const d = await r.json();
  assert.equal(d.projectId, packet.projectId);
  return d;
}
async function cliRun(args, extra = {}) {
  try {
    return await promisify(execFile)(
      process.execPath,
      [cli, ...args, "--global-config", authDir, "--scope", packet.teamId],
      {
        cwd: source,
        env: { ...process.env, ...extra },
        windowsHide: true,
        timeout: 240000,
        maxBuffer: 16e6,
      },
    );
  } catch (e) {
    await fs.writeFile(
      path.join(privateDir, "operator-error.private.log"),
      String(e.stdout ?? "") + "\n" + String(e.stderr ?? ""),
    );
    throw Error("Vercel command failed; private diagnostics retained");
  }
}
const baselineRuntime = await json(
  path.join(
    originalRoot,
    "private-data/nba-production",
    packet.baseCommit,
    "runtime.private.json",
  ),
);
assert.equal(
  hash(JSON.stringify(baselineRuntime)),
  packet.baselineRuntimeRecipeSha256,
);
assert.equal(
  Object.keys(baselineRuntime).length,
  packet.baselineRuntimeSettings,
);
// This existing runtime branch is an application guard, not the source checkout.
// Preserve it. Deployment Git metadata separately names the approved source branch.
const runtime = {
  ...baselineRuntime,
  ...packet.runtimeOverrides,
  VERCEL_GIT_COMMIT_SHA: packet.sourceCommit,
};
assert.equal(runtime.VERCEL_GIT_COMMIT_REF, "codex/vercel-beta-review");
for (const k of [
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
  assert.equal(runtime[k], "false", k);
assert.equal(
  runtime.DOCKED_PUBLIC_PRIVACY_VERSION,
  "2026-11-11-privacy-phone-v4",
);
const { assertHostedBeta } = await import(
  pathToFileURL(path.join(root, "src/core/hosted-beta.mjs")).href
);
assert.equal(
  assertHostedBeta({
    ...runtime,
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_TARGET_ENV: "production",
    VERCEL_URL: "docked-production-candidate.vercel.app",
  }),
  true,
);
const { publicMemberSetupConfiguration } = await import(
  pathToFileURL(path.join(root, "src/core/public-member-setup.ts")).href
);
assert.equal(
  publicMemberSetupConfiguration(runtime).versions.privacy,
  runtime.DOCKED_PUBLIC_PRIVACY_VERSION,
);
assert.equal(
  publicMemberSetupConfiguration(runtime).versions.terms,
  baselineRuntime.DOCKED_PUBLIC_TERMS_VERSION,
);
async function databaseReadback(label) {
  execFileSync(
    process.execPath,
    ["--import", "tsx", "scripts/v31-committed-readback.ts"],
    {
      cwd: originalRoot,
      env: {
        ...process.env,
        DOCKED_V31_READBACK_DIRECTORY:
          "docs/qa/v31-prelaunch-execution-20261111/backend",
      },
      windowsHide: true,
      timeout: 120000,
      maxBuffer: 4e6,
    },
  );
  const report = await json(
    originalRoot +
      "/docs/qa/v31-prelaunch-execution-20261111/backend/committed-readback.json",
  );
  assert(Date.now() - Date.parse(report.at) < 600000);
  assert.equal(report.protectedRecordsUnchanged, true);
  await write(label + "-database.json", report);
  return report;
}
async function freshPreflight(label) {
  const live = await inspect("docked.com.au");
  assert.equal(live.id, packet.baselineDeployment);
  assert.equal(live.meta.githubCommitSha, packet.baseCommit);
  for (const key of Object.keys(baselineRuntime))
    assert(live.env.includes(key), "Current runtime key missing: " + key);
  const prepared = await json(path.join(privateDir, "baseline.private.json"));
  assert.equal(prepared.id, live.id);
  assert.deepEqual(prepared.crons, live.crons);
  const linked = await json(path.join(source, ".vercel/project.json"));
  assert.equal(linked.projectId, packet.projectId);
  assert.equal(linked.orgId, packet.teamId);
  const exported = await json(path.join(privateDir, "manifest.json"));
  assert.equal(exported.sha, packet.sourceCommit);
  // Batch Git object reads without checkout/archive line-ending conversion.
  const blobs = execFileSync("git", ["cat-file", "--batch"], {
    cwd: root,
    input:
      exported.files
        .map((file) => packet.sourceCommit + ":" + file)
        .join("\n") + "\n",
    windowsHide: true,
    maxBuffer: 256 * 1024 * 1024,
  });
  let offset = 0;
  for (const file of exported.files) {
    const end = blobs.indexOf(10, offset);
    const header = blobs.subarray(offset, end).toString();
    assert.match(header, /^[a-f0-9]+ blob \d+$/);
    const size = Number(header.split(" ")[2]);
    const bytes = blobs.subarray(end + 1, end + 1 + size);
    assert.equal(
      hash(await fs.readFile(path.join(source, file))),
      hash(bytes),
      "Export differs: " + file,
    );
    offset = end + 2 + size;
  }
  assert.equal(offset, blobs.length);
  const db = await databaseReadback(label);
  await fs.writeFile(
    path.join(privateDir, "runtime.private.json"),
    JSON.stringify(runtime),
    { mode: 0o600 },
  );
  await write(label + "-preflight.json", {
    at: new Date().toISOString(),
    source: packet.sourceCommit,
    packageSha256: packageDigest,
    baselineDeployment: live.id,
    exportedFiles: exported.files.length,
    baselineRuntimeDigest: packet.baselineRuntimeRecipeSha256,
    preservedBaselineKeys: 89,
    changedSetting: "DOCKED_PUBLIC_PRIVACY_VERSION",
    sourceCommitMetadataUpdated: true,
    runtimeBranchGuardPreserved: true,
    sourceBranchMetadata: packet.sourceBranch,
    publicRegistration: false,
    sms: false,
    commercial: false,
    databaseReadbackAt: db.at,
  });
}
async function readHttp(target, route, method, live) {
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
  try {
    const { stdout } = await promisify(execFile)(process.execPath, args, {
      cwd: source,
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
  } catch {
    throw Error("Protected HTTP request failed: " + route);
  }
}
async function verify(live) {
  const receipt = await json(path.join(evidence, "deployment-submitted.json"));
  assert.equal(receipt.source, packet.sourceCommit);
  const target = live ? "https://docked.com.au" : receipt.url;
  const d = await inspect(new URL(target).hostname);
  assert.equal(d.id, receipt.id);
  assert.equal(d.readyState, "READY");
  assert.equal(d.meta.githubCommitSha, packet.sourceCommit);
  assert.equal(d.meta.githubCommitRef, packet.sourceBranch);
  for (const key of Object.keys(runtime))
    assert(d.env.includes(key), "Candidate runtime key missing: " + key);
  const baseline = await json(path.join(privateDir, "baseline.private.json"));
  assert.deepEqual(d.crons, baseline.crons);
  assert.equal(
    hash(
      JSON.stringify(await json(path.join(privateDir, "runtime.private.json"))),
    ),
    hash(JSON.stringify(runtime)),
  );
  const cases = [
    ["/api/beta-release", 200],
    ["/app/login", 200],
    ["/app/signup", 200],
    ["/app/invitation-setup", 200],
    ["/privacy", 200],
    ["/commercial-policy", 200],
    ["/refund-policy", 200],
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
  const checks = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (cursor < cases.length) {
        const [route, status, method = "GET"] = cases[cursor++];
        const r = await readHttp(target, route, method, live);
        assert.equal(r.status, status, route);
        const header = (k) =>
          r.headers[k] ??
          r.body.match(new RegExp(k + ":\\s*([^\\r\\n]+)", "i"))?.[1] ??
          "";
        if (route === "/api/beta-release") {
          assert(r.body.includes(packet.sourceCommit));
          assert(r.body.includes('"publicRegistration":false'));
        }
        if (route === "/app/login") assert(r.body.includes("Welcome back"));
        if (route === "/app/invitation-setup")
          assert(r.body.includes("Log in to an existing account"));
        if (route === "/privacy")
          for (const text of [
            runtime.DOCKED_PUBLIC_PRIVACY_VERSION,
            "Twilio",
            "400 days",
            "30 days",
            "United States",
            "Singapore",
            "per-session identifier",
            "Account-deletion requests remain available",
            "90-day",
            "Supabase Auth",
          ])
            assert(r.body.includes(text), "Missing privacy wording: " + text);
        if (route.startsWith("/api/fantasy/scoring-history")) {
          assert(header("cache-control").includes("private"));
          assert(header("cache-control").includes("no-store"));
          assert(r.body.includes("Scoring history is unavailable"));
        }
        if (route === "/api/admin/incidents") {
          assert(header("cache-control").includes("no-store"));
          assert(header("x-content-type-options").includes("nosniff"));
        }
        if (route === "/api/auth/phone")
          assert(r.body.includes("Origin denied"));
        checks.push({ route, method, status, pass: true });
      }
    }),
  );
  const result = {
    at: new Date().toISOString(),
    source: packet.sourceCommit,
    packageSha256: packageDigest,
    deployment: d.id,
    target,
    live,
    httpChecks: checks.length,
    checks: checks.sort((a, b) =>
      (a.route + a.method).localeCompare(b.route + b.method),
    ),
    runtimeKeys: 89,
    runtimeRecipeVerified: true,
    hostedSecretValuesReadBack: false,
    cronsUnchanged: true,
    privacyVersion: runtime.DOCKED_PUBLIC_PRIVACY_VERSION,
    actualFounderConsentSubmissionTested: false,
    smsSent: false,
    playPublished: false,
  };
  await write(
    live ? "production-verification.json" : "staging-verification.json",
    result,
  );
  console.log(
    JSON.stringify({
      verified: true,
      live,
      deployment: d.id,
      checks: checks.length,
      source: packet.sourceCommit,
    }),
  );
}
if (mode === "preflight") {
  await freshPreflight("initial");
  console.log("Exact package/source/runtime/database preflight passed");
}
if (mode === "stage") {
  authority("privacy-stage");
  await freshPreflight("stage");
  try {
    await fs.access(path.join(evidence, "deployment-submitted.json"));
    throw Error("Candidate already submitted; inspect before staging again");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  const args = [
    "deploy",
    "--cwd",
    source,
    "--prod",
    "--skip-domain",
    "--yes",
    "--no-wait",
    "--meta",
    "dockedSourceCommit=" + packet.sourceCommit,
    "--meta",
    "githubCommitSha=" + packet.sourceCommit,
    "--meta",
    "githubCommitRef=" + packet.sourceBranch,
  ];
  for (const key of Object.keys(runtime))
    args.push("--env", key, "--build-env", key);
  const result = await cliRun(args, runtime);
  await fs.writeFile(
    path.join(privateDir, "deploy.private.log"),
    result.stdout + "\n" + result.stderr,
    { mode: 0o600 },
  );
  const urls = [
    ...result.stdout.matchAll(
      /https:\/\/docked-production-[a-z0-9-]+\.vercel\.app/g,
    ),
  ].map((x) => x[0]);
  assert(urls.length);
  const url = urls.at(-1);
  const d = await inspect(new URL(url).hostname);
  assert.equal(d.meta.githubCommitSha, packet.sourceCommit);
  const receipt = {
    at: new Date().toISOString(),
    source: packet.sourceCommit,
    packageSha256: packageDigest,
    url,
    id: d.id,
    projectId: packet.projectId,
    domainAssigned: false,
  };
  await write("deployment-submitted.json", receipt);
  console.log(JSON.stringify(receipt));
}
if (mode === "verify-staging") await verify(false);
if (mode === "promote") {
  authority("privacy-promote");
  const v = await json(path.join(evidence, "staging-verification.json"));
  assert.equal(v.source, packet.sourceCommit);
  assert.equal(v.packageSha256, packageDigest);
  assert.equal(v.httpChecks, 26);
  assert(v.checks.every((x) => x.pass));
  assert(
    Date.now() - Date.parse(v.at) < 1800000,
    "Staging evidence older than 30 minutes",
  );
  await freshPreflight("promotion");
  const r = await json(path.join(evidence, "deployment-submitted.json"));
  const d = await inspect(new URL(r.url).hostname);
  assert.equal(d.id, v.deployment);
  assert.equal(d.readyState, "READY");
  assert.equal(d.meta.githubCommitSha, packet.sourceCommit);
  await cliRun(["promote", r.url, "--cwd", source, "--yes"]);
  const live = await inspect("docked.com.au");
  assert.equal(live.id, r.id);
  await write("deployment-promoted.json", {
    ...r,
    at: new Date().toISOString(),
    domainAssigned: true,
    domain: "https://docked.com.au",
  });
  console.log(
    JSON.stringify({
      promoted: true,
      source: packet.sourceCommit,
      deployment: live.id,
    }),
  );
}
if (mode === "verify-live") {
  await verify(true);
  await databaseReadback("postflight");
}
