/** Exact-byte local approval packet. This script cannot deploy or connect to a database. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const directory = "docs/qa/batch1-pack-phone-20261116/";
const hash = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, { windowsHide: true, maxBuffer: 256e6 });
const read = (file) => JSON.parse(readFileSync(directory + file, "utf8"));
function digests(commit, files) {
  const bytes = execFileSync("git", ["cat-file", "--batch"], {
    input: files.map((file) => commit + ":" + file).join("\n") + "\n",
    windowsHide: true,
    maxBuffer: 256e6,
  });
  let offset = 0;
  const answer = files.map((file) => {
    const end = bytes.indexOf(10, offset),
      header = bytes.subarray(offset, end).toString();
    assert.match(header, /^[a-f0-9]+ blob \d+$/);
    const length = Number(header.split(" ")[2]),
      blob = bytes.subarray(end + 1, end + 1 + length);
    offset = end + 2 + length;
    return { file, sha256: hash(blob) };
  });
  assert.equal(offset, bytes.length);
  return answer;
}
const mode = process.argv[2];
assert(["prepare", "verify"].includes(mode));
if (mode === "prepare") {
  assert.equal(
    git("status", "--porcelain").toString().trim(),
    "",
    "Commit verified implementation/evidence before freezing",
  );
  const acceptance = read("acceptance-summary.json");
  assert.equal(acceptance.passed, true);
  const comparison = read("performance-summary.json");
  assert.equal(comparison.targetsMet, true);
  assert.equal(comparison.before.confirmation.n, 36);
  assert.equal(comparison.after.confirmation.n, 36);
  assert.equal(comparison.nineCardAcceptance.combined.confirmation.n, 48);
  assert(comparison.nineCardAcceptance.combined.confirmation.p95 < 5000);
  assert(comparison.nineCardAcceptance.supplemental.confirmation.p95 < 5000);
  const benchmark = read("benchmark-candidate.json");
  assert(benchmark.summary.confirmation.n >= 20);
  assert(
    benchmark.summary.confirmation.p95Ms < 5000,
    "Confirmation p95 target remains unmet",
  );
  assert(
    benchmark.summary["saved-recovery"].p95Ms < 2000,
    "Recovery p95 target remains unmet",
  );
  assert.equal(benchmark.rollbackVerified, true);
  const pg = read("postgres-acceptance.json"),
    schema = read("database-schema.json");
  assert.equal(pg.passed, true);
  assert(
    pg.purchaseDuplicateRequests >= 20 && pg.openingDuplicateRequests >= 20,
  );
  for (const key of [
    "otherFunctionBodiesUnchanged",
    "functionSecurityMetadataUnchanged",
    "tablePrivilegesAndRlsUnchanged",
    "policiesUnchanged",
  ])
    assert.equal(schema[key], true);
  const sourceCommit = git("rev-parse", "HEAD").toString().trim(),
    all = git("ls-tree", "-r", "--name-only", sourceCommit)
      .toString()
      .trim()
      .split("\n");
  const branch = git("branch", "--show-current").toString().trim();
  const hosting = JSON.parse(
    git("show", sourceCommit + ":vercel.json").toString(),
  );
  assert.equal(
    hosting.git?.deploymentEnabled?.[branch],
    false,
    "The implementation branch must not deploy automatically",
  );
  const prior = JSON.parse(
    readFileSync(
      "docs/qa/founder-credit-packs-20261115/production-package.json",
      "utf8",
    ),
  );
  const roots = new Set(prior.sourceFiles.map((f) => f.file.split("/")[0]));
  const app = all.filter(
    (file) => roots.has(file.split("/")[0]) && !file.startsWith("scripts/"),
  );
  for (const file of [
    "scripts/guard-hosted-build.mjs",
    ".vercelignore",
    "next-env.d.ts",
    ".nvmrc",
  ])
    if (all.includes(file) && !app.includes(file)) app.push(file);
  const migrationFiles = schema.migrations.map(
    (m) => "supabase/migrations/" + m.file,
  );
  const migrations = digests(sourceCommit, migrationFiles);
  assert.deepEqual(
    migrations.map((m) => m.sha256),
    schema.migrations.map((m) => m.sha256),
  );
  assert.deepEqual(
    migrations.map((m) => m.sha256),
    pg.migrations.map((m) => m.sha256),
  );
  const reviewed = all.filter(
    (file) =>
      file.startsWith(directory) ||
      file.startsWith("scripts/batch1-") ||
      file.startsWith("scripts/lib/batch1-") ||
      migrationFiles.includes(file),
  );
  const baseline = read("production-baseline.json");
  const finalReadback = read("production-final-readback.json");
  for (const key of [
    "release",
    "counts",
    "custodyRecords",
    "custodyDigest",
    "financialHashes",
  ])
    assert.deepEqual(
      finalReadback[key],
      baseline[key],
      "Production changed; reconcile and review before freezing " + key,
    );
  const packet = {
    version: "docked-batch1-pack-phone-20261116",
    sourceCommit,
    branch,
    automaticDeploymentDisabled: true,
    sourceTree: git("rev-parse", sourceCommit + "^{tree}")
      .toString()
      .trim(),
    baseline,
    finalReadback,
    teamId: "team_tf6xweKKyVCj9bTppUKttJ4l",
    projectId: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
    databaseProject: "pojoymtniryarxxunyvz",
    nodeVersion: "22.x",
    sourceFiles: digests(sourceCommit, app.sort()),
    reviewedFiles: digests(sourceCommit, reviewed.sort()),
    migrations,
    changedFunctions: schema.changedFunctions,
    approvalRequired: true,
    approvalDurationHours: 24,
    approvalRecorded: false,
    scope: {
      application: true,
      migrations: migrationFiles,
      existingInvitedFreeCreditBeta: "preserve",
      newGrants: false,
      automaticPurchases: false,
      registration: false,
      sms: false,
      paidCredits: false,
      commercialActivation: false,
      marketplace: false,
      inventoryImport: false,
      nba: false,
      prizes: false,
      withdrawals: false,
      realScoring: false,
      googlePlayPublication: false,
      retentionCleanup: false,
    },
    preconditions: {
      exactSourceAndHashes: true,
      authenticatedEncryptedBackupMaximumAgeMinutes: 60,
      verifiedIsolatedRestore: true,
      preflightMaximumAgeMinutes: 10,
      allRuntimeSettingsPreserved: true,
      unexplainedDrift: "abort",
      currentLifetimeAndCustody:
        "reconcile all legitimate later allocations; never reset to the recorded baseline",
    },
    recovery:
      "Transactional DDL failure rolls back all reviewed migrations. After application promotion, conditional app-only rollback to the freshly verified previous Production deployment preserves the compatible SQL optimisations. Never restore an old financial snapshot over subsequent legitimate activity. Stop writes and prepare reviewed forward recovery if an invariant fails.",
    readiness:
      "Isolated acceptance only; protected hosted and physical Android acceptance remain distinct gates",
    productionWritesDuringImplementation: 0,
  };
  const bytes = JSON.stringify(packet, null, 2) + "\n";
  writeFileSync(directory + "production-package.json", bytes, { flag: "wx" });
  console.log(
    JSON.stringify({
      sourceCommit,
      packageSha256: hash(bytes),
      migrations,
      approvalRecorded: false,
      productionWrites: 0,
    }),
  );
} else {
  const bytes = readFileSync(directory + "production-package.json"),
    packet = JSON.parse(bytes);
  assert.equal(
    git("rev-parse", packet.sourceCommit + "^{tree}")
      .toString()
      .trim(),
    packet.sourceTree,
  );
  const files = [...packet.sourceFiles, ...packet.reviewedFiles];
  assert.deepEqual(
    digests(
      packet.sourceCommit,
      files.map((f) => f.file),
    ),
    files,
  );
  assert.deepEqual(
    digests(
      packet.sourceCommit,
      packet.migrations.map((f) => f.file),
    ),
    packet.migrations,
  );
  console.log(
    JSON.stringify({
      verified: true,
      sourceCommit: packet.sourceCommit,
      packageSha256: hash(bytes),
      approvalRecorded: false,
      productionWrites: 0,
    }),
  );
}
