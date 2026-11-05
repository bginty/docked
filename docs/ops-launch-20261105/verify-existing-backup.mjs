/** Authenticate the existing encrypted release archive without writing plaintext
 * or connecting to any hosted database. This does not prove independent custody
 * or recovery of Storage objects/provider configuration. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createDecipheriv, createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import path from "node:path";

const outputDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(outputDir, "../..");
const sourceDir = path.join(root, "private-data/commercial-restore-20261105");
const key = Buffer.from(
  (
    await readFile(
      path.join(
        process.env.USERPROFILE,
        ".docked-secrets/launch-migration-backup-key.hex",
      ),
      "utf8",
    )
  ).trim(),
  "hex",
);
assert.equal(key.length, 32, "Existing operator backup key must be 32 bytes");
try {
  const bytes = await readFile(path.join(sourceDir, "manifest.aes"));
  const decoder = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  decoder.setAuthTag(bytes.subarray(12, 28));
  const manifest = JSON.parse(
    Buffer.concat([
      decoder.update(bytes.subarray(28)),
      decoder.final(),
    ]).toString(),
  );
  assert.equal(manifest.project, "pojoymtniryarxxunyvz");
  const dataDecoder = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(manifest.iv, "hex"),
  );
  dataDecoder.setAuthTag(Buffer.from(manifest.tag, "hex"));
  const digest = createHash("sha256");
  let byteCount = 0;
  await pipeline(
    createReadStream(path.join(sourceDir, "production.dump.aes")),
    dataDecoder,
    new Writable({
      write(chunk, _encoding, callback) {
        digest.update(chunk);
        byteCount += chunk.length;
        callback();
      },
    }),
  );
  assert.equal(byteCount, manifest.bytes);
  assert.equal(digest.digest("hex"), manifest.sha256);
  const result = {
    at: new Date().toISOString(),
    sourceProject: manifest.project,
    backupAt: manifest.at,
    bytes: byteCount,
    authentication: "AES-256-GCM",
    archiveAuthenticated: true,
    archiveDigestMatched: true,
    existingOperatorKeyAccessible: true,
    independentRecoveryCustodianVerified: false,
    storageObjectBodiesVerified: false,
    hostedConfigurationRecoveryVerified: false,
    plaintextWritten: false,
    hostedConnections: 0,
    productionMutations: 0,
  };
  await writeFile(
    path.join(outputDir, "archive-authentication.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify(result));
} finally {
  key.fill(0);
}
