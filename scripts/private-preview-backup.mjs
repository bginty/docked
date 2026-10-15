// Read-only exact Preview backup using the existing local PostgreSQL tools.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
const ref = "bckkllmndoxzpzdqrevb",
  dir = "private-data/private-preview-release";
await mkdir(dir, { recursive: true });
await mkdir("docs/qa/private-preview-release", { recursive: true });
const c = JSON.parse(
  await readFile("private-data/hosted-preview/connection.json", "utf8"),
);
assert.equal(c.projectRef, ref);
const u = new URL(c.databaseUrl);
assert.ok(
  u.hostname === `db.${ref}.supabase.co` ||
    (u.hostname.endsWith(".pooler.supabase.com") &&
      decodeURIComponent(u.username) === `postgres.${ref}`),
);
assert.equal(u.port, "5432");
const container = "docked-market-http-db-1";
const quote = (v) => "'" + v.replaceAll("'", "'\\''") + "'";
execFileSync(
  "docker",
  [
    "cp",
    "certs/supabase-prod-ca-2021.crt",
    container + ":/tmp/docked-preview-ca.crt",
  ],
  { windowsHide: true, stdio: "pipe" },
);
const file = dir + "/before-migrations.dump";
if (!process.argv.includes("--verify-existing")) {
  const output = createWriteStream(file, { flags: "wx", mode: 0o600 });
  const closed = new Promise((resolve) => output.on("close", resolve));
  const script =
    Object.entries({
      PGCONNECT_TIMEOUT: "20",
      PGHOST: u.hostname,
      PGPORT: u.port,
      PGUSER: decodeURIComponent(u.username),
      PGPASSWORD: decodeURIComponent(u.password),
      PGDATABASE: "postgres",
      PGSSLMODE: "verify-full",
      PGSSLROOTCERT: "/tmp/docked-preview-ca.crt",
    })
      .map(([k, v]) => `export ${k}=${quote(v)}`)
      .join("\n") +
    "\nexec pg_dump -Fc --no-owner --no-acl --schema=public --schema=private --schema=fantasy --schema=preview_auth --schema=auth --schema=supabase_migrations\n";
  const child = spawn("docker", ["exec", "-i", container, "sh", "-s"], {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdout.pipe(output);
  let stderr = "";
  child.stderr.on("data", (b) => {
    stderr += b;
  });
  child.stdin.end(script);
  const status = await new Promise((resolve) => child.on("close", resolve));
  await closed;
  if (status !== 0) {
    await writeFile(dir + "/backup-error.private.txt", stderr, { mode: 0o600 });
    throw Error(
      "Preview backup failed; private diagnostic retained; no mutation attempted",
    );
  }
}
const bytes = await readFile(file);
assert.equal(bytes.subarray(0, 5).toString(), "PGDMP");
execFileSync(
  "docker",
  ["cp", file, container + ":/tmp/docked-preview-backup.dump"],
  { windowsHide: true, stdio: "pipe" },
);
const toc = execFileSync(
  "docker",
  [
    "exec",
    container,
    "pg_restore",
    "--list",
    "/tmp/docked-preview-backup.dump",
  ],
  { windowsHide: true, encoding: "utf8", maxBuffer: 8e6 },
);
assert.ok(toc.includes("TABLE DATA") && toc.includes("schema_migrations"));
execFileSync(
  "docker",
  [
    "exec",
    container,
    "pg_restore",
    "--file=/dev/null",
    "/tmp/docked-preview-backup.dump",
  ],
  { windowsHide: true, stdio: "pipe", maxBuffer: 8e6 },
);
const report = {
  at: new Date().toISOString(),
  projectRef: ref,
  bytes: bytes.length,
  sha256: createHash("sha256").update(bytes).digest("hex"),
  archiveReadable: true,
  scope:
    "Preview application, Auth and migration schemas; access-restricted local archive. Storage objects excluded. No hosted writes.",
  restorationTested: false,
};
await writeFile(
  "docs/qa/private-preview-release/backup.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report));
