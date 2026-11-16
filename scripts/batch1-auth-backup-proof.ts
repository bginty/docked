/** Bind the pre-browser redacted Auth witness to the verified encrypted backup. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  authority,
  json,
  save,
  sha,
  priv,
  docs,
} from "./lib/batch1-production-execution.mjs";
import {
  readAuthEvidence,
  compareAuthEvidence,
  founderAuthTables,
} from "./lib/batch1-founder-auth-evidence";
import { checksumQuery } from "./lib/reviewed-inventory";
async function main() {
  authority();
  const target = "docked-commercial-restore-20261116c-attempt-2";
  const c = JSON.parse(
    execFileSync("docker", ["inspect", target], {
      windowsHide: true,
    }).toString(),
  )[0];
  assert.equal(c.HostConfig.NetworkMode, "none");
  assert.equal(Object.keys(c.HostConfig.PortBindings ?? {}).length, 0);
  const restore = json(
    "docs/qa/v31-prelaunch-execution-20261111/database/restore-20261116c/restore-only.json",
  );
  assert(
    restore.restored &&
      restore.protectedRecordsUnchanged &&
      restore.restoreTarget === target,
  );
  assert.equal(
    restore.archiveSha256,
    "61413d9757bd1859782af6a795e1cd29c2b3de5de86301dbe014d34fb88e2971",
  );
  const read = async (q: string) =>
    JSON.parse(
      execFileSync(
        "docker",
        [
          "exec",
          "-i",
          target,
          "psql",
          "-X",
          "-q",
          "-h",
          "/restore",
          "-U",
          "postgres",
          "-d",
          "postgres",
          "-At",
          "-v",
          "ON_ERROR_STOP=1",
        ],
        { input: q, windowsHide: true, maxBuffer: 32e6 },
      )
        .toString()
        .trim(),
    );
  const baseline = await readAuthEvidence(read),
    before = json(priv + "/founder-auth-before.private.json");
  compareAuthEvidence(before, baseline);
  const applied = json(priv + "/database-applied.private.json"),
    tableHashes: Record<string, any> = {};
  for (const name of [
    ...founderAuthTables.map((t) => "auth." + t),
    "beta_private.rate_limits",
  ]) {
    const v = await read(checksumQuery(name));
    tableHashes[name] = { count: v.count, hash: v.hash };
    assert.deepEqual(tableHashes[name], applied.tables[name]);
  }
  save(priv + "/founder-auth-backup-proof.private.json", {
    at: new Date().toISOString(),
    beforeFileSha256: sha(
      readFileSync(priv + "/founder-auth-before.private.json"),
    ),
    tableHashes,
    archiveSha256: restore.archiveSha256,
  });
  save(docs + "/founder-auth-backup-proof.json", {
    at: new Date().toISOString(),
    verified: true,
    protectedTables: 9,
    credentialValuesExported: false,
    network: "none",
    productionWrites: 0,
    archiveSha256: restore.archiveSha256,
  });
  console.log(
    JSON.stringify({
      verified: true,
      authAndRateTables: 9,
      preBrowserWitnessMatchesAuthenticatedBackup: true,
      productionWrites: 0,
    }),
  );
}
main().catch((e) => {
  console.error(
    e instanceof Error ? e.message : "Backup witness comparison stopped",
  );
  process.exitCode = 1;
});
