/** Exact Git package, disconnected freshly restored Production backup only. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createDecipheriv } from "node:crypto";
import { checksumQuery } from "./lib/reviewed-inventory";
import {
  packet,
  blob,
  root,
  evidence,
  sourceCommit,
  packageSha256,
} from "./lib/season-catalogue-package.mjs";
const p = packet(),
  target = "docked-commercial-restore-20261115";
const report = JSON.parse(
  readFileSync(
    root +
      "/docs/qa/v31-prelaunch-execution-20261111/database/restore-20261115/restore-only.json",
    "utf8",
  ),
);
assert.equal(report.restored, true);
assert.equal(report.restoreTarget, target);
const config = JSON.parse(
  execFileSync("docker", ["inspect", target], { windowsHide: true }).toString(),
)[0];
assert.equal(config.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(config.HostConfig.PortBindings ?? {}).length, 0);
const key = Buffer.from(
  readFileSync(
    process.env.USERPROFILE +
      "/.docked-secrets/launch-migration-backup-key.hex",
    "utf8",
  ).trim(),
  "hex",
);
const encrypted = readFileSync(
  root + "/private-data/commercial-restore-20261115/manifest.aes",
);
const decipher = createDecipheriv(
  "aes-256-gcm",
  key,
  encrypted.subarray(0, 12),
);
decipher.setAuthTag(encrypted.subarray(12, 28));
const manifest = JSON.parse(
  Buffer.concat([
    decipher.update(encrypted.subarray(28)),
    decipher.final(),
  ]).toString(),
);
key.fill(0);
assert.equal(manifest.sha256, report.archiveSha256);
function sql(query: string) {
  return execFileSync(
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
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    { input: query, windowsHide: true, maxBuffer: 32e6 },
  )
    .toString()
    .split(/\r?\n/)
    .filter((s) => s.startsWith("{") || s.startsWith("["))
    .map((s) => JSON.parse(s));
}
const names = Object.keys(manifest.sums).filter(
  (t) => !['"net"."_http_response"', '"net"."http_request_queue"'].includes(t),
);
const literal = (s: string) => "'" + s.replaceAll("'", "''") + "'";
const migrations = p.productionMigrations
  .map((f: any) => blob(f.file).toString())
  .join("\n");
const record = p.productionMigrations
  .map(
    (f: any) =>
      `insert into supabase_migrations.schema_migrations(version,name,statements)values(${literal(f.version)},${literal(f.name)},array[${literal(blob(f.file).toString())}]);`,
  )
  .join("\n");
const queries = names
  .map((t) =>
    t === '"supabase_migrations"."schema_migrations"'
      ? `select jsonb_build_object('table',${literal(t)},'count',count(*),'hash',md5(coalesce(string_agg(h,'' order by h),''))) from(select md5(to_jsonb(t)::text)h from supabase_migrations.schema_migrations t where version not in('20261115011415','20261115011418'))q`
      : checksumQuery(t),
  )
  .join(";\n");
const result = sql(
  "begin;set local lock_timeout='3s';set local statement_timeout='120s';" +
    blob(p.preflight.file).toString() +
    migrations +
    blob(p.adoption.file).toString() +
    record +
    "set constraints all immediate;" +
    queries +
    ";rollback;",
);
assert.equal(result.length, names.length);
for (const r of result)
  assert.deepEqual(
    { count: r.count, hash: r.hash },
    manifest.sums[r.table],
    r.table,
  );
assert.equal(
  sql(
    "select jsonb_build_object('present',to_regnamespace('season_catalogue') is not null)",
  )[0].present,
  false,
  "Rollback did not remove new catalogue",
);
writeFileSync(
  evidence + "/fresh-package-rehearsal.json",
  JSON.stringify(
    {
      at: new Date().toISOString(),
      sourceCommit,
      packageSha256,
      target,
      backupAt: manifest.at,
      archiveSha256: manifest.sha256,
      exactGitBytes: true,
      protectedTables: names.length,
      existingRowsUnchanged: true,
      migrationHistoryAppendsOnly: 2,
      transactionRolledBack: true,
      productionWrites: 0,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "PASS fresh exact package rehearsal, protected rows and complete rollback",
);
