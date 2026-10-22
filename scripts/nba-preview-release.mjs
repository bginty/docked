import fs from "node:fs/promises";
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseEnv } from "node:util";
import { assertPrivatePreview } from "../src/core/private-preview.mjs";
const root = process.cwd(),
  main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const target = JSON.parse(
  await fs.readFile("config/hosted-preview.json", "utf8"),
);
assert.equal(target.projectId, "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR");
assert.equal(target.teamId, "team_tf6xweKKyVCj9bTppUKttJ4l");
const git = (...a) =>
  execFileSync("git", a, { encoding: "utf8", windowsHide: true }).trim();
const sha = git("rev-parse", "HEAD"),
  branch = git("branch", "--show-current");
assert.equal(branch, "codex/member-platform-updates");
const parent = path.join(root, "private-data", "nba-acceptance", sha),
  source = path.join(parent, "source");
await fs.mkdir(parent, { recursive: true });
const cli =
  "C:/Users/61412/AppData/Local/npm-cache/_npx/67eb4586ca667318/node_modules/vercel/dist/index.js";
const run = async (args) => {
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
      path.join(parent, "cli-error.private.log"),
      (e.stdout ?? "") + "\n" + (e.stderr ?? ""),
      { mode: 0o600 },
    );
    throw Error("CLI operation failed; private diagnostic retained");
  }
};
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
  const changed = git("diff", "--name-only", "HEAD", "-z")
    .split("\0")
    .filter(Boolean);
  assert.ok(!changed.some(allowed));
  await fs.mkdir(source, { recursive: true });
  const files = git("ls-files", "-z")
    .split("\0")
    .filter(Boolean)
    .filter(allowed);
  let bytes = 0;
  const manifest = [];
  const archive = path.join(parent, "source.tar");
  execFileSync(
    "git",
    ["archive", "--format=tar", "--output=" + archive, sha, ...files],
    { maxBuffer: 32e6, windowsHide: true },
  );
  execFileSync("tar", ["-xf", archive, "-C", source], {
    maxBuffer: 32e6,
    windowsHide: true,
  });
  for (const f of files) {
    const b = await fs.readFile(path.join(source, f));
    bytes += b.length;
    manifest.push({
      file: f,
      sha256: createHash("sha256").update(b).digest("hex"),
    });
  }
  await fs.mkdir(path.join(source, ".vercel"), { recursive: true });
  await fs.writeFile(
    path.join(source, ".vercel/project.json"),
    JSON.stringify({
      orgId: target.teamId,
      projectId: target.projectId,
      projectName: "docked-preview",
    }),
  );
  await fs.writeFile(
    path.join(parent, "source-manifest.json"),
    JSON.stringify({ commit: sha, branch, files: manifest }),
  );
  const inspected = await run([
    "project",
    "inspect",
    "docked-preview",
    "--cwd",
    source,
  ]);
  await fs.writeFile(
    path.join(parent, "project-inspect.private.log"),
    inspected.stdout + "\n" + inspected.stderr,
    { mode: 0o600 },
  );
  assert.ok((inspected.stdout + inspected.stderr).includes(target.projectId));
  console.log(
    JSON.stringify({
      prepared: true,
      sha,
      branch,
      fileCount: files.length,
      bytes,
      project: target.projectId,
      source,
    }),
  );
} else if (process.argv[2] === "deploy") {
  const manifest = JSON.parse(
    await fs.readFile(path.join(parent, "source-manifest.json"), "utf8"),
  );
  assert.equal(manifest.commit, sha);
  const envFile = path.join(parent, "preview-env.private");
  await run([
    "env",
    "pull",
    envFile,
    "--environment",
    "preview",
    "--cwd",
    source,
    "--yes",
  ]);
  const env = parseEnv(await fs.readFile(envFile, "utf8"));
  const overrides = {
    VERCEL_GIT_COMMIT_SHA: sha,
    VERCEL_GIT_COMMIT_REF: branch,
    DOCKED_MULTI_SPORT_SANDBOX: "true",
    DOCKED_PREVIEW_TESTER_ID: "",
    DOCKED_PREVIEW_TESTER_EMAIL: "",
  };
  assertPrivatePreview({
    ...env,
    ...overrides,
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_URL: "docked-preview-candidate.vercel.app",
  });
  const args = [
    "deploy",
    "--cwd",
    source,
    "--target",
    "preview",
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
      /https:\/\/docked-preview-[a-z0-9-]+\.vercel\.app/g,
    ),
  ].map((m) => m[0]);
  assert.ok(urls.length);
  const receipt = {
    submitted: true,
    commit: sha,
    url: urls.at(-1),
    target: "preview",
    projectId: target.projectId,
    admission: "closed",
    at: new Date().toISOString(),
  };
  await fs.writeFile(
    "docs/qa/multi-sport/nba-acceptance/deployment-submitted.json",
    JSON.stringify(receipt, null, 2),
  );
  console.log(JSON.stringify(receipt));
} else throw Error("Expected prepare/deploy");
