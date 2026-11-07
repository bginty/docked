// Approved 21-variant foil rollout; retain the exact closed Production runtime.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { assertHostedBeta } from "../src/core/hosted-beta.mjs";
const project = "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
  team = "team_tf6xweKKyVCj9bTppUKttJ4l";
const baseline = "864df2779b258f01d66717170e624a89e5b22ee4",
  baselineId = "dpl_9EcDsyEHY7oH48PDx9t3Q2NYtLmH";
const main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const approved = path.join(
  process.cwd(),
  "private-data/foil-pack-release",
  baseline,
);
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32e6,
  }).trim();
const sha = git("rev-parse", "HEAD"),
  root = process.cwd();
const privateDir = path.join(root, "private-data/foil-rollout-release", sha),
  source = path.join(privateDir, "source");
const evidence = "docs/qa/foil-pack-rollout-20261107/release";
await fs.mkdir(privateDir, { recursive: true });
await fs.mkdir(evidence, { recursive: true });
async function run(args, env = {}) {
  try {
    return await promisify(execFile)(
      process.execPath,
      [
        cli,
        ...args,
        "--global-config",
        main + "/private-data/vercel-cli",
        "--scope",
        team,
      ],
      {
        env: { ...process.env, ...env },
        windowsHide: true,
        timeout: 240000,
        maxBuffer: 16e6,
      },
    );
  } catch (e) {
    await fs.writeFile(
      path.join(privateDir, "cli-error.private.log"),
      (e.stdout ?? "") + "\n" + (e.stderr ?? ""),
      { mode: 0o600 },
    );
    throw Error("Vercel CLI failed; private diagnostic retained");
  }
}
async function api(endpoint) {
  const a = JSON.parse(
    await fs.readFile(main + "/private-data/vercel-cli/auth.json", "utf8"),
  );
  const r = await fetch(
    "https://api.vercel.com" +
      endpoint +
      (endpoint.includes("?") ? "&" : "?") +
      "teamId=" +
      team,
    {
      headers: { Authorization: "Bearer " + a.token },
      signal: AbortSignal.timeout(30000),
    },
  );
  assert(r.ok, "Vercel inspection " + r.status);
  return r.json();
}
const closed = [
  "REGISTRATION_ENABLED",
  "COMPETITIONS_ENABLED",
  "PRIZES_ENABLED",
  "DOCKED_MULTI_SPORT_SANDBOX",
  "DOCKED_MEMBER_GOOGLE_TEST",
  "DOCKED_COMMERCIAL_SERVICE",
  "DOCKED_COMMERCIAL_SURFACES",
  "DOCKED_COMMERCIAL_CHECKOUT",
  "DOCKED_PUBLIC_CUSTOMERS",
];
const mode = process.argv[2];
assert(["prepare", "stage", "inspect"].includes(mode));
await run(["whoami"]); // permits the CLI to refresh its existing authorised session
const live = await api("/v13/deployments/docked.com.au");
assert.equal(live.projectId, project);
assert.equal(
  live.id,
  baselineId,
  "Production changed; review before proceeding",
);
assert.equal(live.meta.githubCommitSha, baseline);
if (mode === "prepare") {
  assert.equal(
    sha,
    "5e043af5a0e52f32b7f7c8842ffe4ea817146f0a",
    "Only the approved candidate may be exported",
  );
  assert.equal(
    git("branch", "--show-current"),
    "codex/foil-pack-complete-rollout",
  );
  assert.equal(
    git(
      "diff",
      "--name-only",
      "HEAD",
      "--",
      "src",
      "public",
      "config",
      "package.json",
      "package-lock.json",
      "next.config.ts",
      "vercel.json",
    ),
    "",
    "Commit release code first",
  );
  const changed = git("diff", "--name-only", baseline, sha).split("\n");
  const allowed = (p) =>
    p.startsWith("docs/") ||
    p.startsWith("tests/") ||
    p.startsWith("design/foil-pack-rollout/") ||
    p.startsWith("public/brand/docked/packs/foil-v2/") ||
    [
      "scripts/build-foil-artwork.mjs",
      "scripts/report-foil-rollout.mjs",
      "scripts/verify-foil-android.mjs",
    ].includes(p) ||
    p === "scripts/serve-foil-pack-review.ts" ||
    p === "playwright.foil-rollout.config.ts" ||
    [
      "src/app/foil-pack-artwork.css",
      "src/app/foil-pack-review.css",
      "src/components/pack-artwork.tsx",
      "src/components/foil-pack-artwork.tsx",
      "src/components/pack-shop.tsx",
      "src/components/owner-dashboard.tsx",
      "src/core/foil-pack-artwork.ts",
    ].includes(p);
  assert(
    changed.every(allowed),
    "Unexpected release changes: " +
      changed.filter((p) => !allowed(p)).join(","),
  );
  const extras = [
    "package.json",
    "package-lock.json",
    "next.config.ts",
    "next-env.d.ts",
    "tsconfig.json",
    "vercel.json",
    ".vercelignore",
    "certs/supabase-prod-ca-2021.crt",
    "scripts/guard-hosted-build.mjs",
  ];
  const files = git("ls-tree", "-r", "--name-only", "-z", sha)
    .split("\0")
    .filter(
      (p) =>
        ["src/", "public/", "config/"].some((prefix) => p.startsWith(prefix)) ||
        extras.includes(p),
    );
  await fs.mkdir(source, { recursive: true });
  const archive = path.join(privateDir, "source.tar");
  execFileSync(
    "git",
    [
      "archive",
      "--format=tar",
      "--output=" + archive,
      sha,
      "src",
      "public",
      "config",
      ...extras.filter((p) => files.includes(p)),
    ],
    { windowsHide: true, maxBuffer: 32e6 },
  );
  execFileSync("tar", ["-xf", archive, "-C", source], { windowsHide: true });
  await fs.mkdir(path.join(source, ".vercel"), { recursive: true });
  await fs.writeFile(
    path.join(source, ".vercel/project.json"),
    JSON.stringify({
      orgId: team,
      projectId: project,
      projectName: "docked-production",
    }),
  );
  const context = await run([
    "project",
    "inspect",
    "--non-interactive",
    "--cwd",
    source,
  ]);
  assert(
    (context.stdout + context.stderr).includes(project),
    "CLI project mismatch",
  );
  const env = JSON.parse(
    await fs.readFile(path.join(approved, "runtime.private.json"), "utf8"),
  );
  const previous = JSON.parse(
    await fs.readFile(
      "docs/qa/foil-pack-release-20261107/release/prepared.json",
      "utf8",
    ),
  );
  assert.equal(previous.commit, baseline);
  assert.equal(
    createHash("sha256").update(JSON.stringify(env)).digest("hex"),
    previous.runtimeDigest,
    "Baseline runtime file changed",
  );
  for (const key of closed) assert.equal(env[key], "false", key);
  assert(!Object.keys(env).some((k) => k.startsWith("DOCKED_V30_TRANSPORT")));
  assert.equal(
    live.env.filter(
      (k) => /^(DOCKED_|NFL_|BETA_|FANTASY_|PROVIDER_)/.test(k) && !(k in env),
    ).length,
    0,
    "Missing current runtime key",
  );
  env.VERCEL_GIT_COMMIT_SHA = sha;
  assert.equal(
    assertHostedBeta({
      ...env,
      VERCEL: "1",
      VERCEL_ENV: "production",
      VERCEL_TARGET_ENV: "production",
      VERCEL_URL: "docked-production-candidate.vercel.app",
    }),
    true,
  );
  await fs.writeFile(
    path.join(privateDir, "runtime.private.json"),
    JSON.stringify(env),
    { mode: 0o600 },
  );
  await fs.writeFile(
    path.join(privateDir, "baseline.private.json"),
    JSON.stringify(live),
    { mode: 0o600 },
  );
  const report = {
    commit: sha,
    branch: git("branch", "--show-current"),
    baseline,
    baselineId,
    rollbackUrl: "https://" + live.url,
    project,
    team,
    files: files.length,
    changedFiles: changed,
    runtimeChangedKeys: ["VERCEL_GIT_COMMIT_SHA"],
    closedFlags: closed,
    customerMutations: 0,
    migrations: [],
    runtimeDigest: createHash("sha256")
      .update(JSON.stringify(env))
      .digest("hex"),
  };
  await fs.writeFile(
    evidence + "/prepared.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      prepared: true,
      commit: sha,
      changedFiles: changed.length,
      closedFlags: closed.length,
      databaseChanges: false,
    }),
  );
} else if (mode === "stage") {
  const prepared = JSON.parse(
    await fs.readFile(evidence + "/prepared.json", "utf8"),
  );
  assert.equal(prepared.commit, sha);
  const env = JSON.parse(
    await fs.readFile(path.join(privateDir, "runtime.private.json"), "utf8"),
  );
  assert.equal(
    prepared.runtimeDigest,
    createHash("sha256").update(JSON.stringify(env)).digest("hex"),
  );
  const args = [
    "deploy",
    "--cwd",
    source,
    "--prod",
    "--skip-domain",
    "--yes",
    "--no-wait",
    "--meta",
    "githubCommitSha=" + sha,
    "--meta",
    "githubCommitRef=codex/vercel-beta-review",
    "--meta",
    "dockedSourceBranch=codex/foil-pack-complete-rollout",
  ];
  for (const key of Object.keys(env))
    args.push("--env", key, "--build-env", key);
  const result = await run(args, env);
  await fs.writeFile(
    path.join(privateDir, "deploy.private.log"),
    result.stdout + "\n" + result.stderr,
    { mode: 0o600 },
  );
  const url = result.stdout.match(
    /https:\/\/docked-production-[a-z0-9-]+\.vercel\.app/,
  )?.[0];
  assert(url, "No deployment URL");
  const d = await api("/v13/deployments/" + new URL(url).hostname);
  assert.equal(d.meta.githubCommitSha, sha);
  const receipt = {
    commit: sha,
    id: d.id,
    url,
    target: d.target,
    state: d.readyState,
    domainAssigned: false,
    baselineId,
  };
  await fs.writeFile(
    evidence + "/staged.json",
    JSON.stringify(receipt, null, 2),
  );
  console.log(JSON.stringify(receipt));
} else {
  const s = JSON.parse(await fs.readFile(evidence + "/staged.json", "utf8"));
  const d = await api("/v13/deployments/" + s.id);
  console.log(
    JSON.stringify({
      id: d.id,
      state: d.readyState,
      url: d.url,
      commit: d.meta.githubCommitSha,
      error: d.errorCode,
    }),
  );
}
