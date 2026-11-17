/** Local exact-byte freezer/verifier/exporter. No network, database or deployment. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = "docs/qa/public-launch-runtime-20261117/";
const baseline = "988ea0ba905e91d3c1cdf0c5e18812849b138968";
const branch = "codex/public-launch-runtime-20261117";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (...args) =>
  execFileSync("git", args, { windowsHide: true, maxBuffer: 256e6 });
const json = (file) => JSON.parse(readFileSync(file, "utf8"));
const roots = new Set([
  ".nvmrc",
  ".vercelignore",
  "certs",
  "config",
  "next-env.d.ts",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "public",
  "src",
  "tsconfig.json",
  "vercel.json",
]);
function blobs(commit, files) {
  const result = new Map();
  const bytes = execFileSync("git", ["cat-file", "--batch"], {
    input: files.map((file) => commit + ":" + file).join("\n") + "\n",
    windowsHide: true,
    maxBuffer: 256e6,
  });
  let offset = 0;
  for (const file of files) {
    const end = bytes.indexOf(10, offset);
    const header = bytes.subarray(offset, end).toString();
    assert.match(header, /^[a-f0-9]+ blob \d+$/);
    const length = Number(header.split(" ")[2]);
    result.set(file, bytes.subarray(end + 1, end + 1 + length));
    offset = end + length + 2;
  }
  assert.equal(offset, bytes.length);
  return result;
}
const digests = (commit, files) =>
  [...blobs(commit, files)].map(([file, bytes]) => ({
    file,
    sha256: sha(bytes),
  }));
const migrationFiles = [
  "supabase/migrations/20261116215032_public_sms_budget_guard.sql",
  "supabase/migrations/20261117091440_public_owner_support.sql",
];
const configChanges = ["config/hosted-production.json", "config/operations/public-runtime-closed.json", "config/operations/public-runtime-migrations.prepared.sql"];
const mode = process.argv[2];
assert(
  ["prepare", "verify", "export"].includes(mode),
  "Use prepare, verify <sha256> or export <sha256> <new-directory>",
);
if (mode === "prepare") {
  assert.equal(
    git("status", "--porcelain").toString().trim(),
    "",
    "Commit reviewed source/evidence first",
  );
  assert.equal(git("branch", "--show-current").toString().trim(), branch);
  const sourceCommit = git("rev-parse", "HEAD").toString().trim();
  const all = git("ls-tree", "-r", "--name-only", sourceCommit)
    .toString()
    .trim()
    .split("\n");
  const files = all
    .filter(
      (f) =>
        roots.has(f.split("/")[0]) || f === "scripts/guard-hosted-build.mjs",
    )
    .sort();
  const changed = git("diff", "--name-only", baseline, sourceCommit)
    .toString()
    .trim()
    .split("\n");
  assert(!changed.some(f => f.startsWith("android/")), "No native changes");
  assert(!changed.some(f => f.startsWith("supabase/") && !migrationFiles.includes(f)), "Only the two reviewed migrations");
  assert(!changed.some(f => f.startsWith("config/") && !configChanges.includes(f)), "Only reviewed closed configuration changes");
  const config = JSON.parse(git("show", sourceCommit + ":vercel.json"));
  assert.equal(config.git.deploymentEnabled[branch], false);
  assert.equal(json(dir + "build-result.json").exitCode, 0);
  assert.equal(json(dir + "verification-summary.json").targetedTests.failed, 0);
  assert.equal(json(dir + "restored-tests.json").passed, true);
  assert.equal(json(dir + "install-rehearsal.json").duplicateApplyDenied, true);
  assert.equal(json(dir + "install-rehearsal.json").sha256, sha(readFileSync("config/operations/public-runtime-migrations.prepared.sql")));
  const reviewed = all
    .filter(
      (f) =>
        (f.startsWith(dir) && !/production-package.json|DEPLOYMENT_APPROVAL.txt|HANDOVER.txt/.test(f)) ||
        f.startsWith("tests/platform/post-beta-owner") || f === "tests/platform/public-owner-support.test.ts" || migrationFiles.includes(f) ||
        [
          "scripts/public-launch-runtime-package.mjs",
          "scripts/public-launch-runtime-restored.mjs",
          "scripts/public-launch-runtime-install-rehearsal.mjs",
          "scripts/twilio-readiness-readonly.mjs",
        ].includes(f),
    )
    .sort();
  const packet = {
    version: "docked-public-launch-runtime-20261117",
    sourceCommit,
    sourceTree: git("rev-parse", sourceCommit + "^{tree}")
      .toString()
      .trim(),
    evidenceCommit: sourceCommit,
    branch,
    automaticGitDeploymentDisabled: true,
    projectId: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
    teamId: "team_tf6xweKKyVCj9bTppUKttJ4l",
    databaseProject: "pojoymtniryarxxunyvz",
    baselineSource: baseline,
    baselineDeployment: "dpl_Du8W6gJRXWBb3d6frPT7oVyhprwd",
    sourceFiles: digests(sourceCommit, files),
    changedRuntimeFiles: changed.filter((f) => files.includes(f)),
    migrations: digests(sourceCommit, migrationFiles),
    accountOperations: [],
    runtimeChanges: json("config/operations/public-runtime-closed.json"),
    dependencyChanges: ["next 16.4.3 -> 16.4.6; locked Next family only"],
    reviewedFiles: digests(sourceCommit, reviewed),
    scope:
      "Two reviewed inactive migrations and closed public-runtime application/configuration; protected staging, read-only hosted acceptance and promotion; conditional app/runtime rollback",
    excludes: [
      "account retirement or creation",
      "role changes",
      "asset restoration",
      "public registration",
      "SMS",
      "payments",
      "card issuance",
      "trading",
      "prizes",
      "withdrawals",
      "deletion schedules",
      "Play publication",
      "key rotation or new external access",
      "Android binary changes",
    ],
    freshBackupMaxAgeMinutes: 60,
    preflightMaxAgeMinutes: 10,
    preserveRuntime:
      "Preserve every value/binding except exact public-runtime-closed.json overrides; do not change old live deployment during staging",
    hostedAcceptance:
      "Required before promotion with own existing Owner MFA and candidate provenance; no provider bypass",
    physicalAndroid:
      "Existing Owner landing accepted in c18f7b00; Production signed-hook phone test remains separate (max2 attempts/A$2)",
    baselineObservation: json(dir + "production-baseline.json"),
    baselineIsResetTarget: false,
    approvalRequired: true,
    approvalRecorded: false,
    approvalDurationHours: 24,
    productionWritesDuringPreparation: 0,
    publicLaunch: "NO-GO",
    execution: dir + "EXECUTION.txt",
    review: dir + "REVIEW.txt",
  };
  const bytes = JSON.stringify(packet, null, 2) + "\n";
  writeFileSync(dir + "production-package.json", bytes, { flag: "wx" });
  console.log(
    JSON.stringify({
      sourceCommit,
      packageSha256: sha(bytes),
      sourceFiles: files.length,
      changedRuntimeFiles: packet.changedRuntimeFiles,
      migrations: packet.migrations.length,
      deploymentPerformed: false,
    }),
  );
} else {
  const bytes = readFileSync(dir + "production-package.json");
  assert.match(
    process.argv[3] ?? "",
    /^[a-f0-9]{64}$/,
    "Supply independently reviewed package SHA-256",
  );
  assert.equal(sha(bytes), process.argv[3], "Package differs from approval");
  const p = JSON.parse(bytes);
  assert.equal(p.baselineSource, baseline);
  assert.equal(
    git("rev-parse", p.sourceCommit + "^{tree}")
      .toString()
      .trim(),
    p.sourceTree,
  );
  assert.deepEqual(
    digests(
      p.sourceCommit,
      p.sourceFiles.map((f) => f.file),
    ),
    p.sourceFiles,
  );
  assert.deepEqual(
    digests(
      p.evidenceCommit,
      p.reviewedFiles.map((f) => f.file),
    ),
    p.reviewedFiles,
  );
  const expectedFiles = git("ls-tree", "-r", "--name-only", p.sourceCommit)
    .toString()
    .trim()
    .split("\n")
    .filter(
      (f) =>
        roots.has(f.split("/")[0]) || f === "scripts/guard-hosted-build.mjs",
    )
    .sort();
  assert.deepEqual(
    p.sourceFiles.map((f) => f.file),
    expectedFiles,
  );
  assert.deepEqual(p.migrations, digests(p.sourceCommit, migrationFiles));
  assert.equal(p.accountOperations.length, 0);
  assert.deepEqual(p.runtimeChanges, json("config/operations/public-runtime-closed.json"));
  // Git-normalised working bytes avoid false Windows CRLF drift. Batch the
  // paths so verification does not spawn thousands of separate Git processes.
  const checked = [
    ...new Set([...p.sourceFiles, ...p.reviewedFiles, ...p.migrations].map((f) => f.file)),
  ].sort();
  const objects = execFileSync("git", ["hash-object", "--stdin-paths"], {
    input: checked.join("\n") + "\n",
    windowsHide: true,
    maxBuffer: 16e6,
  })
    .toString()
    .trim()
    .split("\n");
  const tree = new Map(
    git("ls-tree", "-r", p.sourceCommit)
      .toString()
      .trim()
      .split("\n")
      .map((line) => {
        const [meta, file] = line.split("\t");
        return [file, meta.split(" ")[2]];
      }),
  );
  checked.forEach((file, index) =>
    assert.equal(
      objects[index],
      tree.get(file),
      "Working bytes changed: " + file,
    ),
  );
  if (mode === "export") {
    const target = path.resolve(process.argv[4] ?? "");
    assert(
      process.argv[4] && !existsSync(target),
      "Export requires a new empty destination; never overwrite",
    );
    mkdirSync(target, { recursive: true });
    for (const [file, body] of blobs(p.sourceCommit, expectedFiles)) {
      assert(!path.isAbsolute(file) && !file.split("/").includes(".."));
      const dest = path.resolve(target, file);
      assert(dest.startsWith(target + path.sep));
      mkdirSync(path.dirname(dest), { recursive: true });
      writeFileSync(dest, body, { flag: "wx" });
      assert.equal(
        sha(readFileSync(dest)),
        p.sourceFiles.find((f) => f.file === file).sha256,
      );
    }
  }
  console.log(
    JSON.stringify({
      sourceCommit: p.sourceCommit,
      packageSha256: sha(bytes),
      verified: true,
      exported: mode === "export",
      networkOrDatabaseAccess: false,
      deploymentPerformed: false,
    }),
  );
}
