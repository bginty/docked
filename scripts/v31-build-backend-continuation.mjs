// Offline package assembly. The SQL is already applied; this grants no authority.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { sha256, v31PackagePath } from "./lib/v31-exact-package.mjs";
const approvedDigest =
  "fd4c09520ee1ad82bb754abcc15b9af876c3fe8f570d464767f0d1a91a315ef1";
const original = execFileSync(
  "git",
  ["show", "02b6cdadb92e7d598a6f284ce2e548d8cbfd468a:" + v31PackagePath],
  { windowsHide: true },
);
assert.equal(sha256(original), approvedDigest);
const manifest = JSON.parse(original);
for (const file of manifest.files.filter((f) =>
  ["migration", "outbox"].includes(f.kind),
))
  assert.equal(
    sha256(readFileSync(file.path)),
    file.sha256,
    "Previously applied SQL changed",
  );
const applied = JSON.parse(
  readFileSync(
    "docs/qa/v31-prelaunch-execution-20261111/database/apply-result.json",
    "utf8",
  ),
);
assert.equal(applied.packageSha256, approvedDigest);
assert(
  applied.migrationCount === 5 &&
    applied.outboxApplied &&
    applied.protectedRowsUnchanged,
);
manifest.files = manifest.files.map((file) => ({
  ...file,
  sha256: sha256(readFileSync(file.path)),
}));
for (const path of [
  "scripts/lib/v31-dormant-runtime.mjs",
  "scripts/v31-committed-readback.ts",
])
  manifest.files.push({
    kind: "operator-dependency",
    path,
    sha256: sha256(readFileSync(path)),
  });
const readback = JSON.parse(
  readFileSync(
    "docs/qa/v31-overnight-20261112/committed-readback.json",
    "utf8",
  ),
);
const restored = JSON.parse(
  readFileSync(
    "docs/qa/v31-overnight-20261112/restored-inventory/restore-drill.json",
    "utf8",
  ),
);
assert(
  readback.protectedRecordsUnchanged &&
    restored.restored &&
    restored.protectedRecordsUnchanged,
);
manifest.sourceCatalogue = readback.catalogue;
manifest.sourceMemberships = readback.membership;
manifest.archiveSha256 = restored.archiveSha256;
manifest.backupDirectory = "private-data/commercial-restore-20261112";
manifest.restoreEvidence = "docs/qa/v31-overnight-20261112/restored-inventory";
manifest.version = "v31-20261112-application-only-continuation";
manifest.supersedesPackageSha256 = approvedDigest;
manifest.databaseStatus = {
  applied: true,
  at: applied.at,
  packageSha256: approvedDigest,
  repeatApplication: false,
  readbackBound: true,
};
manifest.approvalStatus = "NOT_APPROVED";
manifest.approvalScopes = ["backend-stage", "backend-promote"];
manifest.scope =
  "Application-only closed-gate staging and promotion with the digest-bound complete f1b50b6f runtime preserved. The five migrations and restricted outbox already committed under fd4c0952; no new or repeated Production SQL. Registration, SMS, inventory, payments/trading/prizes, deletion schedules, live keys and policy/Play publication excluded.";
writeFileSync(v31PackagePath, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  JSON.stringify({
    packageSha256: sha256(readFileSync(v31PackagePath)),
    approvalStatus: manifest.approvalStatus,
    databaseAlreadyApplied: true,
    productionWrites: 0,
  }),
);
