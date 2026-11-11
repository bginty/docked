/** Prepared operator entry point. Defaults to OFFLINE validation. Production
 * writes require an exact, unexpired founder approval artifact and fresh drift
 * evidence. Never authorises its own approval, backup, registration or sales. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { digest } from "../src/core/scoring-engine";
import { validateReviewedInventory, reviewedInventorySql, custodyQuery, schemaQuery, tableListQuery, checksumQuery } from "./lib/reviewed-inventory";

const projectRef = "pojoymtniryarxxunyvz";
const root = process.cwd();
const defaultPlan = "private-data/v31-card-research-20261111/complete-proposal.private.json";
const sha = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const privatePath = (file: string) => {
  const target = path.resolve(file);
  assert(target.startsWith(path.resolve(root, "private-data") + path.sep), "Private operator artifact must stay within private-data");
  return target;
};
function option(name: string, fallback?: string) {
  const at = process.argv.indexOf(name);
  if (at < 0) return fallback;
  const value = process.argv[at + 1];
  assert(value && !value.startsWith("--"), `${name} requires an exact file path`);
  return value;
}
export function inventoryOperatorPackage() {
  const files = new Set<string>([path.resolve(root, "package-lock.json")]);
  // Bind all local transitive imports as well as the npm dependency lock. A
  // changed SQL helper, cap configuration or TLS check invalidates approval.
  function visit(file: string) {
    if (files.has(file)) return;
    assert(file.startsWith(root + path.sep));
    files.add(file);
    if (file.endsWith(".json")) return;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^;]*?\s+from\s+)?["'](\.[^"']+)["']/g)) {
      const base = path.resolve(path.dirname(file), match[1]);
      const target = [base, `${base}.ts`, `${base}.mjs`, `${base}.json`, path.join(base, "index.ts")].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
      assert(target, `Unresolved local dependency: ${match[1]}`);
      visit(target);
    }
  }
  visit(fileURLToPath(import.meta.url));
  const checksums = Object.fromEntries([...files].sort().map(file => [path.relative(root, file).replaceAll("\\", "/"), sha(file)]));
  return { checksums, operatorPackageDigest: digest(checksums) };
}

export function validateFreshPreflight(baseline: any, now: number) {
  const capturedAt = Date.parse(baseline.capturedAt);
  assert(Number.isFinite(capturedAt) && capturedAt <= now && now - capturedAt <= 10 * 60 * 1000,
    "Preflight must be refreshed within ten minutes of import");
}

export function validateImportApproval(approval: any, expected: { planSha256: string; registrationDigest: string; operatorPackageDigest: string }, now: number) {
  assert.equal(approval.approved, true, "Founder approval absent");
  assert.equal(approval.scope, "v31-preservation-only-inventory-import");
  assert.equal(approval.projectRef, projectRef);
  assert.equal(approval.planSha256, expected.planSha256);
  assert.equal(approval.registrationDigest, expected.registrationDigest);
  assert.equal(approval.operatorPackageDigest, expected.operatorPackageDigest);
  assert.equal(approval.preservationOnly, true);
  for (const field of ["newIssuance", "sales", "publicRegistration", "ownershipChanges", "betaCatalogueChanges"])
    assert.equal(approval[field], false, `Unexpected ${field} authority`);
  assert.equal(typeof approval.approvalReference, "string");
  assert(approval.approvalReference.length >= 16, "Exact founder instruction reference required");
  const approvedAt = Date.parse(approval.approvedAt), expiresAt = Date.parse(approval.expiresAt);
  assert(Number.isFinite(approvedAt) && Number.isFinite(expiresAt));
  assert(approvedAt <= now && expiresAt > now && expiresAt - approvedAt <= 24 * 60 * 60 * 1000, "Approval expired or exceeds 24-hour window");
  const capturedAt = Date.parse(approval.backupCapturedAt);
  assert(Number.isFinite(capturedAt) && capturedAt <= now && now - capturedAt <= 60 * 60 * 1000, "Fresh consistent backup must be at most one hour old");
  for (const field of ["preflightSha256", "backupManifestSha256", "backupArchiveSha256"])
    assert.match(approval[field], /^[0-9a-f]{64}$/);
}

async function capture(tx: any) {
  const [{ value: tables }] = await tx.unsafe(tableListQuery);
  const sums: Record<string, unknown> = {};
  for (let offset = 0; offset < tables.length; offset += 25) {
    const statements = tables.slice(offset, offset + 25).map((table: string) => `(${checksumQuery(table)})`).join(" union all ");
    const results = await tx.unsafe(statements);
    for (const { value } of results) sums[value.table] = { count: value.count, hash: value.hash };
  }
  const [{ value: custody }] = await tx.unsafe(custodyQuery);
  const [{ value: schema }] = await tx.unsafe(schemaQuery);
  const [control] = await tx`select environment,sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled from commercial_billing.control where id`;
  const [inventory] = await tx`select count(*)::int definitions,coalesce(sum(legacy_issued),0)::int consumed,count(*)filter(where approved)::int approved from commercial_billing.definitions`;
  return { projectRef, capturedAt: new Date().toISOString(), tables: sums, protectedCustodyDigest: digest(custody), schemaFingerprint: schema, control, inventory };
}

async function main() {
  const planFile = privatePath(option("--plan", defaultPlan)!);
  const plan = read(planFile);
  validateReviewedInventory(plan);
  const code = inventoryOperatorPackage();
  const expected = { planSha256: sha(planFile), registrationDigest: plan.registrationDigest, operatorPackageDigest: code.operatorPackageDigest };
  const captureMode = process.argv.includes("--capture-production-preflight");
  const applyMode = process.argv.includes("--apply-production");
  assert(!(captureMode && applyMode), "Capture and apply must be separate reviewed actions");
  if (!captureMode && !applyMode) {
    console.log(JSON.stringify({ valid: true, mode: "OFFLINE_ONLY", definitions: 6540, consumed: 888, ...expected, productionWrites: 0 }));
    return;
  }
  let approval: any, baseline: any;
  if (applyMode) {
    const approvalFile = option("--approval");
    assert(approvalFile, "Exact founder approval artifact required before any connection");
    approval = read(privatePath(approvalFile));
    validateImportApproval(approval, expected, Date.now());
    for (const [field, hashField] of [["preflightPath", "preflightSha256"], ["backupManifestPath", "backupManifestSha256"], ["backupArchivePath", "backupArchiveSha256"]]) {
      const file = privatePath(approval[field]);
      assert.equal(sha(file), approval[hashField], `Changed ${field}`);
      assert(statSync(file).isFile());
    }
    baseline = read(privatePath(approval.preflightPath));
    assert.equal(baseline.projectRef, projectRef);
    assert.equal(baseline.planSha256, expected.planSha256);
    validateFreshPreflight(baseline, Date.now());
    assert.equal(baseline.protectedCustodyDigest, plan.protectedCustodyDigest);
  }
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    if (captureMode) {
      const target = privatePath(option("--output", "private-data/v31-card-research-20261111/import-preflight.private.json")!);
      const snapshot = await sql.begin("isolation level repeatable read read only", capture);
      assert.equal(snapshot.protectedCustodyDigest, plan.protectedCustodyDigest, "Historical allocations/custody changed; reconcile before approval");
      writeFileSync(target, JSON.stringify({ ...snapshot, ...expected, productionWrites: 0 }, null, 2) + "\n", { flag: "wx" });
      console.log(JSON.stringify({ mode: "READ_ONLY_PREFLIGHT", file: path.relative(root, target), sha256: sha(target), inventory: snapshot.inventory, productionWrites: 0 }));
      return;
    }
    const result = await sql.begin("isolation level repeatable read", async (tx: any) => {
      await tx`set local lock_timeout='3s'`;
      await tx`set local statement_timeout='60s'`;
      await tx.unsafe("lock table credits_sandbox.state,credits_sandbox.card_instances,credits_sandbox.nba_fixture_instances,credits_sandbox.permanent_players,sports_feed.sport_sandbox_inventory in share row exclusive mode");
      await tx.unsafe("lock table commercial_billing.definitions in share row exclusive mode");
      const before = await capture(tx);
      assert.equal(before.control.environment, "commercial", "Exact Production commercial environment required");
      for (const field of ["tables", "schemaFingerprint", "protectedCustodyDigest", "control", "inventory"])
        assert.equal(digest(before[field as keyof typeof before]), digest(baseline[field]), `Fresh ${field} drift; no implicit repair`);
      assert.equal(before.protectedCustodyDigest, plan.protectedCustodyDigest);
      await tx.unsafe(reviewedInventorySql(plan));
      const after = await capture(tx);
      assert.equal(after.protectedCustodyDigest, plan.protectedCustodyDigest);
      assert.deepEqual(after.schemaFingerprint, before.schemaFingerprint);
      for (const [table, checksum] of Object.entries(before.tables))
        if (table.replaceAll('"', "") !== "commercial_billing.definitions") assert.deepEqual(after.tables[table], checksum, `Protected table changed: ${table}`);
      assert.equal(after.inventory.definitions, 6540);
      assert.equal(after.inventory.consumed, 888);
      assert.equal(after.inventory.approved, 0);
      return { definitions: 6540, consumed: 888, inserted: before.inventory.definitions === 0 ? 6540 : 0, unchanged: before.inventory.definitions === 6540 ? 6540 : 0, protectedTables: Object.keys(before.tables).length - 1, custodyUnchanged: true, cardsCreated: 0, approvedDefinitions: 0, activation: false };
    });
    console.log(JSON.stringify({ mode: "APPROVED_PRODUCTION_IMPORT", ...result, planSha256: expected.planSha256 }));
  } finally { await sql.end(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main().catch(() => {
  console.error("Inventory operator refused or rolled back. Review the exact approval, freshness, plan and target checks; no private values emitted. Do not retry blindly.");
  process.exitCode = 1;
});
