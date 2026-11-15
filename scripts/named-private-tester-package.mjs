/** Freeze/verify reviewed Git bytes only. No deployment, Auth or database access. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const dir = "docs/qa/brenton-private-tester-20261115/",
  mode = process.argv[2];
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, { windowsHide: true, maxBuffer: 512e6 });
const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const bytes = (commit, file) => git("show", commit + ":" + file);
const digests = (commit, files) => {
  const buffer = execFileSync("git", ["cat-file", "--batch"], {
    input: files.map((file) => commit + ":" + file).join("\n") + "\n",
    windowsHide: true,
    maxBuffer: 512e6,
  });
  let offset = 0;
  const results = files.map((file) => {
    const end = buffer.indexOf(10, offset),
      header = buffer.subarray(offset, end).toString();
    assert.match(header, /^[a-f0-9]+ blob \d+$/);
    const size = Number(header.split(" ")[2]);
    const result = {
      file,
      sha256: sha(buffer.subarray(end + 1, end + 1 + size)),
    };
    offset = end + 2 + size;
    return result;
  });
  assert.equal(offset, buffer.length);
  return results;
};
assert(["prepare", "verify"].includes(mode));
if (mode === "prepare") {
  assert.equal(
    git("status", "--porcelain").toString().trim(),
    "",
    "Commit source and evidence first",
  );
  const sourceCommit = git("rev-parse", "HEAD").toString().trim();
  const all = git("ls-tree", "-r", "--name-only", sourceCommit)
    .toString()
    .trim()
    .split("\n");
  const prior = read(
    "docs/qa/founder-credit-packs-20261115/production-package.json",
  );
  const baseline = read(dir + "production-baseline.json"),
    rehearsal = read(dir + "restored-acceptance.json"),
    validation = read(dir + "validation.json");
  assert.equal(
    baseline.live.commit,
    "4cfd826bc535f658d9a16c7a5b54d32ffeb07a40",
  );
  assert.equal(baseline.controls.registration, false);
  assert.equal(baseline.controls.commercial, false);
  assert.equal(rehearsal.passed, true);
  assert.equal(rehearsal.productionWrites, 0);
  assert.equal(validation.passed, true);
  const sourceFiles = [
    ...new Set([
      ...prior.sourceFiles.map((f) => f.file),
      ...all.filter((f) => f.startsWith("src/")),
    ]),
  ]
    .filter((f) => all.includes(f))
    .sort();
  const changed = git("diff", "--name-only", baseline.live.commit, sourceCommit)
    .toString()
    .trim()
    .split("\n");
  const reviewed = all
    .filter(
      (f) =>
        f.startsWith("scripts/named-private-tester") ||
        f.startsWith("scripts/lib/named-tester") ||
        (f.startsWith("tests/") && f.includes("named-private-tester")) ||
        f === "tests/database/customer-invitation.test.ts" ||
        (f.startsWith(dir) &&
          !f.endsWith("deployment-package.json") &&
          !f.endsWith("DEPLOYMENT_APPROVAL.txt")) ||
        f === ".gitattributes" ||
        f ===
          "supabase/migrations/20261115092124_named_private_tester_exception.sql" ||
        (f.startsWith("src/") && changed.includes(f)),
    )
    .sort();
  const runtimeFile =
      "private-data/founder-credit-packs-20261115/runtime-deployment.private.json",
    runtime = read(runtimeFile);
  const packet = {
    version: "named-us-private-tester-v1",
    sourceCommit,
    sourceTree: git("rev-parse", sourceCommit + "^{tree}")
      .toString()
      .trim(),
    baseCommit: baseline.live.commit,
    baseDeployment: baseline.live.deploymentId,
    projectId: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
    teamId: "team_tf6xweKKyVCj9bTppUKttJ4l",
    databaseProject: "pojoymtniryarxxunyvz",
    sourceFiles: digests(sourceCommit, sourceFiles),
    reviewedFiles: digests(sourceCommit, reviewed),
    schemaBaselineSha256: baseline.schemaFingerprint,
    runtime: {
      recipeFile: runtimeFile,
      recipeSha256: sha(JSON.stringify(runtime)),
      settings: Object.keys(runtime).length,
      permittedChanges: ["candidate commit/deployment identity only"],
    },
    migration: {
      file: "supabase/migrations/20261115092124_named_private_tester_exception.sql",
      sha256: rehearsal.migrationSha256,
    },
    scope: {
      accountId: "d6ab4838-7108-4c50-8ab8-c5947ab55bd8",
      country: "US",
      state: "CA",
      newAccounts: 0,
      staffGrants: 0,
      initialPasswordSupport: true,
      administrativeEmailConfirmation: true,
      automatedInboxVerification: false,
      ownConsentRequired: true,
      setupWindowDays: 7,
      creditTarget: 100000,
      creditGrantRequiresExistingFounderMfa: true,
      automaticCreditGrants: 0,
      automaticPackPurchases: 0,
      permanentSupplyUnchanged: true,
      publicRegistration: false,
      creditPurchases: false,
      trading: false,
      sms: false,
      nba: false,
      googlePlayPublication: false,
    },
    requirements: {
      approvalHours: 24,
      backupMaxAgeMinutes: 60,
      preflightMaxAgeMinutes: 10,
      freshBackupRestore: true,
      unchangedRuntime: true,
      protectedStagingAndVerification: true,
      shortLockTimeoutSeconds: 3,
      preserveCurrentIssuanceRatherThanOldSnapshot: true,
    },
    recovery:
      "Reviewed DEPLOYMENT_RUNBOOK.txt; revoke only the named exception, retain audit/consent/balances/cards; no automatic password reset retry",
  };
  assert.equal(
    packet.migration.sha256,
    sha(bytes(sourceCommit, packet.migration.file)),
  );
  const output = JSON.stringify(packet, null, 2) + "\n";
  writeFileSync(dir + "deployment-package.json", output);
  const hash = sha(output);
  writeFileSync(
    dir + "DEPLOYMENT_APPROVAL.txt",
    `BRENTON-ONLY US PRIVATE TESTER — EXACT DEPLOYMENT APPROVAL\n\nSource: ${sourceCommit}\nPackage SHA-256: ${hash}\n\nApprove for 24 hours: the single migration below, protected application staging/promotion after fresh backup/drift checks, and the one-account support provisioning operator. This records US/CA truthfully, preserves all current cards/ownership and adds no staff permissions or general US eligibility.\n\nMigration: ${packet.migration.file}\nSHA-256: ${packet.migration.sha256}\n\nBrenton receives a private initial email/password login after deployment; he completes his own age, Terms, Privacy and personal testing notice. Your already-requested 100,000 FREE-credit target is executed through the existing founder MFA/ledger only after that acceptance, with a fresh balance/campaign check. No automatic grants or purchases.\n\nRegistration, bought credits, real payments, trading, SMS, NBA, scored competitions and Play publication remain disabled. Existing invited private pack access stays intact. No previous migration, inventory import or key change is repeated.\n\nReview REVIEW_SCOPE.txt, DEPLOYMENT_RUNBOOK.txt, restored-acceptance.json, validation.json and production-baseline.json in this directory. On failure, revoke the personal exception; preserve all data. Initial passwords cannot be rolled back automatically.\n\nYour existing exact-package Production rule and the separate preparation approval require this final deployment approval. This document records no approval by itself.\n`,
  );
  console.log(
    JSON.stringify({
      sourceCommit,
      packageSha256: hash,
      migration: packet.migration,
      sourceFiles: sourceFiles.length,
      reviewedFiles: reviewed.length,
    }),
  );
} else {
  const packet = read(dir + "deployment-package.json");
  const expected = new Map(
    [...packet.sourceFiles, ...packet.reviewedFiles].map((f) => [
      f.file,
      f.sha256,
    ]),
  );
  for (const f of digests(packet.sourceCommit, [...expected.keys()]))
    assert.equal(f.sha256, expected.get(f.file), f.file);
  for (const f of packet.reviewedFiles)
    assert.equal(
      sha(readFileSync(f.file)),
      f.sha256,
      "Working bytes differ: " + f.file,
    );
  assert.equal(
    sha(readFileSync(packet.migration.file)),
    packet.migration.sha256,
  );
  console.log(
    JSON.stringify({
      verified: true,
      sourceCommit: packet.sourceCommit,
      packageSha256: sha(readFileSync(dir + "deployment-package.json")),
      productionWrites: 0,
    }),
  );
}
