import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
export const v31PackagePath =
  "docs/qa/v31-prelaunch-execution-20261111/database/exact-package.json";
export const sha256 = (x) => createHash("sha256").update(x).digest("hex");
export function v31MigrationSql(manifest) {
  const quote = (x) => "'" + x.replaceAll("'", "''") + "'";
  const statements = [];
  for (const f of manifest.files.filter((f) => f.kind === "migration")) {
    const source = readFileSync(f.path, "utf8");
    assert.equal(sha256(source), f.sha256);
    statements.push(
      source,
      `insert into supabase_migrations.schema_migrations(version,name,statements) values (${quote(f.version)},${quote(f.name)},ARRAY[${quote(source)}]);`,
    );
  }
  const f = manifest.files.find((f) => f.kind === "outbox"),
    source = readFileSync(f.path, "utf8");
  assert.equal(sha256(source), f.sha256);
  assert.equal((source.match(/^begin;\r?$/gm) ?? []).length, 1);
  assert.equal((source.match(/^commit;\r?$/gm) ?? []).length, 1);
  statements.push(
    source.replace(/^begin;\r?$/m, "").replace(/^commit;\r?$/m, ""),
  );
  return statements.join("\n");
}
export function readExactPackage() {
  const bytes = readFileSync(v31PackagePath);
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.project, "pojoymtniryarxxunyvz");
  for (const f of manifest.files)
    assert.equal(
      sha256(readFileSync(f.path)),
      f.sha256,
      `Reviewed bytes changed: ${f.path}`,
    );
  return { manifest, digest: sha256(bytes) };
}
export function requireV31Approval(scope) {
  const { manifest, digest } = readExactPackage();
  if (manifest.approvalScopes)
    assert(
      manifest.approvalScopes.includes(scope),
      "This package excludes that execution scope",
    );
  const path = process.argv.find((v) => v.startsWith("--approval="))?.slice(11);
  assert(
    path,
    "Exact founder approval file required before any hosted mutation",
  );
  const approval = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(approval.approved, true);
  assert.equal(approval.packageSha256, digest);
  assert(Array.isArray(approval.scopes) && approval.scopes.includes(scope));
  assert.equal(
    approval.productionBaseline,
    "f1b50b6f51d7429a36df9a8d5db99aed8886bd44",
  );
  assert(
    typeof approval.authority === "string" &&
      approval.authority.trim().length >= 20,
  );
  const approvedAt = Date.parse(approval.approvedAt),
    expiresAt = Date.parse(approval.expiresAt);
  assert(
    Number.isFinite(approvedAt) &&
      approvedAt <= Date.now() + 60_000 &&
      expiresAt > Date.now() &&
      expiresAt > approvedAt &&
      expiresAt - approvedAt <= 24 * 3600_000,
    "Approval must cover a bounded window of at most 24 hours",
  );
  const sha = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  assert.equal(
    approval.reviewedCommit,
    sha,
    "Approval must name exact final reviewed commit",
  );
  const changed = execFileSync("git", ["diff", "HEAD", "--name-only"], {
    encoding: "utf8",
    windowsHide: true,
  })
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const executionEvidence =
    /^docs\/qa\/v31-prelaunch-execution-20261111\/(?:database\/(?!exact-package\.json$)|backend\/)/;
  assert(
    changed.every((f) => executionEvidence.test(f)),
    "Commit reviewed source/documentation changes first; only generated execution evidence may differ",
  );
  assert(
    approval.inventoryImport === false &&
      approval.commercialActivation === false &&
      approval.publicRegistration === false &&
      approval.playPublication === false,
  );
  return { manifest, approval, digest };
}
