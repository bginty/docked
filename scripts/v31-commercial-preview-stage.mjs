// Exact reviewed candidate, existing protected Preview, no acceptance window.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { assertIsolatedPublicPreview } from "../src/core/isolated-public-preview.mjs";
import {
  authority,
  packet,
  git,
  blob,
  root,
  privateDir,
  evidence,
  readJson,
  hash,
  writePrivate,
  writeEvidence,
  sourceCommit,
  packageSha256,
} from "./lib/v31-commercial-approval.mjs";
const p = packet(),
  mode = process.argv[2];
assert(["prepare", "stage", "verify"].includes(mode));
const project = "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR",
  source = privateDir + "/preview-source";
const authDir =
    "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli",
  auth = readJson(authDir + "/auth.json");
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
async function api(route) {
  const r = await fetch(
    "https://api.vercel.com" +
      route +
      (route.includes("?") ? "&" : "?") +
      "teamId=" +
      p.teamId,
    {
      headers: { Authorization: "Bearer " + auth.token },
      signal: AbortSignal.timeout(30000),
    },
  );
  assert(r.ok, "Preview metadata unavailable " + r.status);
  return r.json();
}
async function command(args, env = {}) {
  try {
    return await promisify(execFile)(
      process.execPath,
      [cli, ...args, "--global-config", authDir, "--scope", p.teamId],
      {
        cwd: source,
        env: { ...process.env, ...env },
        windowsHide: true,
        timeout: 240000,
        maxBuffer: 16e6,
      },
    );
  } catch (e) {
    await fs.writeFile(
      privateDir + "/preview-cli-error.private.log",
      String(e.stdout ?? "") + "\n" + String(e.stderr ?? ""),
      { mode: 0o600 },
    );
    throw Error("Preview CLI stopped; private diagnostic retained");
  }
}
async function files(write) {
  const extras = [".vercelignore", "next-env.d.ts"].filter((f) =>
    git("ls-tree", "--name-only", sourceCommit, "--", f).toString().trim(),
  );
  const entries = [
    ...p.sourceFiles,
    ...extras.map((file) => ({ file, sha256: hash(blob(file)) })),
  ];
  const buffer = execFileSync("git", ["cat-file", "--batch"], {
    cwd: root,
    input: entries.map((f) => sourceCommit + ":" + f.file).join("\n") + "\n",
    windowsHide: true,
    maxBuffer: 256e6,
  });
  let offset = 0;
  for (const f of entries) {
    const end = buffer.indexOf(10, offset),
      header = buffer.subarray(offset, end).toString();
    assert.match(header, /^[a-f0-9]+ blob \d+$/);
    const size = Number(header.split(" ")[2]),
      data = buffer.subarray(end + 1, end + 1 + size);
    assert.equal(hash(data), f.sha256);
    const target = path.join(source, f.file);
    if (write) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, data, { flag: "wx" });
    } else assert.equal(hash(await fs.readFile(target)), f.sha256);
    offset = end + 2 + size;
  }
  assert.equal(offset, buffer.length);
  return entries.length;
}
function validate(env) {
  assert.equal(env.REGISTRATION_ENABLED, "false");
  for (const flag of [
    "DOCKED_COMMERCIAL_SERVICE",
    "DOCKED_COMMERCIAL_SURFACES",
    "DOCKED_COMMERCIAL_CHECKOUT",
    "DOCKED_COMMERCIAL_MARKETPLACE",
    "DOCKED_ISOLATED_GOOGLE_TEST",
    "DOCKED_ISOLATED_PHONE_TEST",
    "DOCKED_PUBLIC_PHONE_OTP",
  ])
    assert.equal(env[flag], "false", flag);
  assert(
    assertIsolatedPublicPreview({
      ...env,
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_TARGET_ENV: "preview",
      VERCEL_URL: "docked-preview-acceptance.vercel.app",
    }),
  );
}
async function main() {
  const projectInfo = await api("/v9/projects/" + project);
  assert.equal(projectInfo.id, project);
  assert.equal(projectInfo.ssoProtection?.deploymentType, "all");
  if (mode === "prepare") {
    authority("preview-stage");
    const deps = readJson(evidence + "/preview-dependencies-applied.json");
    assert.equal(deps.project, p.previewProject);
    assert.equal(deps.sourceCommit, sourceCommit);
    const fixture = readJson(
      "C:/Users/61412/.codex/worktrees/fixed-market-live/Docked.com.au/private-data/restored-public-preview/fixture.private.json",
    );
    assert.equal(fixture.projectRef, p.previewProject);
    const inherited = await api("/v9/projects/" + project + "/env");
    const env = Object.fromEntries(
      inherited.envs
        .filter((v) =>
          /^(DOCKED_|NEXT_PUBLIC_|SUPABASE_|DATABASE_|SMTP_|GRAPH_|MICROSOFT_|NFL_|BETA_|FANTASY_|PROVIDER_|CRON_|REGISTRATION_|PRIZES_|COMPETITIONS_|PAID_|SENDING_|PRO_)/.test(
            v.key,
          ),
        )
        .map((v) => [v.key, ""]),
    );
    for (const f of [
      "DOCKED_BETA_STAGING",
      "DOCKED_PRIVATE_PREVIEW",
      "DOCKED_HOSTED_PRODUCTION",
      "DOCKED_HOSTED_REVIEW",
      "DOCKED_HOSTED_PREVIEW",
      "DOCKED_FRIENDS_BETA",
      "DOCKED_COMMERCIAL_CHECKOUT",
      "DOCKED_COMMERCIAL_SERVICE",
      "DOCKED_COMMERCIAL_SURFACES",
      "DOCKED_COMMERCIAL_MARKETPLACE",
      "DOCKED_RETENTION_SERVICE",
      "DOCKED_RETENTION_APPLY",
      "PRIZES_ENABLED",
      "COMPETITIONS_ENABLED",
      "PAID_PLANS_ENABLED",
      "SENDING_ENABLED",
      "PRO_ENTITLEMENTS_ENABLED",
      "DOCKED_OWNER_GAMEPLAY",
      "DOCKED_MEMBER_GOOGLE_TEST",
      "DOCKED_SPORTS_TEST_COMMERCE",
      "DOCKED_GOOGLE_RECONCILIATION_ENABLED",
      "DOCKED_NBA_PRIVATE_BETA",
      "DOCKED_SPORTS_PRIVATE_BETA",
      "DOCKED_MULTI_SPORT_SANDBOX",
      "DOCKED_WEEKLY_CORE_ENABLED",
      "DOCKED_ISOLATED_GOOGLE_TEST",
      "DOCKED_ISOLATED_PHONE_TEST",
      "DOCKED_PUBLIC_PHONE_OTP",
      "AUTH_EMAIL_ENABLED",
      "DOCKED_OPERATIONAL_ALERT_EMAIL",
    ])
      env[f] = "false";
    Object.assign(env, {
      APP_ENV: "preview",
      SUPABASE_ENV: "preview",
      DOCKED_ISOLATED_PUBLIC: "true",
      DOCKED_PUBLIC_CUSTOMERS: "true",
      REGISTRATION_ENABLED: "false",
      SITE_URL: fixture.origin,
      NEXT_PUBLIC_SUPABASE_URL:
        "https://" + fixture.projectRef + ".supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: fixture.publishableKey,
      DATABASE_URL: fixture.runtime,
      DATABASE_RUNTIME: "serverless",
      DOCKED_COMMERCIAL_DATABASE_URL: fixture.commerce,
      DOCKED_COMMERCIAL_REFERENCE_KEY: fixture.referenceKey,
      DOCKED_COMMERCIAL_ACCOUNT_BINDING_SECRET: fixture.accountBinding,
      DOCKED_PUBLIC_PRIVACY_VERSION: "2026-11-11-privacy-phone-v4",
      VERCEL_GIT_COMMIT_SHA: sourceCommit,
      VERCEL_GIT_COMMIT_REF: "codex/member-platform-updates",
      VERCEL_PROJECT_ID: project,
      VERCEL_ORG_ID: p.teamId,
    });
    validate(env);
    const count = await files(true);
    await fs.mkdir(source + "/.vercel", { recursive: true });
    await fs.writeFile(
      source + "/.vercel/project.json",
      JSON.stringify({
        projectId: project,
        orgId: p.teamId,
        projectName: "docked-preview",
      }),
      { flag: "wx" },
    );
    writePrivate("preview-runtime.private.json", env);
    writeEvidence("preview-application-prepared.json", {
      at: new Date().toISOString(),
      sourceCommit,
      packageSha256,
      project,
      sourceFiles: count,
      settings: Object.keys(env).length,
      runtimeRecipeSha256: hash(JSON.stringify(env)),
      registration: false,
      phone: false,
      commercial: false,
      isolatedReadOnlyNamespace: true,
      existingFixtureReused: true,
    });
    console.log("Exact protected Preview source and closed runtime prepared");
  }
  if (mode === "stage") {
    authority("preview-stage");
    assert(
      !(await fs
        .stat(evidence + "/preview-deployment-submitted.json")
        .catch(() => null)),
      "Preview already submitted",
    );
    await files(false);
    const env = readJson(privateDir + "/preview-runtime.private.json");
    validate(env);
    const inspected = await command([
      "project",
      "inspect",
      "--non-interactive",
    ]);
    assert(
      (inspected.stdout + inspected.stderr).includes(project),
      "CLI Preview project mismatch",
    );
    const args = [
      "deploy",
      "--cwd",
      source,
      "--yes",
      "--no-wait",
      "--meta",
      "githubCommitSha=" + sourceCommit,
      "--meta",
      "githubCommitRef=codex/v31-founder-acceptance-20261111",
    ];
    for (const key of Object.keys(env))
      args.push("--env", key, "--build-env", key);
    const result = await command(args, env);
    await fs.writeFile(
      privateDir + "/preview-deploy.private.log",
      result.stdout + "\n" + result.stderr,
      { mode: 0o600 },
    );
    const url = [
      ...result.stdout.matchAll(
        /https:\/\/docked-preview-[a-z0-9-]+\.vercel\.app/g,
      ),
    ]
      .map((x) => x[0])
      .at(-1);
    assert(url);
    const d = await api("/v13/deployments/" + new URL(url).hostname);
    assert.equal(d.projectId, project);
    assert.notEqual(d.target, "production");
    assert.equal(d.meta.githubCommitSha, sourceCommit);
    const receipt = {
      at: new Date().toISOString(),
      sourceCommit,
      packageSha256,
      project,
      url,
      id: d.id,
      aliasChanged: false,
      productionChanged: false,
    };
    writeEvidence("preview-deployment-submitted.json", receipt);
    console.log(JSON.stringify(receipt));
  }
  if (mode === "verify") {
    const receipt = readJson(evidence + "/preview-deployment-submitted.json"),
      d = await api("/v13/deployments/" + receipt.id);
    assert.equal(d.readyState, "READY");
    assert.equal(d.projectId, project);
    assert.equal(d.meta.githubCommitSha, sourceCommit);
    assert.notEqual(d.target, "production");
    const env = readJson(privateDir + "/preview-runtime.private.json");
    validate(env);
    for (const key of Object.keys(env)) assert(d.env.includes(key));
    const cases = [
      ["/app/login", 200],
      ["/app/signup", 200],
      ["/privacy", 200],
      ["/api/store/google/commercial", 403],
      ["/api/admin/incidents", 403],
      ["/api/public-gameplay?sport=basketball", 403],
    ];
    const checks = [];
    for (const [route, expected] of cases) {
      const args = [
        cli,
        "curl",
        route,
        "--deployment",
        receipt.url,
        "--",
        "--silent",
        "--show-error",
        "--max-time",
        "45",
        "--write-out",
        "\nDOCKED_STATUS:%{http_code}",
      ];
      const { stdout } = await promisify(execFile)(process.execPath, args, {
        cwd: source,
        env: { ...process.env, VERCEL_TOKEN: auth.token },
        windowsHide: true,
        timeout: 55000,
        maxBuffer: 8e6,
      });
      const status = Number(stdout.match(/DOCKED_STATUS:(\d+)/)?.[1]);
      assert.equal(status, expected, route);
      if (route === "/privacy")
        assert(stdout.includes("2026-11-11-privacy-phone-v4"));
      checks.push({ route, status });
    }
    writeEvidence("preview-application-verified.json", {
      at: new Date().toISOString(),
      sourceCommit,
      packageSha256,
      project,
      deployment: d.id,
      checks,
      protectedAllDeployments: true,
      providerAndRegistrationOff: true,
      commercialOff: true,
      noAcceptanceWindow: true,
      productionChanged: false,
    });
    console.log(
      JSON.stringify({
        verified: true,
        deployment: d.id,
        sourceCommit,
        checks: checks.length,
      }),
    );
  }
}
main().catch(async (e) => {
  await fs.writeFile(
    privateDir + "/preview-application-error.private.txt",
    String(e),
    { mode: 0o600 },
  );
  console.error(
    "Preview staging stopped; private diagnostic retained. No activation.",
  );
  process.exitCode = 1;
});
