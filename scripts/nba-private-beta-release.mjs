// Stages a Production build without moving the live domain; promotion is separate.
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import assert from "node:assert/strict";
import { assertHostedBeta } from "../src/core/hosted-beta.mjs";
const root = process.cwd(),
  main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const target = JSON.parse(await fs.readFile("config/hosted-beta.json", "utf8"));
assert.equal(target.projectId, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
assert.equal(target.teamId, "team_tf6xweKKyVCj9bTppUKttJ4l");
const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", windowsHide: true }).trim();
const sha = git("rev-parse", "HEAD"),
  parent = path.join(root, "private-data", "nba-production", sha),
  source = path.join(parent, "source");
await fs.mkdir(parent, { recursive: true });
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
async function run(args) {
  try {
    return await promisify(execFile)(
      process.execPath,
      [
        cli,
        ...args,
        "--global-config",
        main + "/private-data/vercel-cli",
        "--scope",
        target.teamId,
      ],
      { windowsHide: true, maxBuffer: 16e6, timeout: 240000 },
    );
  } catch (e) {
    await fs.writeFile(
      path.join(parent, "error.private.log"),
      (e.stdout ?? "") + "\n" + (e.stderr ?? ""),
      { mode: 0o600 },
    );
    throw Error("CLI failed; private diagnostic retained");
  }
}
const evidence =
  process.env.NBA_RELEASE_EVIDENCE ?? "docs/qa/nba-private-beta-live";
assert(evidence.startsWith("docs/qa/") && !evidence.includes(".."));
await fs.mkdir(evidence, { recursive: true });
const receiptPath = evidence + "/deployment-submitted.json";
async function liveDeployment() {
  const auth = JSON.parse(
    await fs.readFile(main + "/private-data/vercel-cli/auth.json", "utf8"),
  );
  const response = await fetch(
    `https://api.vercel.com/v13/deployments/docked.com.au?teamId=${target.teamId}`,
    {
      headers: { Authorization: `Bearer ${auth.token}` },
      signal: AbortSignal.timeout(30000),
    },
  );
  assert(response.ok, "Live deployment inspection failed");
  const value = await response.json();
  assert.equal(value.projectId ?? value.project?.id, target.projectId);
  return value;
}
if (process.argv[2] === "prepare") {
  const explicit = new Set([
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "next-env.d.ts",
    "tsconfig.json",
    "vercel.json",
    ".vercelignore",
    "certs/supabase-prod-ca-2021.crt",
    "scripts/guard-hosted-build.mjs",
  ]);
  const allowed = (f) =>
    ["src/", "public/", "config/"].some((p) => f.startsWith(p)) ||
    explicit.has(f);
  assert(
    !git("diff", "--name-only", "HEAD", "-z").split("\0").some(allowed),
    "Commit application changes before release",
  );
  const files = git("ls-files", "-z")
    .split("\0")
    .filter(Boolean)
    .filter(allowed);
  await fs.mkdir(source, { recursive: true });
  const archive = path.join(parent, "source.tar");
  execFileSync(
    "git",
    ["archive", "--format=tar", "--output=" + archive, sha, ...files],
    { windowsHide: true, maxBuffer: 32e6 },
  );
  execFileSync("tar", ["-xf", archive, "-C", source], {
    windowsHide: true,
    maxBuffer: 32e6,
  });
  await fs.mkdir(path.join(source, ".vercel"), { recursive: true });
  await fs.writeFile(
    path.join(source, ".vercel/project.json"),
    JSON.stringify({
      orgId: target.teamId,
      projectId: target.projectId,
      projectName: "docked-production",
    }),
  );
  const inspect = await run([
    "project",
    "inspect",
    "docked-production",
    "--cwd",
    source,
  ]);
  assert((inspect.stdout + inspect.stderr).includes(target.projectId));
  const baseline = await liveDeployment();
  assert.equal(
    baseline.meta.githubCommitSha,
    "2d03855d9bf3d4ece13b3d2b19d672d5eb3519c0",
    "Review a changed Production baseline before release",
  );
  await fs.writeFile(
    path.join(parent, "baseline.private.json"),
    JSON.stringify(baseline),
    { mode: 0o600 },
  );
  await fs.writeFile(
    evidence + "/rollback.json",
    JSON.stringify(
      {
        deployment: baseline.id,
        url: baseline.url,
        commit: baseline.meta.githubCommitSha,
        databaseMigrations: [
          "20261022115817",
          "20261022122441",
          "20261022123136",
          "20261022124750",
          "20261022203038",
        ],
        recovery:
          "Promote the previous deployment and disable private_beta_sports. Retain additive fixture registries and audit records. The previous app does not enable the new commerce connection setting.",
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(parent, "manifest.json"),
    JSON.stringify({ sha, files }),
  );
  console.log(JSON.stringify({ prepared: true, sha, fileCount: files.length }));
} else if (process.argv[2] === "stage") {
  const fixtureCommerce = process.argv.includes("--fixture-commerce");
  if (fixtureCommerce) {
    const approval = JSON.parse(
      await fs.readFile(evidence + "/commerce-apply.json", "utf8"),
    );
    assert(
      approval.passed === true &&
        approval.permanentRecordsUnchanged === true &&
        approval.creditChanges === 0,
      "Verified isolated-commerce preparation required",
    );
  }
  assert.equal(
    JSON.parse(await fs.readFile(path.join(parent, "manifest.json"), "utf8"))
      .sha,
    sha,
  );
  const envFile = path.join(parent, "production-env.private");
  await run([
    "env",
    "pull",
    envFile,
    "--environment",
    "production",
    "--cwd",
    source,
    "--yes",
  ]);
  // The established release uses deployment-scoped values. Reconstruct the
  // exact live recipe, retaining its private worker/history credentials.
  const base = JSON.parse(
    await fs.readFile(path.join(parent, "baseline.private.json"), "utf8"),
  );
  assert.equal(
    (await liveDeployment()).id,
    base.id,
    "Production changed during preparation",
  );
  assert.equal(
    base.meta.githubCommitSha,
    "2d03855d9bf3d4ece13b3d2b19d672d5eb3519c0",
  );
  const recipe = git(
    "show",
    "31f0ecc99c40aedcd4f4f64695a3de030715da0e:scripts/deploy-beta-staging.mjs",
  );
  const context = {
    readFileSync: (f, ...a) => readFileSync(path.resolve(main, f), ...a),
    assert,
    resolve: path.resolve,
    packPreview: false,
    friends: true,
    ownerGameplay: true,
    ownerAuth: true,
    target: "production",
    team: target.teamId,
    project: target.projectId,
    branch: target.branch,
    sha,
    assertHostedBeta,
  };
  vm.runInNewContext(
    recipe.slice(
      recipe.indexOf("  const c = JSON.parse("),
      recipe.indexOf("  const source = resolve("),
    ) + "\nresult=env;",
    context,
  );
  const env = {
    ...context.result,
    ...JSON.parse(
      await fs.readFile(
        main + "/private-data/nfl-live-release/history-env.json",
        "utf8",
      ),
    ),
    SUPABASE_SECRET_KEY: "",
    SUPABASE_SERVICE_ROLE_KEY: "",
    DOCKED_PRIVATE_PREVIEW: "",
    DOCKED_BETA_TRADING: "private-beta-trading-v1",
    DOCKED_TEST_MARKET_READ_ONLY: "false",
    DOCKED_WEEKLY_CORE_ENABLED: "true",
    DOCKED_NBA_PRIVATE_BETA: "true",
    DOCKED_SPORTS_PRIVATE_BETA: "true",
    DOCKED_SPORTS_TEST_COMMERCE: fixtureCommerce ? "true" : "false",
    DOCKED_MULTI_SPORT_SANDBOX: "false",
    DOCKED_PREVIEW_TESTER_ID: "",
    DOCKED_PREVIEW_TESTER_EMAIL: "",
    ...JSON.parse(
      await fs.readFile(
        main + "/private-data/member-integrity-live/worker-env.json",
        "utf8",
      ),
    ),
  };
  assert.equal(
    base.env.filter(
      (k) => /^(DOCKED_|NFL_|BETA_|FANTASY_|PROVIDER_)/.test(k) && !(k in env),
    ).length,
    0,
    "Preserve all existing custom runtime flags",
  );
  const overrides = {
    VERCEL_GIT_COMMIT_SHA: sha,
    VERCEL_GIT_COMMIT_REF: target.branch,
  };
  assert.equal(
    assertHostedBeta({
      ...env,
      ...overrides,
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_TARGET_ENV: "production",
      VERCEL_URL: "docked-production-candidate.vercel.app",
    }),
    true,
  );
  assert.equal(env.REGISTRATION_ENABLED, "false");
  const args = [
    "deploy",
    "--cwd",
    source,
    "--prod",
    "--skip-domain",
    "--yes",
    "--no-wait",
    "--meta",
    `dockedSourceCommit=${sha}`,
    "--meta",
    `githubCommitSha=${sha}`,
    "--meta",
    `githubCommitRef=${target.branch}`,
  ];
  for (const [k, v] of Object.entries({ ...env, ...overrides }))
    args.push("--env", `${k}=${v}`, "--build-env", `${k}=${v}`);
  const result = await run(args);
  await fs.writeFile(
    path.join(parent, "deploy.private.log"),
    result.stdout + "\n" + result.stderr,
    { mode: 0o600 },
  );
  const urls = [
    ...result.stdout.matchAll(
      /https:\/\/docked-production-[a-z0-9-]+\.vercel\.app/g,
    ),
  ].map((m) => m[0]);
  assert(urls.length);
  const receipt = {
    commit: sha,
    url: urls.at(-1),
    target: "production",
    domainAssigned: false,
    projectId: target.projectId,
    privateNba: true,
    fixtureCommerce,
    at: new Date().toISOString(),
  };
  await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} else if (process.argv[2] === "promote") {
  const receipt = JSON.parse(await fs.readFile(receiptPath, "utf8"));
  assert.equal(receipt.commit, sha);
  assert.equal(receipt.projectId, target.projectId);
  const baseline = JSON.parse(
    await fs.readFile(path.join(parent, "baseline.private.json"), "utf8"),
  );
  assert.equal(
    (await liveDeployment()).id,
    baseline.id,
    "Production changed before promotion",
  );
  const check = await run(["inspect", receipt.url, "--cwd", source]);
  assert(/Ready/i.test(check.stdout + check.stderr));
  await run(["promote", receipt.url, "--cwd", source, "--yes"]);
  await fs.writeFile(
    evidence + "/deployment-promoted.json",
    JSON.stringify(
      {
        ...receipt,
        domainAssigned: true,
        domain: "https://docked.com.au",
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ promoted: true, url: receipt.url, commit: sha }),
  );
} else throw Error("Expected prepare/stage/promote");
