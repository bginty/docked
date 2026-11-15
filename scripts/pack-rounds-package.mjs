/** Freeze or verify the exact review proposal. No database or deployment writes. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const dir = "docs/qa/pack-rounds-autofill-20261115/",
  mode = process.argv[2];
assert(["prepare", "verify"].includes(mode));
const sha = (b) => createHash("sha256").update(b).digest("hex");
const git = (...args) =>
  execFileSync("git", args, { windowsHide: true, maxBuffer: 512e6 });
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const digestFiles = (commit, files) => {
  const bytes = execFileSync("git", ["cat-file", "--batch"], {
    input: files.map((f) => commit + ":" + f).join("\n") + "\n",
    windowsHide: true,
    maxBuffer: 512e6,
  });
  let at = 0;
  const result = files.map((file) => {
    const end = bytes.indexOf(10, at),
      header = bytes.subarray(at, end).toString();
    assert.match(header, /^[a-f0-9]+ blob \d+$/);
    const n = Number(header.split(" ")[2]),
      b = bytes.subarray(end + 1, end + 1 + n);
    at = end + 2 + n;
    return { file, sha256: sha(b) };
  });
  assert.equal(at, bytes.length);
  return result;
};
if (mode === "prepare") {
  assert.equal(
    git("status", "--porcelain").toString().trim(),
    "",
    "Commit source and evidence before freezing",
  );
  const sourceCommit = git("rev-parse", "HEAD").toString().trim(),
    all = git("ls-tree", "-r", "--name-only", sourceCommit)
      .toString()
      .trim()
      .split("\n");
  const prior = read(
    "docs/qa/brenton-private-tester-20261115/deployment-package.json",
  );
  const validation = read(dir + "validation.json"),
    performance = read(dir + "restored-performance.json");
  assert.equal(validation.engineeringChecksPassed, true);
  assert.equal(performance.rollbackVerified, true);
  const migration =
    "supabase/migrations/20261115113306_batch_private_pack_issuance_validation.sql";
  const migrationSha256 = sha(git("show", sourceCommit + ":" + migration));
  assert.equal(migrationSha256, performance.migrationSha256);
  const sourceFiles = [
    ...new Set([
      ...prior.sourceFiles.map((f) => f.file),
      ...all.filter((f) => f.startsWith("src/")),
      "config/nfl-season-2026.json",
    ]),
  ]
    .filter((f) => all.includes(f))
    .sort();
  const changed = git("diff", "--name-only", prior.sourceCommit, sourceCommit)
    .toString()
    .trim()
    .split("\n");
  const reviewed = all
    .filter(
      (f) =>
        f.startsWith(dir) ||
        [".gitattributes", migration, "config/nfl-season-2026.json"].includes(
          f,
        ) ||
        (f.startsWith("src/") && changed.includes(f)) ||
        /^scripts\/pack-(rounds|recovery|performance|timeout)/.test(f) ||
        [
          "tests/platform/card-economy.test.ts",
          "tests/platform/premium-ux.test.ts",
          "tests/platform/nfl-season-navigation.test.ts",
        ].includes(f),
    )
    .filter(
      (f) =>
        !f.endsWith("deployment-package.json") &&
        !f.endsWith("DEPLOYMENT_APPROVAL.txt"),
    )
    .sort();
  const baseline = read(
    "docs/qa/brenton-private-tester-20261115/execution/deployment-promoted.json",
  );
  const packet = {
    version: "pack-recovery-rounds-autofill-v1",
    sourceCommit,
    sourceTree: git("rev-parse", sourceCommit + "^{tree}")
      .toString()
      .trim(),
    baseCommit: prior.sourceCommit,
    baseDeployment: baseline.id,
    projectId: prior.projectId,
    teamId: prior.teamId,
    databaseProject: prior.databaseProject,
    sourceFiles: digestFiles(sourceCommit, sourceFiles),
    reviewedFiles: digestFiles(sourceCommit, reviewed),
    migrations: [{ file: migration, sha256: migrationSha256 }],
    runtime: {
      preserveSettings: 97,
      permittedChanges: ["candidate source/deployment identity only"],
      recipeSha256:
        "f0261e9f4ff84c625f9d076489cf466cd065abc58fd2361a32984eb878dc96a6",
    },
    scope: {
      sqlFunctions: [
        "credits_sandbox.guard_economy_state()",
        "credits_sandbox.project_fixture_inventory()",
      ],
      newTables: 0,
      newPermissions: 0,
      newIssuanceByDeployment: 0,
      balanceChangesByDeployment: 0,
      registration: false,
      purchasedCredits: false,
      trading: false,
      sms: false,
      playPublication: false,
      scoringActivation: false,
      sourcePermissionRenewal: false,
      brentonExceptionPreserved: true,
    },
    requiredBeforePromotion: [
      "fresh verified encrypted backup and exact drift reconciliation",
      "clean protected hosted build and verification",
      "Android v31 acceptance of load and saved-request recovery",
      "current schedule rights/evidence gate or explicit acceptance of clearly labelled historical display only",
    ],
    recovery:
      "DEPLOYMENT_RUNBOOK.txt; conditional app-only rollback to verified Brenton baseline; original two function definitions preserved for transactional restore; no financial/ownership rollback",
  };
  const bytes = JSON.stringify(packet, null, 2) + "\n";
  writeFileSync(dir + "deployment-package.json", bytes, { flag: "wx" });
  console.log(
    JSON.stringify({
      sourceCommit,
      packageSha256: sha(bytes),
      applicationFiles: sourceFiles.length,
      reviewedFiles: reviewed.length,
      migrationSha256,
    }),
  );
} else {
  const packet = read(dir + "deployment-package.json");
  for (const group of [
    packet.sourceFiles,
    packet.reviewedFiles,
    packet.migrations,
  ])
    assert.deepEqual(
      digestFiles(
        packet.sourceCommit,
        group.map((f) => f.file),
      ),
      group,
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
