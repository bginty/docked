// Approved scoring / pack refinement; exact committed candidate and unchanged closed runtime.
// Usage: node scripts/scoring-pack-refinement-release.mjs prepare|stage|inspect --commit <40-character-reviewed-SHA>
// Preparation/staging never promote the domain. Source exports are immutable;
// rerunning prepare for the same candidate requires inspecting the existing export.
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { assertHostedBeta } from "../src/core/hosted-beta.mjs";
const project = "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
  team = "team_tf6xweKKyVCj9bTppUKttJ4l";
const baseline = "8b73ef728156b9139ee48605d57d068b5c19efa6",
  baselineId = "dpl_wGaDeimzDBobhc7KfWBs3UGxmNrF";
const main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const approved =
  "C:/Users/61412/.codex/worktrees/scoring-pack-refinement/Docked.com.au/private-data/scoring-pack-refinement-release/8b73ef728156b9139ee48605d57d068b5c19efa6";
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const git = (...args) =>
  execFileSync("git", args, {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 32e6,
  }).trim();
// Require the reviewed application commit explicitly; evidence-only commits may
// follow it, but HEAD is never silently treated as the deployment candidate.
const mode = process.argv[2];
assert(
  ["prepare", "stage", "inspect"].includes(mode),
  "Use prepare, stage or inspect --commit <full SHA>",
);
const commitArgument = process.argv.indexOf("--commit");
const requestedCommit = process.argv[commitArgument + 1];
assert(
  commitArgument > 2 && /^[a-f0-9]{40}$/.test(requestedCommit ?? ""),
  "An explicit full reviewed commit SHA is required",
);
const sha = git("rev-parse", "--verify", requestedCommit + "^{commit}");
assert.equal(sha, requestedCommit);
const root = process.cwd();
const privateDir = path.join(
    root,
    "private-data/scoring-pack-refinement-release",
    sha,
  ),
  source = path.join(privateDir, "source");
const evidence = "docs/qa/scoring-pack-refinement-20261108/release-final";
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
async function exportedFiles(folder, prefix = "") {
  const result = [];
  for (const entry of await fs.readdir(folder, { withFileTypes: true })) {
    assert(!entry.isSymbolicLink(), "Source export must not contain symlinks");
    const relative = prefix + entry.name;
    if (entry.isDirectory())
      result.push(
        ...(await exportedFiles(path.join(folder, entry.name), relative + "/")),
      );
    else if (entry.isFile()) result.push(relative);
  }
  return result;
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
    git("branch", "--show-current"),
    "codex/scoring-pack-refinement",
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
  assert.equal(
    git(
      "ls-files",
      "--others",
      "--exclude-standard",
      "--",
      "src",
      "public",
      "config",
    ),
    "",
    "Untracked application files must be reviewed and committed first",
  );
  const changed = git("diff", "--name-only", baseline, sha).split("\n");
  git("merge-base", "--is-ancestor", baseline, sha);
  assert.equal(
    git(
      "diff",
      "--name-only",
      sha,
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
    "Application differs from approved candidate",
  );
  assert.equal(
    git(
      "diff",
      "--name-only",
      baseline,
      sha,
      "--",
      "public",
      "config",
      "android",
      "ios",
      "supabase",
      "package.json",
      "package-lock.json",
      "next.config.ts",
      "vercel.json",
    ),
    "",
    "Protected runtime/assets/economics changed",
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
  assert.equal(
    await fs.stat(source).then(
      () => true,
      () => false,
    ),
    false,
    "Candidate source directory already exists; inspect it instead of mixing exports",
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
  const sourceInventory = await Promise.all(
    files.map(async (file) => ({
      path: file,
      sha256: createHash("sha256")
        .update(await fs.readFile(path.join(source, file)))
        .digest("hex"),
    })),
  );
  const sourceInventoryDigest = createHash("sha256")
    .update(JSON.stringify(sourceInventory))
    .digest("hex");
  await fs.writeFile(
    path.join(privateDir, "source-inventory.private.json"),
    JSON.stringify(sourceInventory),
    { mode: 0o600 },
  );
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
      "docs/qa/scoring-pack-refinement-20261108/release/prepared.json",
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
    sourceInventoryDigest,
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
  assert.equal(prepared.baseline, baseline);
  assert.equal(prepared.baselineId, baselineId);
  const sourceInventory = JSON.parse(
    await fs.readFile(
      path.join(privateDir, "source-inventory.private.json"),
      "utf8",
    ),
  );
  assert.equal(
    createHash("sha256").update(JSON.stringify(sourceInventory)).digest("hex"),
    prepared.sourceInventoryDigest,
    "Prepared source manifest changed",
  );
  for (const file of sourceInventory) {
    assert.equal(
      createHash("sha256")
        .update(await fs.readFile(path.join(source, file.path)))
        .digest("hex"),
      file.sha256,
      "Prepared source changed: " + file.path,
    );
  }
  assert.deepEqual(
    (await exportedFiles(source)).sort(),
    [
      ...sourceInventory.map((file) => file.path),
      ".vercel/project.json",
    ].sort(),
    "Unexpected files in source export",
  );
  const projectBinding = JSON.parse(
    await fs.readFile(path.join(source, ".vercel/project.json"), "utf8"),
  );
  assert.equal(projectBinding.projectId, project);
  assert.equal(projectBinding.orgId, team);
  const env = JSON.parse(
    await fs.readFile(path.join(privateDir, "runtime.private.json"), "utf8"),
  );
  assert.equal(
    prepared.runtimeDigest,
    createHash("sha256").update(JSON.stringify(env)).digest("hex"),
  );
  for (const key of closed) assert.equal(env[key], "false", key);
  assert.equal(env.VERCEL_GIT_COMMIT_SHA, sha);
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
    "dockedSourceBranch=codex/scoring-pack-refinement",
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
  assert.equal(s.commit, sha);
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
