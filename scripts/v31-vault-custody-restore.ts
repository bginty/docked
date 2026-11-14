/** Approved SAME-key custody recovery. Offline only: no hosted connection,
 * migrations, IAM changes, key rotation or fallback to the original key.
 * The retrieved version travels RSA-OAEP wrapped; only process memory sees it. */
import assert from "node:assert/strict";
import {
  createReadStream,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import {
  createDecipheriv,
  createHash,
  privateDecrypt,
  timingSafeEqual,
} from "node:crypto";
import { spawn } from "node:child_process";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";

const root = process.cwd();
const archiveDir = root + "/private-data/commercial-restore-20261112d";
const privateDir = root + "/private-data/vault-custody-20261114";
const evidence = root + "/docs/qa/v31-vault-custody-20261114";
const target = "docked-vault-custody-20261114-verified";
const image = "public.ecr.aws/supabase/postgres:17.11.0.002";
const expectedArchive =
  "0287b33badf819fe2bf436add61dacc7ee41e17e691e81561ba7e5d87c659746";
const expectedManifest =
  "e8e997e7e768cf1f8d412037f118119328f929043ce68bf29a10e6dbde8f2285";
// The historical manifest used v1 (name-truncated identities). In addition,
// the source fingerprint is deliberately host-local: it includes physical
// attnums (including dropped-column gaps), ACL ordering and extension ownership.
// pg_dump/restore does not reproduce those bytes. Preserve the source assertion
// and use the independently rehearsed equivalent restored catalogue separately.
const sourceCatalogue = {
  fingerprint: "7e9acf391f1f34b573eb818210128447",
  objects: 10147,
};
const restoredCatalogue = {
  fingerprint: "8512b589d29cb4e36f2fa6d4580cd0f4",
  objects: 10147,
};
let created = false;
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
async function docker(args: string[], input?: string) {
  const p = spawn("docker", args, {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let out = "",
    error = "";
  p.stdout.on("data", (b) => {
    out += b;
  });
  p.stderr.on("data", (b) => {
    error += b;
  });
  p.stdin.end(input);
  const code = await new Promise<number | null>((resolve, reject) => {
    p.on("error", reject);
    p.on("close", resolve);
  });
  if (code !== 0) {
    writeFileSync(privateDir + "/docker.private.log", error, { mode: 0o600 });
    throw new Error(
      "Local Docker operation failed; private diagnostic retained",
    );
  }
  return out.trim();
}
const local = (sql: string) =>
  docker(
    [
      "exec",
      "-i",
      target,
      "psql",
      "-h",
      "/restore",
      "-U",
      "bootstrap_admin",
      "-d",
      "postgres",
      "-Atq",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    sql,
  );

async function main() {
  mkdirSync(evidence, { recursive: true });
  const receipt = JSON.parse(
    readFileSync(privateDir + "/retrieval-metadata.json", "utf8"),
  );
  assert.equal(receipt.project, "docked-play-verification");
  assert.equal(receipt.secret, "docked-recovery-backup");
  assert.equal(receipt.version, "1");
  assert.equal(receipt.sameKeyComparedInCloud, true);
  assert.equal(receipt.iamUnchanged, true);
  assert.equal(receipt.freeAllowanceVerified, true);
  const wrapped = readFileSync(privateDir + "/retrieved-version-1.oaep");
  assert.equal(hash(wrapped), receipt.wrappedSha256);
  // Never use the original local recovery copy as a decryption fallback.
  const retrieved = privateDecrypt(
    {
      key: readFileSync(privateDir + "/transport-private.pem"),
      oaepHash: "sha256",
    },
    wrapped,
  );
  const key = Buffer.from(retrieved.toString("utf8").trim(), "hex");
  try {
    // Never let assertion formatting echo a malformed secret payload.
    assert.ok(
      /^[a-f0-9]{64}$/i.test(retrieved.toString("utf8").trim()),
      "Retrieved key has an invalid format",
    );
    assert.equal(key.length, 32);
    const original = readFileSync(
      "C:/Users/61412/.docked-secrets/launch-migration-backup-key.hex",
    );
    try {
      assert(
        timingSafeEqual(retrieved, original),
        "Retrieved version differs from approved original bytes",
      );
    } finally {
      original.fill(0);
    }
    const manifestBytes = readFileSync(archiveDir + "/manifest.aes");
    assert.equal(hash(manifestBytes), expectedManifest);
    assert.equal(
      hash(readFileSync(archiveDir + "/production.dump.aes")),
      expectedArchive,
    );
    const md = createDecipheriv(
      "aes-256-gcm",
      key,
      manifestBytes.subarray(0, 12),
    );
    md.setAuthTag(manifestBytes.subarray(12, 28));
    const manifest = JSON.parse(
      Buffer.concat([
        md.update(manifestBytes.subarray(28)),
        md.final(),
      ]).toString("utf8"),
    );
    assert.equal(manifest.project, "pojoymtniryarxxunyvz");
    assert(manifest.at.startsWith("2026-11-12T12:45:"));
    assert.deepEqual(manifest.catalogueFingerprint, sourceCatalogue);
    const earlierRehearsal = JSON.parse(
      readFileSync(
        root +
          "/docs/qa/v31-revenue-launch-20261113/revenue-repairs-v2-restored.json",
        "utf8",
      ),
    );
    assert.equal(earlierRehearsal.sourceArchiveSha256, manifest.sha256);
    assert.equal(earlierRehearsal.sourceArchiveAt, manifest.at);
    assert.equal(
      earlierRehearsal.fingerprintAlgorithm,
      "v2-text-identities-no-name-truncation",
    );
    assert.deepEqual(earlierRehearsal.schemaBefore, restoredCatalogue);
    const decipher = () => {
      const d = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(manifest.iv, "hex"),
      );
      d.setAuthTag(Buffer.from(manifest.tag, "hex"));
      return d;
    };
    const plainHash = createHash("sha256");
    let bytes = 0;
    await pipeline(
      createReadStream(archiveDir + "/production.dump.aes"),
      decipher(),
      new Writable({
        write(chunk, _encoding, done) {
          plainHash.update(chunk);
          bytes += chunk.length;
          done();
        },
      }),
    );
    assert.equal(bytes, manifest.bytes);
    assert.equal(plainHash.digest("hex"), manifest.sha256);
    if (process.argv.includes("--verify-archive-only")) {
      const verified = {
        at: new Date().toISOString(),
        authenticated: true,
        pinnedVersion: "1",
        sameKey: true,
        exactArchive: true,
        sameArchiveV2CatalogueProvenance: true,
        databaseOperation: false,
      };
      writeFileSync(
        evidence + "/archive-provenance.json",
        JSON.stringify(verified, null, 2) + "\n",
        { flag: "wx" },
      );
      console.log(JSON.stringify(verified));
      return;
    }
    console.log(
      "Pinned vault version authenticated the exact approved archive; starting isolated restore.",
    );
    // Fail if this exact container already exists; never restart another operation.
    await docker([
      "create",
      "--name",
      target,
      "--network",
      "none",
      "--user",
      "postgres",
      "--tmpfs",
      "/restore:rw,nosuid,nodev,mode=1777",
      "--entrypoint",
      "sh",
      image,
      "-c",
      "initdb -D /restore/data -U bootstrap_admin -A trust --no-locale --encoding=UTF8 >/restore/init.log 2>&1 && exec postgres -D /restore/data -c listen_addresses='' -c unix_socket_directories=/restore -c shared_preload_libraries=pg_cron,pg_net -c cron.launch_active_jobs=off -c pg_net.database_name=network_worker_disabled",
    ]);
    created = true;
    const config = JSON.parse(await docker(["inspect", target]))[0];
    assert.equal(config.HostConfig.NetworkMode, "none");
    assert.equal(Object.keys(config.HostConfig.PortBindings ?? {}).length, 0);
    assert.equal(
      config.HostConfig.Tmpfs["/restore"],
      "rw,nosuid,nodev,mode=1777",
    );
    await docker(["start", target]);
    let ready = false;
    for (let n = 0; n < 30; n++) {
      try {
        await local("select 1");
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    assert(ready, "Isolated database did not start");
    for (const r of manifest.roles) {
      assert.notEqual(r.rolname, "bootstrap_admin");
      await local(
        `create role ${quote(r.rolname)} ${r.rolsuper ? "superuser" : "nosuperuser"} ${r.rolinherit ? "inherit" : "noinherit"} ${r.rolcreaterole ? "createrole" : "nocreaterole"} ${r.rolcreatedb ? "createdb" : "nocreatedb"} ${r.rolreplication ? "replication" : "noreplication"} ${r.rolbypassrls ? "bypassrls" : "nobypassrls"} nologin;`,
      );
    }
    // Archive contains role/member pairs, not full historical membership flags.
    // This verifies recovery of schema/data, not fresh hosted authentication.
    for (const m of manifest.members)
      await local(`grant ${quote(m.role)} to ${quote(m.member)};`);
    const p = spawn(
      "docker",
      [
        "exec",
        "-i",
        target,
        "pg_restore",
        "--exit-on-error",
        "-h",
        "/restore",
        "-U",
        "bootstrap_admin",
        "-d",
        "postgres",
      ],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
    );
    let errors = "";
    p.stderr.on("data", (b) => {
      errors += b;
    });
    p.stdout.resume();
    const completed = new Promise<number | null>((resolve, reject) => {
      p.on("close", resolve);
      p.on("error", reject);
    });
    let streamFailed = false;
    try {
      await pipeline(
        createReadStream(archiveDir + "/production.dump.aes"),
        decipher(),
        p.stdin,
      );
    } catch {
      streamFailed = true;
    }
    if ((await completed) !== 0 || streamFailed) {
      writeFileSync(privateDir + "/restore.private.log", errors, {
        mode: 0o600,
      });
      throw new Error(
        "Isolated archive restore failed; diagnostic stays private",
      );
    }
    await local("alter database postgres owner to postgres;");
    const excluded = ['"net"."_http_response"', '"net"."http_request_queue"'];
    const tables = Object.keys(manifest.sums).filter(
      (t) => !excluded.includes(t),
    );
    for (let i = 0; i < tables.length; i += 25) {
      const group = tables.slice(i, i + 25);
      const result = (
        await local(
          group
            .map((t) => {
              assert.match(t, /^"[A-Za-z0-9_]+"\."[A-Za-z0-9_]+"$/);
              return `select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(h,'' order by h),''))) from(select md5(to_jsonb(t)::text) h from ${t} t)q;`;
            })
            .join("\n"),
        )
      )
        .split(/\r?\n/)
        .map((line) => JSON.parse(line));
      assert.equal(result.length, group.length);
      group.forEach((t, n) =>
        assert.deepEqual(
          result[n],
          manifest.sums[t],
          `Protected table mismatch: ${t}`,
        ),
      );
    }
    assert.equal(
      await local("select current_setting('cron.launch_active_jobs')"),
      "off",
    );
    assert.equal(
      await local("select current_setting('pg_net.database_name')"),
      "network_worker_disabled",
    );
    assert.equal(
      await local("select count(*) from commercial_billing.definitions"),
      "0",
    );
    const schema = JSON.parse(
      await local(
        "select row_to_json(q) from (" + v31SchemaFingerprintSql + ")q",
      ),
    );
    assert.deepEqual(
      schema,
      restoredCatalogue,
      "Independent restored catalogue mismatch",
    );
    const report = {
      at: new Date().toISOString(),
      secretResource:
        "projects/1007288339937/secrets/docked-recovery-backup/versions/1",
      sameOriginalKey: true,
      keyRotation: false,
      originalLocalCopyRetained: true,
      archiveCapturedAt: manifest.at,
      encryptedArchiveSha256: expectedArchive,
      encryptedManifestSha256: expectedManifest,
      authenticated: true,
      restored: true,
      restoreTarget: target,
      network: "none",
      publishedPorts: 0,
      protectedTables: tables.length,
      allProtectedTableCountsAndFingerprintsMatch: true,
      catalogueFingerprint: schema,
      sourceCatalogueFingerprint: sourceCatalogue,
      catalogueComparison:
        "Exact independent isolated restore baseline; host-local source fingerprint is not portable across pg_dump/restore",
      commercialDefinitionsAtBackup: 0,
      historicalPreImportSnapshot: true,
      productionWrites: 0,
      migrationsApplied: false,
      membershipFidelity:
        "Historical role/member pairs only; no current hosted authentication claim",
      excludedUnloggedTransportCaches: excluded,
      cronActive: false,
      pgNetActive: false,
      plaintextArchiveOrRetrievedKeyPersisted: false,
      restoredDataStorage: "tmpfs; container stopped after test",
    };
    await docker(["stop", target]);
    created = false;
    writeFileSync(
      evidence + "/isolated-recovery.json",
      JSON.stringify(report, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(JSON.stringify(report));
  } finally {
    retrieved.fill(0);
    key.fill(0);
    if (created) await docker(["stop", target]);
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
