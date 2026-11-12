/** Prepared status-only operator. --package is offline; --preflight reads only.
 * --execute requires a separate exact founder approval plus fresh proof/backup. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { digest } from "../src/core/scoring-engine";
import {
  historicalWarningSql,
  validateHistoricalWarnings,
} from "./lib/historical-warning-disposition";
import { checksumQuery } from "./lib/reviewed-inventory";
import { authenticateDatabaseBackup } from "./lib/authenticated-database-backup";

const manifestPath =
  "private-data/v31-revenue-launch-20261113/historical-notifications.private.json";
const manifestSha256 =
  "e153fafab4ccc34aeb7892844a6e85fb5e10f484da8240f1088ac3881153427b";
const hash = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));
export function historicalWarningPackage() {
  const entryFiles = [
    "scripts/v31-historical-warning-operator.ts",
    "scripts/v31-historical-warning-evidence.ts",
    "scripts/lib/historical-warning-disposition.ts",
    "scripts/lib/authenticated-database-backup.ts",
    "package-lock.json",
    "certs/supabase-prod-ca-2021.crt",
    "scripts/lib/reviewed-inventory.ts",
    "scripts/owner-gameplay-db.mjs",
    "src/core/scoring-engine.ts",
    "src/server/database-tls.ts",
    "src/server/google-commercial-verifier.ts",
    "src/server/google-play-oauth.ts",
    "src/server/store-purchase-verification.ts",
    "src/core/commercial-billing.ts",
  ];
  const files = new Set<string>();
  const root = path.resolve(".");
  function visit(file: string) {
    file = path.resolve(file);
    assert(file.startsWith(root + path.sep));
    if (files.has(file)) return;
    files.add(file);
    if (!/\.(ts|mjs)$/.test(file)) return;
    for (const match of readFileSync(file, "utf8").matchAll(
      /(?:import|export)\s+(?:[^;]*?\s+from\s+)?["'](\.[^"']+)["']/g,
    )) {
      const base = path.resolve(path.dirname(file), match[1]);
      const target = [
        base,
        base + ".ts",
        base + ".mjs",
        base + ".json",
        path.join(base, "index.ts"),
      ].find((p) => existsSync(p) && statSync(p).isFile());
      assert(target, "Unresolved package dependency");
      visit(target);
    }
  }
  entryFiles.forEach(visit);
  const contents = [...files]
    .sort()
    .map((file) => ({
      file: path.relative(root, file).replaceAll("\\", "/"),
      sha256: hash(file),
    }));
  return {
    manifestSha256,
    files: contents,
    packageSha256: digest({ manifestSha256, files: contents }),
  };
}
const protectedNames = [
  "credits_sandbox.state",
  "credits_sandbox.card_instances",
  "credits_sandbox.nba_fixture_instances",
  "credits_sandbox.pack_receipts",
  "credits_sandbox.permanent_players",
  "beta_fantasy.cards",
  "beta_fantasy.ownership_events",
  "sports_feed.sport_sandbox_inventory",
  "operations.incidents",
  "operations.events",
  "private.feature_flags",
  "cron.job",
];

let operationStage = "offline validation";
let transactionCommitted = false;
async function main() {
  assert.equal(
    hash(manifestPath),
    manifestSha256,
    "Frozen warning manifest changed",
  );
  const rows = validateHistoricalWarnings(read(manifestPath).rows),
    pkg = historicalWarningPackage();
  if (process.argv[2] === "--package") {
    console.log(JSON.stringify(pkg, null, 2));
    return;
  }
  const execute = process.argv[2] === "--execute";
  assert(
    execute || process.argv[2] === "--preflight",
    "Explicit --package, --preflight or --execute required",
  );
  const evidenceFile = process.argv[3],
    output = process.argv[4];
  assert(
    evidenceFile &&
      path.resolve(evidenceFile).startsWith(path.resolve("docs/qa") + path.sep),
  );
  assert(
    output &&
      path.resolve(output).startsWith(path.resolve("docs/qa") + path.sep),
  );
  assert(!existsSync(output), "Use a new evidence output path");
  const evidence = read(evidenceFile),
    now = Date.now();
  assert(
    evidence.verified === true &&
      evidence.warningManifestSha256 === manifestSha256,
  );
  assert.equal(evidence.notificationFingerprint, digest(rows));
  assert(
    now - Date.parse(evidence.at) >= 0 &&
      now - Date.parse(evidence.at) <= 10 * 60000,
    "Fresh <=10 minute provider/Preview evidence required",
  );
  assert.equal(evidence.cases.length, 3);
  for (const [i, c] of evidence.cases.entries()) {
    assert.equal(c.caseNumber, i + 1);
    assert(
      c.providerVerified === true && c.originalMemberBindingVerified === true,
    );
    assert.equal(c.providerOrderState, "REFUNDED");
    assert.equal(c.providerReceiptState, "REVOKED");
    assert.equal(c.accounting.remaining, 0);
    assert.equal(c.accounting.outstanding_jobs, 0);
    assert.equal(c.accounting.unbalanced, 0);
    assert.equal(c.accounting.exposure, i === 1 ? 5700 : 0);
    assert.equal(c.notificationCount, i === 1 ? 3 : 2);
  }
  let authority: any = null;
  let backup: Awaited<ReturnType<typeof authenticateDatabaseBackup>> | null =
    null;
  if (execute) {
    operationStage = "exact founder authority and backup authentication";
    const approvalFile = process.argv[5];
    assert(
      approvalFile &&
        path
          .resolve(approvalFile)
          .startsWith(path.resolve("private-data") + path.sep),
    );
    authority = read(approvalFile);
    assert(
      authority.approved === true &&
        authority.scope === "v31-seven-historical-test-warning-disposition",
    );
    assert.equal(authority.projectRef, "pojoymtniryarxxunyvz");
    assert.equal(authority.packageSha256, pkg.packageSha256);
    assert.equal(authority.manifestSha256, manifestSha256);
    assert.equal(authority.evidenceSha256, hash(evidenceFile));
    const approved = Date.parse(authority.approvedAt),
      expires = Date.parse(authority.expiresAt);
    assert(
      approved <= now && now < expires && expires - approved <= 24 * 3600000,
      "Valid exact approval <=24 hours required",
    );
    assert(
      typeof authority.approvalReference === "string" &&
        authority.approvalReference.length >= 12,
    );
    assert(
      now - Date.parse(authority.backupCapturedAt) >= 0 &&
        now - Date.parse(authority.backupCapturedAt) <= 3600000,
      "Fresh encrypted backup <=1 hour required",
    );
    for (const field of ["backupManifest", "backupArchive"])
      assert.equal(
        hash(authority[field + "Path"]),
        authority[field + "Sha256"],
        "Encrypted backup bytes changed",
      );
    for (const field of ["backupManifestPath", "backupArchivePath"])
      assert(
        path
          .resolve(authority[field])
          .startsWith(path.resolve("private-data") + path.sep),
      );
    backup = await authenticateDatabaseBackup({
      manifestPath: authority.backupManifestPath,
      archivePath: authority.backupArchivePath,
      keyPath: "C:/Users/61412/.docked-secrets/launch-migration-backup-key.hex",
      projectRef: "pojoymtniryarxxunyvz",
      maxAgeMs: 3600000,
    });
    assert(backup.tableCount >= 550, "Complete database backup required");
  }
  const root = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    operationStage = execute
      ? "transaction checks and bounded correction"
      : "read-only preflight";
    const report = await sql.begin(
      execute
        ? "isolation level serializable"
        : "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='30s'`;
        const current =
          await tx`select to_jsonb(n) value from credits_sandbox.store_notifications n where id=any(${rows.map((r) => r.id)}) order by id`;
        assert.equal(
          digest(current.map((r) => r.value)),
          digest(rows),
          "Warning drift; do not repair implicitly",
        );
        const [gates] =
          await tx`select to_jsonb(c) value from commercial_billing.control c where id`;
        assert.equal(gates.value.environment, "commercial");
        for (const field of [
          "sales_enabled",
          "issuance_enabled",
          "transfers_enabled",
          "gameplay_enabled",
        ])
          assert.equal(gates.value[field], false);
        const names = (
          await tx`select schemaname||'.'||tablename name from pg_tables where schemaname='commercial_billing' order by tablename`
        ).map((r) => r.name);
        const before: Record<string, unknown> = {};
        for (const table of [...names, ...protectedNames])
          before[table] = (await tx.unsafe(checksumQuery(table)))[0].value;
        if (execute) {
          // Exclusive warning-table lock inside this SQL prevents workers racing the
          // exact terminal update. Any timeout or mismatch rolls everything back.
          await tx.unsafe(
            historicalWarningSql({
              rows,
              approvalReference: authority.approvalReference,
              packageSha256: pkg.packageSha256,
              evidenceSha256: hash(evidenceFile),
              manifestSha256,
            }),
          );
          for (const table of Object.keys(before))
            assert.deepEqual(
              (await tx.unsafe(checksumQuery(table)))[0].value,
              before[table],
              "Protected data changed: " + table,
            );
        }
        return {
          at: new Date().toISOString(),
          mode: execute ? "executed" : "read-only-preflight",
          package: pkg,
          evidenceSha256: hash(evidenceFile),
          backup,
          targetWarnings: rows.length,
          protectedTableCount: Object.keys(before).length,
          protectedTableFingerprints: before,
          productionWrites: execute
            ? { warnings: 7, appendOnlyAuditEvents: 1 }
            : 0,
          balancesChanged: 0,
          cardsChanged: 0,
          recoveryHoldsWaived: 0,
          providerMutations: 0,
          meaning:
            "externally reconciled original Preview TEST; not a Production fulfilment",
        };
      },
    );
    transactionCommitted = execute;
    operationStage = "writing committed result evidence";
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n", {
      flag: "wx",
    });
    console.log(
      JSON.stringify({
        mode: report.mode,
        targetWarnings: 7,
        protectedTableCount: report.protectedTableCount,
        packageSha256: pkg.packageSha256,
      }),
    );
  } finally {
    await sql.end();
  }
}
if (
  process.argv[1]
    ?.replaceAll("\\", "/")
    .endsWith("/v31-historical-warning-operator.ts")
)
  main().catch(() => {
    console.error(
      `Historical warning operation refused or failed at ${operationStage}. Transaction confirmed committed: ${transactionCommitted}. If commit acknowledgement was interrupted, verify readback before any retry. No retry is authorised implicitly.`,
    );
    process.exitCode = 1;
  });
