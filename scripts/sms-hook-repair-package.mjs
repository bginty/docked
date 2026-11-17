/** Offline exact Git-byte manifest/export; never deploys, enables or sends. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const directory = "docs/qa/sms-hook-repair-20261118/";
const manifest = directory + "package.json";
const baseline = "405058ebfe3e2c915d43ed5344dfb3fcd7930049";
const branch = "codex/sms-hook-repair-20261118";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, { windowsHide: true, maxBuffer: 256e6 });
function blobs(commit, files) {
  const out = new Map(),
    bytes = execFileSync("git", ["cat-file", "--batch"], {
      input: files.map((f) => `${commit}:${f}`).join("\n") + "\n",
      windowsHide: true,
      maxBuffer: 256e6,
    });
  let offset = 0;
  for (const file of files) {
    assert(!path.isAbsolute(file) && !file.split("/").includes(".."));
    const end = bytes.indexOf(10, offset),
      header = bytes.subarray(offset, end).toString();
    assert.match(header, /^[a-f0-9]+ blob \d+$/);
    const length = Number(header.split(" ")[2]);
    out.set(file, bytes.subarray(end + 1, end + 1 + length));
    offset = end + length + 2;
  }
  assert.equal(offset, bytes.length);
  return out;
}
const digests = (commit, files) =>
  [...blobs(commit, files)].map(([file, b]) => ({ file, sha256: sha(b) }));
const [mode, expected, destination] = process.argv.slice(2);
assert(["prepare", "verify", "export"].includes(mode));
if (mode === "prepare") {
  assert.equal(
    git("status", "--porcelain").toString().trim(),
    "",
    "Commit verified source first",
  );
  assert.equal(git("branch", "--show-current").toString().trim(), branch);
  const original = fs.readFileSync(
    "docs/qa/paid-launch-final-20261118/preparation-package.json",
  );
  assert.equal(
    sha(original),
    "5ac121c65e4e0d2815b92897dc15275457b0029586a509fcb34684336dea1bed",
  );
  const prior = JSON.parse(original),
    sourceCommit = git("rev-parse", "HEAD").toString().trim();
  assert.equal(prior.sourceCommit, baseline);
  const changed = git("diff", "--name-only", baseline, sourceCommit)
    .toString()
    .trim()
    .split("\n");
  assert(
    !changed.some((f) => f.startsWith("android/") || f.startsWith("supabase/")),
  );
  const files = prior.sourceFiles.map((f) => f.file);
  const changedRuntimeFiles = changed.filter((f) => files.includes(f)).sort();
  assert.deepEqual(changedRuntimeFiles, [
    "src/app/admin/incidents/page.tsx",
    "src/server/sms-budget-hook.ts",
    "vercel.json",
  ]);
  assert.equal(
    JSON.parse(git("show", `${sourceCommit}:vercel.json`)).git
      .deploymentEnabled[branch],
    false,
  );
  const verification = JSON.parse(
    fs.readFileSync(directory + "verification.json"),
  );
  assert.equal(verification.passed, true);
  const operators = prior.operatorFiles.map((f) => f.file);
  assert.deepEqual(
    digests(sourceCommit, operators),
    prior.operatorFiles,
    "Existing operator bytes unchanged",
  );
  const p = {
    version: "sms-hook-repair-20261118",
    sourceCommit,
    branch,
    sourceTree: git("rev-parse", sourceCommit + "^{tree}")
      .toString()
      .trim(),
    baselineSource: baseline,
    baselineDeployment: "dpl_ACcdM4ivSaNW2ARC3tQf3MmaL2sZ",
    projectId: prior.projectId,
    teamId: prior.teamId,
    databaseProject: prior.databaseProject,
    sourceFiles: digests(sourceCommit, files),
    changedRuntimeFiles,
    operatorFiles: digests(sourceCommit, [
      ...operators,
      "scripts/sms-hook-repair-package.mjs",
    ]),
    reviewedFiles: digests(sourceCommit, [
      ".gitattributes",
      directory + "EXECUTION.txt",
      directory + "ROOT_CAUSE.txt",
      directory + "verification.json",
    ]),
    migrations: [],
    edgeDeployments: [],
    androidBuilds: [],
    inventoryImports: [],
    applicationRuntime:
      "Preserve actual closed 405058eb runtime and secrets; change exact source metadata and one new unused SMS window ID only. No project-level environment mutation.",
    phoneAttempt: {
      separateExplicitAuthorityRequired: true,
      founderOnly: true,
      installedV31: true,
      attended: true,
      maximumAttempts: 1,
      maximumAudCents: 100,
      maximumDurationSeconds: 7200,
      previousWindowReuse: false,
      automaticResend: false,
      closeAfterResult: true,
    },
    approvalValidityHours: 24,
    approvalStatus: "NOT_APPROVED",
    publicLaunchAuthorised: false,
    verification,
  };
  fs.writeFileSync(manifest, JSON.stringify(p, null, 2) + "\n");
  console.log(
    JSON.stringify({
      sourceCommit,
      packageSha256: sha(fs.readFileSync(manifest)),
      sourceFiles: files.length,
    }),
  );
} else {
  const bytes = fs.readFileSync(manifest),
    p = JSON.parse(bytes);
  assert.equal(sha(bytes), expected, "Exact manifest SHA required");
  assert.equal(p.baselineSource, baseline);
  const entries = [...p.sourceFiles, ...p.operatorFiles, ...p.reviewedFiles];
  const content = blobs(
    p.sourceCommit,
    entries.map((f) => f.file),
  );
  for (const f of entries)
    assert.equal(sha(content.get(f.file)), f.sha256, f.file);
  if (mode === "export") {
    assert(destination && !fs.existsSync(destination), "New empty export only");
    fs.mkdirSync(destination, { recursive: true });
    for (const [file, data] of content) {
      const target = path.join(destination, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
    }
    fs.mkdirSync(path.join(destination, directory), { recursive: true });
    fs.writeFileSync(path.join(destination, manifest), bytes);
  }
  console.log(
    JSON.stringify({
      verified: true,
      source: p.sourceCommit,
      packageSha256: expected,
      exported: mode === "export",
      networkRequests: 0,
    }),
  );
}
