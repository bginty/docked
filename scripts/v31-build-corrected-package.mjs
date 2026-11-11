// Offline, evidence-bound replacement for the failed v1 package. Not approval.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { sha256, v31PackagePath } from "./lib/v31-exact-package.mjs";
const out = "docs/qa/v31-prelaunch-execution-20261111/database";
const fix = out + "/retention-role-correction";
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const original = execFileSync(
  "git",
  ["show", "47754edfd8abfac7a32ce62212c0374636441c41:" + v31PackagePath],
  { windowsHide: true },
);
assert.equal(
  sha256(original),
  "3aa30b20eddd33835e43ee721e598743897c3663f193d2c041dbe9d62dc9840e",
);
const manifest = JSON.parse(original);
const restored = read(fix + "/full-restore/restore-drill.json"),
  atomic = read(fix + "/atomic-rehearsal.json"),
  outbox = read(fix + "/restored-outbox.json");
assert(
  restored.restored &&
    restored.protectedRecordsUnchanged &&
    restored.migrationsReapplied &&
    restored.operatorSuperuser === false &&
    restored.effectiveMembershipOptionsMatch,
);
assert(
  atomic.passed &&
    atomic.rolledBack &&
    atomic.catalogueUnchangedAfterRollback &&
    atomic.postgresSuperuser === false,
);
assert(outbox.appliedTwice && outbox.protectedRowsUnchanged);
assert.equal(outbox.target, restored.restoreTarget);
assert.equal(atomic.target, restored.restoreTarget);
assert.equal(restored.archiveSha256, manifest.archiveSha256);
for (const f of atomic.files) {
  assert.equal(sha256(readFileSync(f.path)), f.sha256);
  if (f.kind === "migration")
    assert.equal(
      restored.migrations.find((m) => f.path.endsWith("/" + m.file))?.sha256,
      f.sha256,
    );
}
manifest.files = [
  ...atomic.files,
  ...manifest.files
    .filter((f) => f.kind === "operator-dependency")
    .map((f) => ({ ...f, sha256: sha256(readFileSync(f.path)) })),
];
manifest.version = "v31-dormant-backend-20261111-v2-hosted-permissions";
manifest.supersedesPackageSha256 = sha256(original);
manifest.sourceMemberships = {
  fingerprint: "ebd778dd5382b92f253e8ebeec994294",
  memberships: 34,
};
manifest.atomicEvidence = fix + "/atomic-rehearsal.json";
manifest.outboxEvidence = fix + "/restored-outbox.json";
manifest.approvalStatus = "NOT_APPROVED";
manifest.scope =
  "Five ordered dormant migrations with hosted-permission corrections, restricted outbox permissions and controlled closed-gate backend deployment. No inventory import, public registration, phone sending, commercial activation, Play/policy publication, live-key changes or deletion schedule.";
for (const name of ["restore-drill.json", "preflight.txt", "postflight.txt"])
  copyFileSync(
    fix + "/full-restore/" + name,
    manifest.restoreEvidence + "/" + name,
  );
writeFileSync(v31PackagePath, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  JSON.stringify({
    path: v31PackagePath,
    sha256: sha256(readFileSync(v31PackagePath)),
    approvalStatus: manifest.approvalStatus,
    productionWrites: 0,
  }),
);
