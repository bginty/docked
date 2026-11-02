/** Read-only field-level review. Auth values stay in memory; evidence has names/counts only. */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createDecipheriv, createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { readArchivedRows, textRowsQuery } from "./lib/backup-row-review";
async function main() {
  const root = process.cwd();
  const vault = root + "/private-data/commercial-restore-20261102d";
  const keyBytes = Buffer.from(
    (
      await fs.readFile(
        process.env.USERPROFILE +
          "/.docked-secrets/launch-migration-backup-key.hex",
        "utf8",
      )
    ).trim(),
    "hex",
  );
  const raw = await fs.readFile(vault + "/manifest.aes"),
    d = createDecipheriv("aes-256-gcm", keyBytes, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  const manifest = JSON.parse(
    Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString(),
  );
  const a = createDecipheriv(
    "aes-256-gcm",
    keyBytes,
    Buffer.from(manifest.iv, "hex"),
  );
  a.setAuthTag(Buffer.from(manifest.tag, "hex"));
  const archive = Buffer.concat([
    a.update(await fs.readFile(vault + "/production.dump.aes")),
    a.final(),
  ]);
  assert.equal(
    createHash("sha256").update(archive).digest("hex"),
    manifest.sha256,
  );
  const drift = JSON.parse(
    await fs.readFile(
      "docs/qa/final-australia-20261102/migrations/drift.json",
      "utf8",
    ),
  );
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const reviews: Record<string, unknown>[] = [];
    await sql.begin("isolation level repeatable read read only", async (tx) => {
      await tx`set local time zone 'UTC'`;
      for (const table of drift.unexpectedDrift) {
        assert.match(table, /^"[a-z_]+"\."[a-z_]+"$/);
        const keyColumns = (
          await tx`select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey) where i.indrelid=to_regclass(${table}) and i.indisprimary order by a.attnum`
        ).map((r) => r.attname);
        assert(keyColumns.length);
        const columns =
          await tx`select attname name,format_type(atttypid,atttypmod) type from pg_attribute where attrelid=to_regclass(${table}) and attnum>0 and not attisdropped and attgenerated='' order by attnum`;
        const result = spawnSync(
          "docker",
          [
            "exec",
            "-i",
            "supabase_db_deletion-auth-local",
            "pg_restore",
            "--data-only",
            "--table=" + table.split(".")[1].replaceAll('"', ""),
            "--file=-",
          ],
          {
            input: archive,
            encoding: "utf8",
            maxBuffer: 64 * 1024 * 1024,
            windowsHide: true,
          },
        );
        if (result.status !== 0) {
          await fs.writeFile(
            root +
              "/private-data/commercial-restore-20261102d/drift-review-error.private.log",
            result.stderr,
            { mode: 0o600 },
          );
          throw Error(
            "Local restored read failed; private diagnostic retained",
          );
        }
        const previous = readArchivedRows(result.stdout, table);
        const current = (
          await tx.unsafe(
            textRowsQuery(
              table,
              columns.map((c) => ({
                name: String(c.name),
                type: String(c.type),
              })),
            ),
          )
        ).map((r) => r.value);
        const key = (r: Record<string, unknown>) =>
          JSON.stringify(keyColumns.map((k) => r[k]));
        const old = new Map<string, Record<string, unknown>>(
          previous.map((r: Record<string, unknown>) => [key(r), r]),
        );
        const changed: Record<string, number> = {};
        let added = 0,
          updated = 0;
        for (const row of current) {
          const p = old.get(key(row));
          if (!p) {
            added++;
            continue;
          }
          old.delete(key(row));
          const fields = [
            ...new Set([...Object.keys(p), ...Object.keys(row)]),
          ].filter((k) => JSON.stringify(p[k]) !== JSON.stringify(row[k]));
          if (fields.length) updated++;
          for (const field of fields)
            changed[field] = (changed[field] ?? 0) + 1;
        }
        reviews.push({
          table,
          keyColumns,
          columns: columns.map((c) => c.name),
          previousRows: previous.length,
          currentRows: current.length,
          added,
          removed: old.size,
          updated,
          changedFields: changed,
        });
      }
    });
    const report = {
      at: new Date().toISOString(),
      backupAt: drift.backupAt,
      mutations: 0,
      valuesDisclosed: false,
      reviews,
    };
    await fs.writeFile(
      "docs/qa/final-australia-20261102/migrations/operational-drift-review.json",
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Drift review failed");
  process.exitCode = 1;
});
