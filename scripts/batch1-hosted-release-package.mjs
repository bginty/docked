/** Local-only exact-byte freezer/verifier. No deployment, database or network access. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const dir = "docs/qa/batch1-hosted-release-20261116/";
const source = "76df44ba1adef012c5ec2119563cbc05ff9e3c0b";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (...args) => execFileSync("git", args, { windowsHide: true, maxBuffer: 256e6 });
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
function digests(commit, files) {
  const bytes = execFileSync("git", ["cat-file", "--batch"], {
    input: files.map((file) => commit + ":" + file).join("\n") + "\n",
    windowsHide: true, maxBuffer: 256e6,
  });
  let offset = 0;
  const result = files.map((file) => {
    const end = bytes.indexOf(10, offset), header = bytes.subarray(offset, end).toString();
    assert.match(header, /^[a-f0-9]+ blob \d+$/);
    const length = Number(header.split(" ")[2]);
    const blob = bytes.subarray(end + 1, end + 1 + length);
    offset = end + 2 + length;
    return { file, sha256: hash(blob) };
  });
  assert.equal(offset, bytes.length);
  return result;
}
const mode = process.argv[2];
assert(["prepare", "verify"].includes(mode));
if (mode === "prepare") {
  assert.equal(git("status", "--porcelain").toString().trim(), "", "Commit evidence first");
  const evidenceCommit = git("rev-parse", "HEAD").toString().trim();
  const prior = read("docs/qa/batch1-pack-phone-20261116/production-package.json");
  const roots = new Set(prior.sourceFiles.map((f) => f.file.split("/")[0]));
  const all = git("ls-tree", "-r", "--name-only", source).toString().trim().split("\n");
  const app = all.filter((f) => roots.has(f.split("/")[0]) && !f.startsWith("scripts/"));
  for (const f of ["scripts/guard-hosted-build.mjs", ".vercelignore", "next-env.d.ts", ".nvmrc"])
    if (all.includes(f) && !app.includes(f)) app.push(f);
  const sourceFiles = digests(source, app.sort());
  // Evidence/driver commits must not substitute different application bytes.
  assert.deepEqual(digests(evidenceCommit, app), sourceFiles);
  const schema = read("docs/qa/batch1-pack-phone-20261116/database-schema.json");
  const migrations = digests(source, schema.migrations.map((m) => "supabase/migrations/" + m.file));
  assert.deepEqual(migrations.map((m) => m.sha256), schema.migrations.map((m) => m.sha256));
  const acceptance = read(dir + "hosted-acceptance-summary.json");
  assert.equal(acceptance.minimumHostedSafetyGatePassed, true);
  assert.equal(acceptance.cleanup.existingTablesVerified, 438);
  assert.equal(acceptance.cleanup.schemasRemoved, 12);
  assert.equal(acceptance.cleanup.rolesRemoved, 2);
  const branch = git("branch", "--show-current").toString().trim();
  assert.equal(JSON.parse(git("show", source + ":vercel.json")).git.deploymentEnabled[branch], false);
  const evidenceFiles = read(dir + "evidence-index.json").files;
  const reviewed = [...new Set([...evidenceFiles, "scripts/batch1-hosted-release-package.mjs", "scripts/batch1-hosted-http.ts"])].sort();
  const packet = {
    version: "docked-batch1-hosted-accepted-20261116",
    sourceCommit: source,
    sourceTree: git("rev-parse", source + "^{tree}").toString().trim(),
    evidenceCommit, branch, automaticDeploymentDisabled: true,
    projectId: prior.projectId, teamId: prior.teamId, databaseProject: prior.databaseProject,
    nodeVersion: "22.x", sourceFiles, migrations, changedFunctions: schema.changedFunctions,
    reviewedFiles: digests(evidenceCommit, reviewed),
    baselineObservation: read("docs/qa/batch1-beta-alignment-20261116/current-production-readonly.json"),
    baselineIsResetTarget: false,
    approvalRequired: true, approvalRecorded: false, approvalDurationHours: 24,
    scope: prior.scope,
    preconditions: {
      ...prior.preconditions,
      previewAcceptanceModeInProduction: "OFF or absent; exact Preview identity guards must still reject Production",
      productionTargetProtectedStaging: true,
      fullEffectiveRuntimeSnapshot: "fresh capture and compare under separate approval; not yet independently captured in this hosted test",
      noAutomaticTestPurchasesOrGrants: true,
    },
    acceptance: {
      minimumHostedSafetyGate: "passed with documented limitations",
      productionWebsiteAndPhysicalAndroid: "pending separately approved deployment and tester participation",
      actualGooglePaymentAndRefund: "not performed",
      sms: "not performed",
    },
    review: dir + "DEPLOYMENT_REVIEW.txt",
    execution: dir + "EXECUTION.txt",
    betaAcceptance: dir + "PRODUCTION_BETA_ACCEPTANCE.txt",
    recovery: prior.recovery,
    expectedWriteInterruption: "up to two minutes in a quiet beta window; abort on lock timeout",
    productionWritesDuringPreparation: 0,
  };
  const bytes = JSON.stringify(packet, null, 2) + "\n";
  writeFileSync(dir + "production-package.json", bytes, { flag: "wx" });
  console.log(JSON.stringify({ sourceCommit: source, evidenceCommit, packageSha256: hash(bytes), applicationFiles: sourceFiles.length, migrations, productionApprovalRecorded: false }));
} else {
  const bytes = readFileSync(dir + "production-package.json"), p = JSON.parse(bytes);
  assert.equal(p.sourceCommit, source);
  assert.equal(git("rev-parse", source + "^{tree}").toString().trim(), p.sourceTree);
  assert.deepEqual(digests(source, p.sourceFiles.map((f) => f.file)), p.sourceFiles);
  assert.deepEqual(digests(source, p.migrations.map((f) => f.file)), p.migrations);
  assert.deepEqual(digests(p.evidenceCommit, p.reviewedFiles.map((f) => f.file)), p.reviewedFiles);
  for (const f of [...p.migrations, ...p.reviewedFiles])
    assert.equal(hash(readFileSync(f.file)), f.sha256, "Working reviewed bytes changed: " + f.file);
  console.log(JSON.stringify({ sourceCommit: source, evidenceCommit: p.evidenceCommit, packageSha256: hash(bytes), verified: true, networkOrDatabaseAccess: false }));
}
