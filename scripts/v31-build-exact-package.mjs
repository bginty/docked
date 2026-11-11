// Offline package generation. Run after final script review/formatting, before approval.
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { sha256, v31PackagePath } from "./lib/v31-exact-package.mjs";
const read = (p) => JSON.parse(readFileSync(p, "utf8"));
const prior = read(
  "docs/qa/v31-final-reconciliation-20261110/migration-manifest.json",
);
const out = "docs/qa/v31-prelaunch-execution-20261111/database";
const runId = process.env.DOCKED_RESTORE_RUN ?? "20261111";
assert.match(runId, /^2026\d{4}[a-z]?$/);
const restored = read(`${out}/restore-${runId}/restore-drill.json`),
  permissions = read(`${out}/restored-outbox.json`);
assert(
  restored.protectedRecordsUnchanged &&
    restored.migrationsReapplied &&
    permissions.appliedTwice &&
    permissions.protectedRowsUnchanged,
);
assert.equal(permissions.target, `docked-commercial-restore-${runId}`);
const files = prior.migrations.map((m) => ({
  kind: "migration",
  path: `supabase/migrations/${m.file}`,
  sha256: m.sha256,
  version: m.file.slice(0, 14),
  name: m.file.slice(15, -4),
}));
files.push({
  kind: "outbox",
  path: prior.additionalPermissionPackage.path,
  sha256: prior.additionalPermissionPackage.rawSha256,
});
for (const path of [
  "scripts/v31-approved-backend-migrations.mjs",
  "scripts/v31-controlled-backend.mjs",
  "scripts/lib/v31-exact-package.mjs",
  "scripts/lib/v31-schema-fingerprint.ts",
  "scripts/nba-private-beta-release.mjs",
  "src/core/hosted-beta.mjs",
  "config/hosted-beta.json",
])
  files.push({
    kind: "operator-dependency",
    path,
    sha256: sha256(readFileSync(path)),
  });
for (const f of files) assert.equal(sha256(readFileSync(f.path)), f.sha256);
const manifest = {
  version: "v31-dormant-backend-20261111-v1",
  project: "pojoymtniryarxxunyvz",
  productionBaseline: "f1b50b6f51d7429a36df9a8d5db99aed8886bd44",
  sourceCatalogue: read(`${out}/live-catalog.json`).catalogue,
  archiveSha256: restored.archiveSha256,
  backupDirectory: `private-data/commercial-restore-${runId}`,
  restoreEvidence: `${out}/restore-${runId}`,
  files,
  scope:
    "Five ordered dormant migrations and restricted outbox permissions; controlled closed-gate backend deployment. No inventory import, public registration, commercial activation, Play publication or deletion schedule.",
  approvalStatus: "NOT_APPROVED",
};
writeFileSync(v31PackagePath, JSON.stringify(manifest, null, 2) + "\n");
console.log(
  JSON.stringify({
    path: v31PackagePath,
    sha256: sha256(readFileSync(v31PackagePath)),
    migrationCount: 5,
    productionWrites: 0,
  }),
);
