// Stages a Production build without moving the live domain; promotion is separate.
import fs from "node:fs/promises";
import { execFileSync, execFile } from "node:child_process";
import { promisify, parseEnv } from "node:util";
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
const receiptPath = "docs/qa/nba-private-beta-live/deployment-submitted.json";
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
  await fs.writeFile(
    path.join(parent, "manifest.json"),
    JSON.stringify({ sha, files }),
  );
  console.log(JSON.stringify({ prepared: true, sha, fileCount: files.length }));
} else if (process.argv[2] === "stage") {
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
  const env = parseEnv(await fs.readFile(envFile, "utf8"));
  const overrides = {
    VERCEL_GIT_COMMIT_SHA: sha,
    VERCEL_GIT_COMMIT_REF: target.branch,
    DOCKED_NBA_PRIVATE_BETA: "true",
    DOCKED_MULTI_SPORT_SANDBOX: "false",
    DOCKED_PREVIEW_TESTER_ID: "",
    DOCKED_PREVIEW_TESTER_EMAIL: "",
  };
  assertHostedBeta({
    ...env,
    ...overrides,
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_TARGET_ENV: "production",
    VERCEL_URL: "docked-production-candidate.vercel.app",
  });
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
  ];
  for (const [k, v] of Object.entries(overrides))
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
    at: new Date().toISOString(),
  };
  await fs.writeFile(receiptPath, JSON.stringify(receipt, null, 2));
  console.log(JSON.stringify(receipt));
} else if (process.argv[2] === "promote") {
  const receipt = JSON.parse(await fs.readFile(receiptPath, "utf8"));
  assert.equal(receipt.commit, sha);
  assert.equal(receipt.projectId, target.projectId);
  const check = await run(["inspect", receipt.url, "--cwd", source]);
  assert(/Ready/i.test(check.stdout + check.stderr));
  await run(["promote", receipt.url, "--cwd", source, "--yes"]);
  await fs.writeFile(
    "docs/qa/nba-private-beta-live/deployment-promoted.json",
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
