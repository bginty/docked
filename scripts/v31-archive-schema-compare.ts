/** Local authenticated archive comparison; no database connection or SQL execution. */
import assert from "node:assert/strict";
import { createDecipheriv, createHash } from "node:crypto";
import { createReadStream, readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Writable } from "node:stream";

const evidence = "docs/qa/v31-founder-session-20261112/";
const key = Buffer.from(
  readFileSync(
    process.env.USERPROFILE +
      "/.docked-secrets/launch-migration-backup-key.hex",
    "utf8",
  ).trim(),
  "hex",
);
assert.equal(key.length, 32);
async function schema(run: "20261112b" | "20261112c") {
  const dir = "private-data/commercial-restore-" + run;
  const bytes = readFileSync(dir + "/manifest.aes");
  const md = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  md.setAuthTag(bytes.subarray(12, 28));
  const manifest = JSON.parse(
    Buffer.concat([md.update(bytes.subarray(28)), md.final()]).toString(),
  );
  assert.equal(manifest.project, "pojoymtniryarxxunyvz");
  const d = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(manifest.iv, "hex"),
  );
  d.setAuthTag(Buffer.from(manifest.tag, "hex"));
  const child = spawn(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_deletion-auth-local",
      "pg_restore",
      "--schema-only",
      "--file=-",
    ],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  let out = "";
  child.stdout.on("data", (b) => {
    out += b;
    assert(out.length < 32e6);
  });
  child.stderr.resume();
  const closed = new Promise<number | null>((resolve, reject) => {
    child.on("close", resolve);
    child.on("error", reject);
  });
  // Schema-only pg_restore can finish after the TOC, before archive data ends.
  // Continue authenticating/hashing the entire stream even after its pipe closes.
  let inputClosed = false,
    plaintextBytes = 0;
  const plaintextHash = createHash("sha256");
  child.stdin.on("error", () => {
    inputClosed = true;
  });
  await pipeline(
    createReadStream(dir + "/production.dump.aes"),
    d,
    new Writable({
      write(chunk, _encoding, callback) {
        plaintextHash.update(chunk);
        plaintextBytes += chunk.length;
        if (inputClosed) return callback();
        child.stdin.write(chunk, (error) => {
          if (error) inputClosed = true;
          callback(
            error &&
              !["EPIPE", "EOF"].includes(
                (error as NodeJS.ErrnoException).code ?? "",
              )
              ? error
              : undefined,
          );
        });
      },
      final(callback) {
        if (!inputClosed) child.stdin.end();
        callback();
      },
    }),
  );
  assert.equal(plaintextBytes, manifest.bytes, "Archive byte count mismatch");
  assert.equal(
    plaintextHash.digest("hex"),
    manifest.sha256,
    "Archive checksum mismatch",
  );
  assert.equal(await closed, 0, "Read-only archive schema extraction failed");
  const records = new Map<
    string,
    { schema: string; name: string; type: string; owner: string; hash: string }
  >();
  for (const block of out.split(/\n--\n-- Name: /).slice(1)) {
    const end = block.indexOf("\n");
    const header = block
      .slice(0, end)
      .match(/^(.*); Type: (.*); Schema: (.*); Owner: (.*)$/);
    assert(header, "Unexpected archive object header");
    const [, name, type, schemaName, owner] = header;
    const body = block
      .slice(end)
      .replace(/^\\(?:un)?restrict .*$/gm, "")
      .replace(/\n--\n-- PostgreSQL database dump complete[\s\S]*$/, "")
      .trim();
    const identity = JSON.stringify([schemaName, type, name, owner]);
    assert(!records.has(identity), "Duplicate archive object identity");
    records.set(identity, {
      schema: schemaName,
      owner,
      name,
      type,
      hash: createHash("sha256").update(body).digest("hex"),
    });
  }
  assert(records.size > 1000, "Incomplete schema archive");
  return { at: manifest.at, records };
}
async function main() {
  const previous = await schema("20261112b"),
    current = await schema("20261112c");
  const added = [...current.records]
    .filter(([id]) => !previous.records.has(id))
    .map(([, r]) => r);
  const removed = [...previous.records]
    .filter(([id]) => !current.records.has(id))
    .map(([, r]) => r);
  const changed = [...current.records]
    .filter(
      ([id, r]) =>
        previous.records.has(id) && previous.records.get(id)!.hash !== r.hash,
    )
    .map(([id, r]) => ({ ...r, previousHash: previous.records.get(id)!.hash }));
  const result = {
    at: new Date().toISOString(),
    productionWrites: 0,
    plaintextFilesWritten: false,
    method:
      "Original authenticated pg_dump archives compared via pg_restore schema-only, before any restore transformations",
    beforeAt: previous.at,
    afterAt: current.at,
    previousObjects: previous.records.size,
    currentObjects: current.records.size,
    added,
    removed,
    changed,
    changesOutsideStorage: [...added, ...removed, ...changed].filter(
      (r) => r.schema !== "storage",
    ),
  };
  writeFileSync(
    evidence + "provider-storage-archive-schema-diff.json",
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      added: added.length,
      removed: removed.length,
      changed: changed.length,
      outsideStorage: result.changesOutsideStorage.map((r) => ({
        schema: r.schema,
        type: r.type,
        name: r.name,
      })),
    }),
  );
}
void main()
  .catch((error) => {
    console.error(
      "Authenticated archive schema comparison failed; no SQL executed or private values emitted",
    );
    console.error(
      JSON.stringify({
        code: error?.code ?? null,
        reason:
          error?.code === "ERR_ASSERTION"
            ? String(error.message).split("\n")[0]
            : "Extraction or parsing failed",
      }),
    );
    process.exitCode = 1;
  })
  .finally(() => key.fill(0));
