// Windows loopback test using the verified archive. Only catalogue rows and historical digests leave memory.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomBytes, createDecipheriv, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { buildSync } from "esbuild";
import { pathToFileURL } from "node:url";
import postgres from "postgres";
const qa = "docs/qa/google-refund-repair-20261120",
  work = "private-data/google-refund-repair-20261120";
const driver = path.resolve(work, "driver");
fs.mkdirSync(driver, { recursive: true });
fs.writeFileSync(
  path.join(driver, "environments.json"),
  JSON.stringify(
    JSON.parse(fs.readFileSync(path.join(qa, "environment.json"))).scenarios,
  ),
);
const ids = JSON.parse(
  fs.readFileSync(
    "docs/qa/final-release-decision-20261117/season-eligibility.json",
  ),
).proposedDefinitionIds;
fs.writeFileSync(path.join(driver, "eligible.json"), JSON.stringify(ids));
buildSync({
  entryPoints: [path.join(qa, "restored-refunds.mjs")],
  bundle: true,
  conditions: ["react-server"],
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: path.join(driver, "test.cjs"),
});
const pgBin = path.resolve("tmp/postgres-client-17.12/bin");
const socket = createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const password = randomBytes(32).toString("hex"),
  dataDir = path.resolve(work, "native-" + randomBytes(8).toString("hex"));
const runtime = path.resolve(
  "tmp/free-play-postgres-runtime/node_modules/embedded-postgres",
);
assert.equal(
  JSON.parse(fs.readFileSync(path.join(runtime, "package.json"))).version,
  "17.10.0-beta.17",
);
const { default: PG } = await import(
  pathToFileURL(path.join(runtime, "dist/index.js")).href
);
const server = new PG({
  databaseDir: dataDir,
  user: "postgres",
  password,
  port,
  persistent: true,
  authMethod: "scram-sha-256",
  createPostgresUser: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: [
    "-h",
    "127.0.0.1",
    "-c",
    "cron.launch_active_jobs=off",
    "-c",
    "docked.refund_fixture=refund-repair-20261120",
  ],
  onLog: () => {},
  onError: () => {},
});
const sha = (b) => createHash("sha256").update(b).digest("hex");
function decrypt(key, iv, tag, body) {
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]);
}
const archiveDir = path.resolve(
  process.argv[2] ?? "private-data/commercial-restore-20261120f",
);
const evidence = JSON.parse(
  fs.readFileSync(
    "docs/qa/v31-prelaunch-execution-20261111/database/restore-20261120f/restore-only.json",
  ),
);
const key = Buffer.from(
  fs
    .readFileSync(
      path.join(
        process.env.USERPROFILE,
        ".docked-secrets",
        "launch-migration-backup-key.hex",
      ),
      "utf8",
    )
    .trim(),
  "hex",
);
const m = fs.readFileSync(path.join(archiveDir, "manifest.aes"));
const manifest = JSON.parse(
  decrypt(key, m.subarray(0, 12), m.subarray(12, 28), m.subarray(28)),
);
assert.equal(manifest.project, evidence.sourceProject);
const archive = decrypt(
  key,
  Buffer.from(manifest.iv, "hex"),
  Buffer.from(manifest.tag, "hex"),
  fs.readFileSync(path.join(archiveDir, "production.dump.aes")),
);
key.fill(0);
assert.equal(sha(archive), evidence.archiveSha256);
assert.equal(archive.length, manifest.bytes);
function readTable(schema, table) {
  const proc = spawnSync(
    path.join(pgBin, "pg_restore.exe"),
    ["--data-only", "--schema", schema, "--table", table, "--file", "-"],
    { input: archive, windowsHide: true, maxBuffer: 128e6 },
  );
  assert(
    proc.status === 0,
    "Isolated archive read failed for " + schema + "." + table,
  );
  const txt = proc.stdout.toString("utf8"),
    start = txt.indexOf("COPY " + schema + "." + table + " (");
  assert(start >= 0);
  const end = txt.indexOf("\n", start),
    columns = txt.slice(start, end).split("(")[1].split(")")[0].split(", ");
  const close = txt.indexOf("\n\\.", end);
  const rows = txt.slice(end + 1, close).replaceAll("\r", "");
  return { rows, columns };
}
let sql,
  started = false;
