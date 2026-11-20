/** Offline exact Git-byte manifest/export; never deploys, enables or sends. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
const directory = "docs/qa/google-refund-repair-20261120/";
const manifest = directory + "package.json";
const baseline = "6e96e61192b82ee576aa0a8365808081a98b30fa";
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
    "Commit all reviewed changes before freezing",
  );
  assert.equal(git("branch", "--show-current").toString().trim(), branch);
  const sourceCommit = git("rev-parse", "HEAD").toString().trim();
  const previous = fs.readFileSync(
    "docs/qa/sms-hook-repair-20261118/package.json",
  );
  assert.equal(
    sha(previous),
    "632eed5b7d5fd5b41265775ec3a3810e5b79d05c21ecf2bed230501fe0b4374b",
  );
  const prior = JSON.parse(previous);
  assert.equal(prior.sourceCommit, baseline);
  const modified = [
    "src/app/api/store/google/commercial/notifications/route.ts",
    "src/app/api/store/google/notifications/route.ts",
    "src/app/api/store/google/scheduled/route.ts",
    "src/server/commercial-reconciliation.ts",
    "src/server/google-reconciliation-services.ts",
    "src/server/member-google-reconciliation.ts",
  ];
  const added = [
    "config/operations/google-refund-repair.json",
    "src/server/commercial-google-notification-handler.ts",
  ];
  const files = prior.sourceFiles
    .map((entry) => entry.file)
    .concat(added)
    .sort();
  const changed = git("diff", "--name-only", baseline, sourceCommit)
    .toString()
    .trim()
    .split("\n");
  assert.deepEqual(
    changed.filter((file) => files.includes(file)).sort(),
    [...modified, ...added].sort(),
  );
  assert(
    !changed.some(
      (file) =>
        file.startsWith("android/") ||
        file.startsWith("supabase/") ||
        (/^(src|public|config)\//.test(file) && !files.includes(file)),
    ),
  );
  assert.equal(
    JSON.parse(git("show", sourceCommit + ":vercel.json")).git
      .deploymentEnabled[branch],
    false,
  );
  const operators = prior.operatorFiles.map((entry) => entry.file);
  assert.deepEqual(digests(sourceCommit, operators), prior.operatorFiles);
  const verification = JSON.parse(
    fs.readFileSync(directory + "verification.json"),
  );
  assert.equal(verification.isolatedPassed, true);
  const localReview = git(
    "ls-tree",
    "-r",
    "--name-only",
    sourceCommit,
    "--",
    directory,
  )
    .toString()
    .trim()
    .split("\n");
  const reviewed = [
    ...localReview,
    ".gitattributes",
    "tests/platform/google-reconciliation-services.test.ts",
    "docs/qa/final-release-decision-20261117/historical-google-revalidated.json",
    "docs/qa/v31-prelaunch-execution-20261111/database/restore-20261120f/restore-only.json",
    "docs/qa/v31-prelaunch-execution-20261111/database/restore-20261120g/restore-only.json",
    "docs/qa/coordinated-paid-launch-20261120/HANDOVER.md",
    "docs/qa/coordinated-paid-launch-20261120/closed-postflight.json",
  ];
  const pkg = {
    version: "google-refund-repair-20261120",
    sourceCommit,
    branch,
    sourceTree: git("rev-parse", sourceCommit + "^{tree}")
      .toString()
      .trim(),
    baselineSource: baseline,
    baselineDeployment: "dpl_yV2vyZb1FQgdTciY2gHk25JtXVt8",
    projectId: prior.projectId,
    teamId: prior.teamId,
    databaseProject: prior.databaseProject,
    sourceFiles: digests(sourceCommit, files),
    operatorFiles: digests(sourceCommit, operators),
    reviewedFiles: digests(sourceCommit, reviewed.sort()),
    changedSource: [...modified, ...added].sort(),
    runtimeOverlay: JSON.parse(
      git(
        "show",
        sourceCommit + ":config/operations/google-refund-repair.json",
      ),
    ),
    migrations: [],
    googleCloudChanges: [],
    androidBuilds: [],
    approvalValidityHours: 24,
    googlePlayTestNotificationMaximum: 1,
    publicLaunchAuthorised: false,
  };
  fs.writeFileSync(manifest, JSON.stringify(pkg, null, 2) + "\n");
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
    for (const { file } of p.sourceFiles) {
      const data = content.get(file);
      const target = path.join(destination, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, data);
    }
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
