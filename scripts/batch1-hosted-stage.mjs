/** Existing protected Preview only. No project env mutation or Production target. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import {
  assertPackHostedAcceptance,
  packAcceptanceDisabledFlags,
  packAcceptanceTarget as target,
} from "../src/core/pack-hosted-acceptance.mjs";
assert(
  process.argv.includes("--pack-only"),
  "Use the reduced pack-only prerequisite",
);
const priv = path.resolve("private-data/batch1-beta-alignment-20261116"),
  docs = "docs/qa/batch1-beta-alignment-20261116",
  source = path.join(priv, "hosted-source");
const mode = process.argv[2];
assert(["inspect", "prepare", "stage", "verify"].includes(mode));
const authDir =
  "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/vercel-cli";
const auth = JSON.parse(readFileSync(authDir + "/auth.json", "utf8"));
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const save = (p, v) => fs.writeFile(p, JSON.stringify(v, null, 2) + "\n");
const git = (...args) =>
  execFileSync("git", args, { windowsHide: true, encoding: "utf8" }).trim();
async function api(route) {
  const r = await fetch(
    "https://api.vercel.com" +
      route +
      (route.includes("?") ? "&" : "?") +
      "teamId=" +
      target.teamId,
    {
      headers: { Authorization: "Bearer " + auth.token },
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    },
  );
  assert(r.ok, "Vercel metadata unavailable " + r.status);
  return r.json();
}
async function command(args, env = {}) {
  try {
    return await promisify(execFile)(
      process.execPath,
      [cli, ...args, "--global-config", authDir, "--scope", target.teamId],
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
      priv + "/stage-error.private.log",
      String(e.stdout ?? "") + "\n" + String(e.stderr ?? ""),
    );
    throw Error("Preview command failed; private diagnostic retained");
  }
}
async function main() {
  const project = await api("/v9/projects/" + target.projectId);
  assert.equal(project.id, target.projectId);
  assert.equal(project.accountId, target.teamId);
  assert.equal(project.ssoProtection?.deploymentType, "all");
  const domains = (await api("/v9/projects/" + target.projectId + "/domains"))
    .domains;
  assert(domains.every((d) => d.name.endsWith(".vercel.app")));
  const inherited = (await api("/v9/projects/" + target.projectId + "/env"))
    .envs;
  if (mode === "inspect") {
    const report = {
      at: new Date().toISOString(),
      projectId: project.id,
      protected: true,
      nodeVersion: project.nodeVersion,
      customDomains: domains.length,
      environmentKeys: inherited.map((e) => ({
        key: e.key,
        target: e.target,
        branch: e.gitBranch,
      })),
      mutations: 0,
    };
    await save(docs + "/vercel-readiness.json", report);
    console.log(
      JSON.stringify({
        protected: true,
        environmentKeys: inherited.length,
        mutations: 0,
      }),
    );
    return;
  }
  const runtime = json(
    process.env.USERPROFILE +
      "/.docked-secrets/batch1-preview-runtime-20261116.json",
  );
  assert.equal(runtime.state, "applied");
  assert.equal(runtime.projectRef, target.projectRef);
  assert(Date.parse(runtime.expiry) - Date.now() > 3600000);
  if (mode === "prepare") {
    assert(
      !existsSync(source),
      "Prepared source exists: inspect before replacing",
    );
    assert.equal(git("branch", "--show-current"), target.branch);
    assert.equal(
      git("status", "--porcelain", "--untracked-files=no"),
      "",
      "Commit verified source before staging",
    );
    const commit = git("rev-parse", "HEAD");
    await fs.mkdir(source, { recursive: true });
    const archive = path.join(priv, "hosted-source.tar");
    execFileSync(
      "git",
      [
        "archive",
        "--format=tar",
        "--output",
        archive,
        commit,
        "src",
        "public",
        "scripts",
        "config",
        "certs",
        "package.json",
        "package-lock.json",
        "next.config.ts",
        "next-env.d.ts",
        "tsconfig.json",
        "vercel.json",
        ".vercelignore",
      ],
      { windowsHide: true },
    );
    execFileSync("tar", ["-xf", archive, "-C", source], { windowsHide: true });
    await fs.mkdir(path.join(source, ".vercel"));
    await save(path.join(source, ".vercel/project.json"), {
      projectId: target.projectId,
      orgId: target.teamId,
      projectName: "docked-preview",
    });
    const connection = json(
        "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
      ),
      accounts = json(
        process.env.USERPROFILE +
          "/.docked-secrets/batch1-hosted-20261116.json",
      ).accounts;
    assert.equal(connection.projectRef, target.projectRef);
    const env = Object.fromEntries(inherited.map((e) => [e.key, ""]));
    Object.assign(
      env,
      Object.fromEntries(packAcceptanceDisabledFlags.map((k) => [k, "false"])),
      {
        DOCKED_PACK_ACCEPTANCE: "true",
        DOCKED_PACK_ACCEPTANCE_FROM: runtime.start,
        DOCKED_PACK_ACCEPTANCE_UNTIL: runtime.expiry,
        DOCKED_PACK_ACCEPTANCE_MEMBERS: accounts.map((a) => a.id).join(","),
        DOCKED_BETA_STAGING: "true",
        DOCKED_OWNER_GAMEPLAY: "true",
        BETA_ACCESS_ENABLED: "true",
        DOCKED_TEST_MARKET_READ_ONLY: "true",
        DOCKED_SPORTS_TEST_COMMERCE: "true",
        DOCKED_SPORTS_PRIVATE_BETA: "true",
        DOCKED_WEEKLY_CORE_ENABLED: "false",
        APP_ENV: "preview",
        SUPABASE_ENV: "preview",
        DOCKED_RELEASE_CHANNEL: "beta",
        DATABASE_RUNTIME: "serverless",
        DATABASE_CONNECTION_MODE: "session",
        DATABASE_URL: runtime.databaseUrl,
        NEXT_PUBLIC_SUPABASE_URL: connection.supabaseUrl,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: connection.publishableKey,
        VERCEL_PROJECT_ID: target.projectId,
        VERCEL_ORG_ID: target.teamId,
        VERCEL_GIT_COMMIT_REF: target.branch,
        VERCEL_GIT_COMMIT_SHA: commit,
        SITE_URL: "",
      },
    );
    assertPackHostedAcceptance({
      ...env,
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_URL: "docked-preview-validation.vercel.app",
    });
    await save(priv + "/hosted-env.private.json", env);
    await save(docs + "/hosted-prepared.json", {
      at: new Date().toISOString(),
      sourceCommit: commit,
      projectId: target.projectId,
      expiry: runtime.expiry,
      existingEnvironmentChanges: 0,
    });
    console.log(
      "Exact committed source and per-deployment isolated environment prepared",
    );
  }
  if (mode === "stage") {
    assert(
      !existsSync(docs + "/hosted-deployment.json"),
      "Deployment already recorded; do not duplicate",
    );
    const prepared = json(docs + "/hosted-prepared.json"),
      env = json(priv + "/hosted-env.private.json");
    assert.equal(prepared.sourceCommit, git("rev-parse", "HEAD"));
    assertPackHostedAcceptance({
      ...env,
      VERCEL: "1",
      VERCEL_ENV: "preview",
      VERCEL_URL: "docked-preview-validation.vercel.app",
    });
    const inspection = await command([
      "project",
      "inspect",
      "--non-interactive",
    ]);
    assert((inspection.stdout + inspection.stderr).includes(target.projectId));
    const args = [
      "deploy",
      "--yes",
      "--no-wait",
      "--target",
      "preview",
      "--project",
      target.projectId,
      "--meta",
      "githubCommitSha=" + prepared.sourceCommit,
      "--meta",
      "githubCommitRef=" + target.branch,
    ];
    for (const key of Object.keys(env))
      args.push("--env", key, "--build-env", key);
    const result = await command(args, env);
    await fs.writeFile(
      priv + "/deployment.private.log",
      result.stdout + "\n" + result.stderr,
    );
    const url = [
      ...result.stdout.matchAll(
        /https:\/\/docked-preview-[a-z0-9-]+\.vercel\.app/g,
      ),
    ].at(-1)?.[0];
    assert(url);
    const d = await api("/v13/deployments/" + new URL(url).hostname);
    assert.equal(d.projectId, target.projectId);
    assert.notEqual(d.target, "production");
    assert.equal(d.meta.githubCommitSha, prepared.sourceCommit);
    await save(docs + "/hosted-deployment.json", {
      at: new Date().toISOString(),
      id: d.id,
      url,
      projectId: target.projectId,
      target: "preview",
      protected: true,
      sourceCommit: prepared.sourceCommit,
      readyState: d.readyState,
      productionChanged: false,
    });
    console.log(JSON.stringify({ id: d.id, url, readyState: d.readyState }));
  }
  if (mode === "verify") {
    const record = json(docs + "/hosted-deployment.json"),
      d = await api("/v13/deployments/" + record.id);
    assert.equal(d.projectId, target.projectId);
    assert.notEqual(d.target, "production");
    assert.equal(d.meta.githubCommitSha, record.sourceCommit);
    assert.equal(d.readyState, "READY");
    await save(docs + "/hosted-deployment.json", {
      ...record,
      readyState: d.readyState,
      verifiedAt: new Date().toISOString(),
    });
    console.log(
      "Protected Preview build READY; application HTTP acceptance remains required",
    );
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