try {
  await server.initialise();
  await server.start();
  started = true;
  await server.createDatabase("docked_refund_fixture_20261120");
  const local = {
    host: "127.0.0.1",
    port,
    username: "postgres",
    password,
    database: "docked_refund_fixture_20261120",
    max: 1,
    onnotice: () => {},
  };
  sql = postgres(local);
  await sql.unsafe(
    "create role anon;create role authenticated;create role service_role;create schema fixture;create table fixture.archived_history(relation_name text primary key,row_count integer not null,google_count int,digest text not null)",
  );
  await sql.unsafe(
    fs.readFileSync(
      "supabase/migrations/20261101120754_commercial_google_ledger.sql",
      "utf8",
    ),
  );
  await sql.unsafe(
    fs.readFileSync(
      "supabase/migrations/20261109231834_commercial_lifetime_supply_guards.sql",
      "utf8",
    ),
  );
  await sql.unsafe(
    "create role docked_commercial_runtime login password '" +
      password +
      "' in role docked_commercial_app;create role docked_app login password '" +
      password +
      "'",
  );
  const limits = {};
  for (const [schema, table] of [
    ["credits_sandbox", "store_receipts"],
    ["credits_sandbox", "state"],
    ["beta_packs", "issued"],
    ["launch_transition", "accounts"],
  ]) {
    const { rows, columns } = readTable(schema, table),
      lines = rows ? rows.split("\n") : [],
      google =
        table === "store_receipts"
          ? lines.filter(
              (l) => l.split("\t")[columns.indexOf("provider")] === "google",
            ).length
          : null;
    await sql`insert into fixture.archived_history values(${schema + "." + table},${lines.length},${google},${sha(rows)})`;
    limits[schema + "." + table] = { rows: lines.length, google };
  }
  await sql.unsafe(
    "create schema beta_packs;create table beta_packs.issued(card uuid primary key,definition uuid not null,serial int not null,unique(definition,serial))",
  );
  const beta = readTable("beta_packs", "issued");
  for (const row of beta.rows.split("\n")) {
    const data = row.split("\t");
    await sql`insert into beta_packs.issued values(${data[beta.columns.indexOf("card")]},${data[beta.columns.indexOf("definition")]},${data[beta.columns.indexOf("serial")]})`;
  }
  const bridge = fs.readFileSync(
    "supabase/migrations/20261115043326_founder_credit_pack_lifetime_bridge.sql",
    "utf8",
  );
  const guard = bridge.slice(
    bridge.indexOf(
      "create or replace function commercial_billing.supply_balanced()",
    ),
    bridge.indexOf("-- Preserve every pre-existing guard"),
  );
  assert(
    guard.startsWith("create or replace") &&
      guard.includes("beta_serial_collision"),
  );
  await sql.unsafe(guard);
  const defs = readTable("commercial_billing", "definitions");
  assert(defs.columns.every((k) => /^[a-z_]+$/.test(k)));
  assert.equal(defs.rows.split("\n").length, 6540);
  const copy =
    "COPY commercial_billing.definitions (" +
    defs.columns.join(", ") +
    ") FROM STDIN;\n" +
    defs.rows +
    "\n\\.\n";
  const childEnv = {
    ...process.env,
    PGHOST: local.host,
    PGPORT: String(port),
    PGDATABASE: local.database,
    PGUSER: local.username,
    PGPASSWORD: password,
    PGSSLMODE: "disable",
  };
  const add = spawnSync(
    path.join(pgBin, "psql.exe"),
    ["-X", "-v", "ON_ERROR_STOP=1", "-q"],
    {
      input: copy,
      env: childEnv,
      windowsHide: true,
      encoding: "utf8",
      maxBuffer: 2e6,
    },
  );
  if (add.status !== 0)
    throw Error("Isolated catalogue COPY failed: " + add.stderr.split("\n")[0]);
  console.log(
    "Restored catalogue:",
    defs.rows.split("\n").length,
    "and protected reference digests",
    JSON.stringify(limits),
  );
  const counts =
    await sql`select sum(issued)::int issued,sum(legacy_issued)::int historical from commercial_billing.definitions`;
  assert.equal(
    counts[0].issued,
    counts[0].historical + beta.rows.split("\n").length,
  );
  // The real scheduled worker needs current account status for non-refunded purchases only.
  await sql.unsafe(
    "create schema auth;create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean,banned_until timestamptz);create table public.profiles(id uuid primary key,disabled_at timestamptz);create schema private;create view private.runtime_auth_users as select * from auth.users;grant usage on schema private to docked_app;grant select on private.runtime_auth_users,public.profiles to docked_app",
  );
  archive.fill(0);
  const child = spawnSync(
    process.execPath,
    [path.resolve(work, "driver/test.cjs")],
    {
      env: {
        SystemRoot: process.env.SystemRoot,
        PATH: process.env.PATH,
        REFUND_FIXTURE_PORT: String(port),
        REFUND_FIXTURE_PASSWORD: password,
        REFUND_FIXTURE_INPUT: path.resolve(work, "driver"),
      },
      windowsHide: true,
      stdio: "inherit",
      timeout: 120000,
    },
  );
  if (child.status !== 0)
    throw Error("Isolated application scenarios did not pass");
} finally {
  archive.fill(0);
  if (sql) await sql.end();
  if (started) {
    const stop = spawnSync(
      path.join(pgBin, "pg_ctl.exe"),
      ["-D", dataDir, "-m", "fast", "-w", "-t", "30", "stop"],
      { windowsHide: true, stdio: "ignore" },
    );
    server.process = undefined;
    assert.equal(stop.status, 0);
  }
}
