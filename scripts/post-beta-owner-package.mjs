/** Local exact-byte freezer/verifier/exporter. No network, database or deployment. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const dir = "docs/qa/post-beta-owner-login-20261117/";
const baseline = "9e57c094cb7b4af02277e191a2e64fa2e6b22c6b";
const branch = "codex/post-beta-owner-login-20261117";
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
  assert(
    !changed.some((f) => /^(supabase|android|config)\//.test(f)),
    "No SQL, config, or native change authorised",
  );
  assert(
    !changed.includes("package.json") && !changed.includes("package-lock.json"),
    "No dependency changes",
  );
  const config = JSON.parse(git("show", sourceCommit + ":vercel.json"));
  assert.equal(config.git.deploymentEnabled[branch], false);
  assert.equal(json(dir + "build-result.json").exitCode, 0);
  assert.equal(json(dir + "verification-summary.json").targetedTests.failed, 0);
  const reviewed = all
    .filter(
      (f) =>
        f.startsWith(dir) ||
        f.startsWith("tests/platform/post-beta-owner") ||
        [
          "scripts/post-beta-owner-browser.mjs",
          "scripts/post-beta-owner-package.mjs",
        ].includes(f),
    )
    .sort();
  const packet = {
    version: "docked-post-beta-owner-login-20261117",
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
    baselineDeployment: "dpl_ZNUTkFD88udQGYcdnJ8eJaUZ5QBq",
    sourceFiles: digests(sourceCommit, files),
    changedRuntimeFiles: changed.filter((f) => files.includes(f)),
    migrations: [],
    accountOperations: [],
    runtimeChanges: [],
    dependencyChanges: [],
    reviewedFiles: digests(sourceCommit, reviewed),
    scope:
      "Application-only protected staging, promotion, read-only verification; conditional app-only rollback to exact retirement-aware baseline",
    excludes: [
      "SQL",
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
      "secret changes",
      "Android binary changes",
    ],
    freshBackupMaxAgeMinutes: 60,
    preflightMaxAgeMinutes: 10,
    preserveRuntime:
      "Exact readable values; unchanged write-only secret IDs/targets/timestamps/bindings; no environment mutation",
    hostedAcceptance:
      "Required before promotion with own existing Owner MFA and candidate provenance; no provider bypass",
    physicalAndroid:
      "Pending; local mobile component tests are not device acceptance",
    baselineObservation: json(dir + "production-readonly.json"),
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
      migrations: 0,
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
  assert.equal(
    p.migrations.length + p.accountOperations.length + p.runtimeChanges.length,
    0,
  );
  // Git-normalised working bytes avoid false Windows CRLF drift. Batch the
  // paths so verification does not spawn thousands of separate Git processes.
  const checked = [
    ...new Set([...p.sourceFiles, ...p.reviewedFiles].map((f) => f.file)),
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
