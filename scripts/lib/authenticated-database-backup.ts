/** Authenticate an existing encrypted logical backup without writing plaintext.
 * No database/network connection and no key creation, rotation or transfer. */
import assert from "node:assert/strict";
import { createReadStream, readFileSync } from "node:fs";
import { createDecipheriv, createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";

export async function authenticateDatabaseBackup(input: {
  manifestPath: string;
  archivePath: string;
  keyPath: string;
  projectRef: string;
  maxAgeMs: number;
  now?: number;
}) {
  const keyText = readFileSync(input.keyPath, "utf8").trim();
  assert.match(
    keyText,
    /^[a-f0-9]{64}$/i,
    "Existing 32-byte backup key required",
  );
  const key = Buffer.from(keyText, "hex");
  try {
    const bytes = readFileSync(input.manifestPath);
    assert(bytes.length > 28, "Encrypted manifest truncated");
    const decrypt = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
    decrypt.setAuthTag(bytes.subarray(12, 28));
    const manifest = JSON.parse(
      Buffer.concat([
        decrypt.update(bytes.subarray(28)),
        decrypt.final(),
      ]).toString("utf8"),
    );
    assert.equal(manifest.project, input.projectRef, "Backup project mismatch");
    const age = (input.now ?? Date.now()) - Date.parse(manifest.at);
    assert(
      Number.isFinite(age) && age >= 0 && age <= input.maxAgeMs,
      "Fresh authenticated backup required",
    );
    assert.match(manifest.iv, /^[a-f0-9]{24}$/i);
    assert.match(manifest.tag, /^[a-f0-9]{32}$/i);
    assert.match(manifest.sha256, /^[a-f0-9]{64}$/i);
    assert(Number.isSafeInteger(manifest.bytes) && manifest.bytes > 0);
    const archive = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(manifest.iv, "hex"),
    );
    archive.setAuthTag(Buffer.from(manifest.tag, "hex"));
    const hash = createHash("sha256");
    let length = 0;
    await pipeline(
      createReadStream(input.archivePath),
      archive,
      new Writable({
        write(chunk, _encoding, done) {
          hash.update(chunk);
          length += chunk.length;
          done();
        },
      }),
    );
    assert.equal(length, manifest.bytes, "Backup plaintext length mismatch");
    assert.equal(
      hash.digest("hex"),
      manifest.sha256,
      "Backup plaintext hash mismatch",
    );
    return {
      authenticated: true as const,
      capturedAt: manifest.at as string,
      projectRef: input.projectRef,
      bytes: length,
      plaintextSha256: manifest.sha256 as string,
      tableCount: Object.keys(manifest.sums ?? {}).length,
      plaintextWritten: false as const,
    };
  } finally {
    key.fill(0);
  }
}
