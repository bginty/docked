/** Isolated restored Production rehearsal only. No credentials or TCP access. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, createDecipheriv } from "node:crypto";
import { digest } from "../src/core/scoring-engine";
import {
  validateReviewedInventory,
  reviewedInventorySql,
  custodyQuery,
  schemaQuery,
  tableListQuery,
  checksumQuery,
} from "./lib/reviewed-inventory";
import { inventoryOperatorPackage } from "./v31-reviewed-inventory-operator";
import {
  captureInventoryScheduler,
  verifyInventorySchedulerDrift,
} from "./lib/inventory-scheduler-drift";

assert.equal(process.argv[2], "--isolated-restored");
const container =
  process.env.DOCKED_RESTORED_INVENTORY_TARGET ??
  "docked-commercial-restore-20261111";
assert.match(
  container,
  /^docked-commercial-restore-(?:20261111|20261112[bc]?)(?:-attempt-[2-9])?$/,
);
const archiveDirectory =
  process.env.DOCKED_RESTORED_INVENTORY_ARCHIVE ??
  "private-data/commercial-restore-20261111";
assert.match(
  archiveDirectory,
  /^private-data\/commercial-restore-(?:20261111|20261112[bc]?)$/,
);
const reportPath =
  process.env.DOCKED_RESTORED_INVENTORY_REPORT ??
  "docs/qa/v31-prelaunch-20261111/cards/restored-import-rehearsal.json";
assert(reportPath.startsWith("docs/qa/") && !reportPath.includes(".."));
const planFile =
  "private-data/v31-card-research-20261111/complete-proposal.private.json";
const plan = JSON.parse(readFileSync(planFile, "utf8"));
validateReviewedInventory(plan);
const sha = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");
function run(args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      error = "";
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      error += chunk;
    });
    // A deliberately rejected concurrent transaction can close psql before the
    // large manifest finishes streaming. Preserve its PostgreSQL exit reason.
    child.stdin.on("error", () => {});
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve(out)
        : reject(
            new Error(
              `Isolated Docker command failed (${code}): ${error.split("\n").find((line) => line.includes("ERROR:")) ?? "inspect private local logs"}`,
            ),
          ),
    );
    child.stdin.end(input);
  });
}
async function psql(sql: string) {
  const out = await run(
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-q",
      "-h",
      "/restore",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    sql,
  );
  return out
    .split("\n")
    .filter((line) => line.startsWith("{") || line.startsWith("["))
    .map((line) => JSON.parse(line));
}
const inventoryQuery = `select jsonb_build_object('definitions',(select count(*) from commercial_billing.definitions),'consumed',(select coalesce(sum(legacy_issued),0) from commercial_billing.definitions),'approved',(select count(*) from commercial_billing.definitions where approved),'cards',(select count(*) from commercial_billing.cards),'control',(select to_jsonb(c) from commercial_billing.control c where id))`;
async function capture() {
  const [tables] = await psql(tableListQuery);
  const queries = tables.map((table: string) => checksumQuery(table));
  const values = await psql(
    `begin isolation level repeatable read read only;\n${queries.join(";\n")};\n${custodyQuery};\n${schemaQuery};\n${inventoryQuery};\ncommit;`,
  );
  const sums: Record<string, unknown> = {};
  for (const value of values.slice(0, tables.length))
    sums[value.table] = { count: value.count, hash: value.hash };
  const custody = values[tables.length];
  return {
    tables: sums,
    custodyDigest: digest(custody),
    custodyRecords: custody.length,
    schema: values[tables.length + 1],
    inventory: values[tables.length + 2],
  };
}
async function main() {
  const [inspection] = JSON.parse(await run(["inspect", container]));
  assert.equal(inspection.HostConfig.NetworkMode, "none");
  assert(
    Object.values(inspection.NetworkSettings.Ports ?? {}).every(
      (bindings) =>
        !bindings || (Array.isArray(bindings) && bindings.length === 0),
    ),
  );
  assert.equal(inspection.State.Running, true);
  const before = await capture();
  writeFileSync(
    "private-data/v31-card-research-20261111/rehearsal-before.private.json",
    JSON.stringify(before, null, 2) + "\n",
  );
  const previouslyCommitted = process.argv.includes(
    "--verify-committed-import",
  );
  assert.equal(before.inventory.definitions, previouslyCommitted ? 6540 : 0);
  const key = Buffer.from(
    readFileSync(
      process.env.USERPROFILE +
        "/.docked-secrets/launch-migration-backup-key.hex",
      "utf8",
    ).trim(),
    "hex",
  );
  const encryptedManifest = readFileSync(archiveDirectory + "/manifest.aes");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    encryptedManifest.subarray(0, 12),
  );
  decipher.setAuthTag(encryptedManifest.subarray(12, 28));
  const archiveManifest = JSON.parse(
    Buffer.concat([
      decipher.update(encryptedManifest.subarray(28)),
      decipher.final(),
    ]).toString(),
  );
  key.fill(0);
  assert.equal(archiveManifest.project, "pojoymtniryarxxunyvz");
  let archiveProtectedTables = 0;
  for (const [quoted, expected] of Object.entries(archiveManifest.sums)) {
    const table = quoted.replaceAll('"', "");
    if (
      [
        "net._http_response",
        "net.http_request_queue",
        "commercial_billing.definitions",
      ].includes(table)
    )
      continue;
    if (
      table === "private.feature_flags" &&
      archiveDirectory.endsWith("20261111")
    ) {
      const [withoutPreparedFlag] = await psql(
        "select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(h,'' order by h),''))) from(select md5(to_jsonb(t)::text) h from private.feature_flags t where key<>'billing_ops_alerts')q",
      );
      assert.deepEqual(
        withoutPreparedFlag,
        expected,
        "Only the separately rehearsed disabled outbox flag may differ",
      );
    } else
      assert.deepEqual(
        before.tables[table],
        expected,
        `Archive protected data changed: ${table}`,
      );
    archiveProtectedTables++;
  }
  assert.equal(
    archiveManifest.sums['"commercial_billing"."definitions"'].count,
    0,
  );
  assert.equal(
    before.custodyDigest,
    plan.protectedCustodyDigest,
    "Fresh custody changed; reconcile before proceeding",
  );
  const gsis = plan.registrations
    .map((r: any) => `'${r.providerId}'`)
    .join(",");
  const ids = plan.registrations
    .map((r: any) => `'${r.proposedCommercialPlayerId}'::uuid`)
    .join(",");
  const [lookup] = await psql(
    `select jsonb_build_object('providerMatches',(select count(*) from sports_feed.nfl_players where provider_id in (${gsis})),'catalogueCollisions',(select count(*) from beta_fantasy.players where id in (${ids})))`,
  );
  assert.equal(
    lookup.providerMatches,
    0,
    "Existing provider mapping must be reused after fresh review",
  );
  assert.equal(lookup.catalogueCollisions, 0);
  // Exercise the scheduler-aware preflight against the native restored schema.
  // This adapter uses only the inspected network-isolated Unix-socket target.
  const schedulerDb = {
    unsafe: async (query: string, params: string[] = []) => {
      const bound = query.replace(/\$(\d+)\b/g, (_match, index) => {
        const value = params[Number(index) - 1];
        assert.equal(typeof value, "string");
        return `'${value.replaceAll("'", "''")}'`;
      });
      return (
        await psql(`select coalesce(jsonb_agg(r),'[]') from (${bound}) r`)
      )[0];
    },
  };
  const schedulerBaseline = await captureInventoryScheduler(schedulerDb);
  const schedulerGuard = await verifyInventorySchedulerDrift(
    schedulerDb,
    schedulerBaseline,
    await captureInventoryScheduler(schedulerDb),
    before.tables as any,
  );
  const sql = reviewedInventorySql(plan);
  const start = Date.now();
  await psql(`begin;\n${sql}\ncommit;`);
  const firstImportMs = Date.now() - start;
  const [firstInventory] = await psql(inventoryQuery);
  assert.equal(firstInventory.definitions, 6540);
  assert.equal(firstInventory.consumed, 888);
  assert.equal(firstInventory.approved, 0);
  assert.equal(firstInventory.cards, 0);
  const [firstDefinitions] = await psql(
    checksumQuery("commercial_billing.definitions"),
  );
  await psql(`begin;\n${sql}\ncommit;`);
  const concurrent = await Promise.allSettled([
    psql(`begin;\n${sql}\ncommit;`),
    psql(`begin;\n${sql}\ncommit;`),
  ]);
  const timedOut = concurrent.filter((result) => result.status === "rejected");
  for (const result of timedOut) {
    assert(
      result.status === "rejected" &&
        /lock timeout/.test(String(result.reason)),
      "Only bounded lock contention may reject a concurrent retry",
    );
    await psql(`begin;\n${sql}\ncommit;`);
  }
  const after = await capture();
  assert.deepEqual(
    after.inventory,
    firstInventory,
    "Retries changed inventory/control totals",
  );
  assert.deepEqual(
    after.tables["commercial_billing.definitions"],
    { count: firstDefinitions.count, hash: firstDefinitions.hash },
    "Retries changed immutable definitions",
  );
  assert.deepEqual(after.schema, before.schema);
  assert.equal(after.custodyDigest, before.custodyDigest);
  assert.deepEqual(after.inventory.control, before.inventory.control);
  for (const [table, value] of Object.entries(before.tables))
    if (table.replaceAll('"', "") !== "commercial_billing.definitions")
      assert.deepEqual(
        after.tables[table],
        value,
        `Protected table changed: ${table}`,
      );
  const result = {
    checkedAt: new Date().toISOString(),
    environment: "network-isolated-restored-production",
    container,
    planSha256: sha(planFile),
    ...inventoryOperatorPackage(),
    schedulerGuard,
    sourceDefinitions: 6540,
    freshArchiveDefinitions: 0,
    committedRestoredImportDefinitions: 6540,
    currentSuiteInserted: previouslyCommitted ? 0 : 6540,
    repeatedInserted: 0,
    archiveProtectedTablesUnchanged: archiveProtectedTables,
    separatelyRehearsedOutboxFlagAddition: archiveDirectory.endsWith("20261111")
      ? 1
      : 0,
    concurrentSuccessfulReplays: concurrent.length - timedOut.length,
    concurrentBoundedLockTimeouts: timedOut.length,
    safeRetriesAfterContention: timedOut.length,
    consumedLifetimeCopies: 888,
    canonicalGroups: 735,
    retiredCopiesIncluded: 8,
    protectedTablesUnchanged: Object.keys(before.tables).length - 1,
    custodyRecordsPreserved: before.custodyRecords,
    protectedCustodyDigest: before.custodyDigest,
    schemaUnchanged: true,
    currentCatalogueProviderMatches: 0,
    proposedUuidCollisions: 0,
    newCards: 0,
    changedOwners: 0,
    approvedDefinitions: 0,
    controlsUnchanged: true,
    exactImportOrReplayMs: firstImportMs,
    timingOperation: previouslyCommitted
      ? "exact idempotent replay"
      : "initial import",
    productionWrites: 0,
    productionApproval: false,
  };
  writeFileSync(reportPath, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify({ ...result, checksums: undefined }));
}
void main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Isolated rehearsal failed",
  );
  process.exitCode = 1;
});
