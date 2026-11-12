import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { authenticateDatabaseBackup } from "../../scripts/lib/authenticated-database-backup";

test("backup authentication rejects wrong targets, stale captures, ciphertext corruption and wrong keys without plaintext output", async () => {
  const dir = await mkdtemp(
    path.join(tmpdir(), "docked-encrypted-backup-test-"),
  );
  try {
    const key = randomBytes(32),
      body = Buffer.from("SYNTHETIC RECOVERY FIXTURE ONLY");
    const encode = (bytes: Buffer) => {
      const iv = randomBytes(12),
        c = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([c.update(bytes), c.final()]);
      return { iv, tag: c.getAuthTag(), ciphertext };
    };
    const archive = encode(body),
      now = Date.now();
    const manifest = encode(
      Buffer.from(
        JSON.stringify({
          project: "isolated-test",
          at: new Date(now - 1000).toISOString(),
          iv: archive.iv.toString("hex"),
          tag: archive.tag.toString("hex"),
          sha256: createHash("sha256").update(body).digest("hex"),
          bytes: body.length,
          sums: { synthetic: { count: 1 } },
        }),
      ),
    );
    const input = {
      keyPath: path.join(dir, "key"),
      manifestPath: path.join(dir, "manifest.aes"),
      archivePath: path.join(dir, "archive.aes"),
      projectRef: "isolated-test",
      maxAgeMs: 3600000,
      now,
    };
    await writeFile(input.keyPath, key.toString("hex"));
    await writeFile(input.archivePath, archive.ciphertext);
    await writeFile(
      input.manifestPath,
      Buffer.concat([manifest.iv, manifest.tag, manifest.ciphertext]),
    );
    const result = await authenticateDatabaseBackup(input);
    assert.equal(result.authenticated, true);
    assert.equal(result.bytes, body.length);
    assert.equal(result.plaintextWritten, false);
    await assert.rejects(
      authenticateDatabaseBackup({ ...input, projectRef: "wrong" }),
      /project mismatch/,
    );
    await assert.rejects(
      authenticateDatabaseBackup({ ...input, now: now + 3600000 }),
      /Fresh authenticated/,
    );
    const corrupt = Buffer.from(archive.ciphertext);
    corrupt[0] ^= 1;
    await writeFile(input.archivePath, corrupt);
    await assert.rejects(authenticateDatabaseBackup(input));
    await writeFile(input.archivePath, archive.ciphertext);
    await writeFile(input.keyPath, randomBytes(32).toString("hex"));
    await assert.rejects(authenticateDatabaseBackup(input));
  } finally {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(tmpdir()));
    assert(path.basename(dir).startsWith("docked-encrypted-backup-test-"));
    await rm(dir, { recursive: true, force: true });
  }
});
