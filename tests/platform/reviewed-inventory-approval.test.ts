import test from "node:test";
import assert from "node:assert/strict";
import { validateFreshPreflight, validateImportApproval, validateInventoryPreflight } from "../../scripts/v31-reviewed-inventory-operator";

const now = Date.parse("2026-11-11T06:00:00Z");
const expected = { planSha256: "1".repeat(64), registrationDigest: "2".repeat(64), operatorPackageDigest: "3".repeat(64) };
const valid = {
  approved: true, scope: "v31-preservation-only-inventory-import", projectRef: "pojoymtniryarxxunyvz", ...expected,
  preservationOnly: true, newIssuance: false, sales: false, publicRegistration: false, ownershipChanges: false, betaCatalogueChanges: false,
  approvalReference: "Synthetic unit-test approval only",
  approvedAt: "2026-11-11T05:50:00Z", expiresAt: "2026-11-11T06:30:00Z", backupCapturedAt: "2026-11-11T05:55:00Z",
  preflightSha256: "4".repeat(64), backupManifestSha256: "5".repeat(64), backupArchiveSha256: "6".repeat(64),
};

test("inventory approval requires the exact target, manifest, registration and transitive code package", () => {
  validateImportApproval(valid, expected, now);
  for (const field of ["projectRef", "planSha256", "registrationDigest", "operatorPackageDigest", "scope"])
    assert.throws(() => validateImportApproval({ ...valid, [field]: "different" }, expected, now));
  assert.throws(() => validateImportApproval({ ...valid, approved: false }, expected, now));
  assert.throws(() => validateImportApproval({ ...valid, approvalReference: "" }, expected, now));
});

test("inventory approval never grants activation, new cards or owner/catalogue changes", () => {
  for (const field of ["newIssuance", "sales", "publicRegistration", "ownershipChanges", "betaCatalogueChanges"])
    assert.throws(() => validateImportApproval({ ...valid, [field]: true }, expected, now));
  assert.throws(() => validateImportApproval({ ...valid, preservationOnly: false }, expected, now));
});

test("expired or future approval, stale backup and unbound backup artifacts fail closed", () => {
  for (const patch of [
    { expiresAt: "2026-11-11T05:59:59Z" }, { approvedAt: "2026-11-11T06:01:00Z" },
    { expiresAt: "2026-11-13T06:00:00Z" }, { approvedAt: "invalid" },
    { backupCapturedAt: "2026-11-11T04:59:59Z" }, { backupCapturedAt: "2026-11-11T06:00:01Z" },
    { preflightSha256: "" }, { backupManifestSha256: null }, { backupArchiveSha256: "wrong" },
  ]) assert.throws(() => validateImportApproval({ ...valid, ...patch }, expected, now));
});

test("preflight age accepts ten minutes and rejects stale, future and malformed captures", () => {
  validateFreshPreflight({ capturedAt: "2026-11-11T05:50:00Z" }, now);
  for (const capturedAt of ["2026-11-11T05:49:59Z", "2026-11-11T06:00:01Z", "invalid", undefined])
    assert.throws(() => validateFreshPreflight({ capturedAt }, now));
});

test("scheduler correction still refuses financial, ownership, schema, control and table-set drift before writes", async () => {
  const baseline = {
    schemaFingerprint: "same", protectedCustodyDigest: "same", control: { sales_enabled: false }, inventory: { definitions: 0 },
    tables: { "credits_sandbox.state": { count: 1, hash: "same" }, "cron.job": { count: 3, hash: "same" } },
  };
  const tx = { unsafe: async () => { throw Error("Unexpected query before rejected drift"); } };
  for (const field of ["schemaFingerprint", "protectedCustodyDigest", "control", "inventory"])
    await assert.rejects(() => validateInventoryPreflight(tx, { ...baseline, [field]: "changed" }, baseline), /Fresh .* drift/);
  for (const table of ["credits_sandbox.state", "cron.job"])
    await assert.rejects(() => validateInventoryPreflight(tx, { ...baseline, tables: { ...baseline.tables, [table]: { count: 1, hash: "changed" } } }, baseline), /Fresh protected table drift/);
  await assert.rejects(() => validateInventoryPreflight(tx, { ...baseline, tables: {} }, baseline), /Durable table set changed/);
});
