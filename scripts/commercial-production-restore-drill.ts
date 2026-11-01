/** Read-only Production capture, encrypted at rest, then network-isolated restore.
 * Never applies a hosted migration, starts an Auth/API service, or launches cron.
 * Requires the existing operator-held backup key; reports no customer rows/secrets. */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { Transform, Writable } from "node:stream";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const root = process.cwd(),
  main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const runId = process.env.DOCKED_RESTORE_RUN ?? "20261102";
assert.match(runId, /^20261102[a-z]?$/);
const dir = root + "/private-data/commercial-restore-" + runId;
const evidence =
  root +
  (runId === "20261102"
    ? "/docs/qa/public-activation-20261102"
    : "/docs/qa/approved-production-20261102/restore");
const client = "supabase_db_deletion-auth-local",
  target = "docked-commercial-restore-" + runId;
const image = "public.ecr.aws/supabase/postgres:17.11.0.002";
let createdTarget = false;
const files = [
  "20261101120754_commercial_google_ledger.sql",
  "20261102010000_commercial_lineup_inventory.sql",
  "20261102010001_public_customer_gameplay.sql",
];
const tables = [
  "auth.users",
  "private.profiles",
  "private.feature_flags",
  "beta_fantasy.cards",
  "beta_fantasy.entries",
  "beta_fantasy.results",
  "beta_fantasy.competitions",
  "beta_fantasy.ownership_events",
  "beta_fantasy.sales",
  "credits_sandbox.state",
  "credits_sandbox.card_instances",
  "credits_sandbox.pack_receipts",
  "credits_sandbox.journal",
  "sports_feed.nfl_control",
  "sports_feed.nfl_rounds",
  "sports_feed.sport_sandbox_inventory",
  "sports_feed.sport_rounds",
  "supabase_migrations.schema_migrations",
];
type Role = {
  rolname: string;
  rolsuper: boolean;
  rolinherit: boolean;
  rolcreaterole: boolean;
  rolcreatedb: boolean;
  rolreplication: boolean;
  rolbypassrls: boolean;
};
type Membership = { role: string; member: string };
type Checksum = { count: number; hash: string };
type Manifest = {
  at: string;
  project: string;
  bytes: number;
  sha256: string;
  iv: string;
  tag: string;
  roles: Role[];
  members: Membership[];
  sums: Record<string, Checksum>;
  rolesCapturedAt?: string;
};
const quote = (x: string) => "'" + x.replaceAll("'", "'\\''") + "'";
const sqlQuote = (x: string) => '"' + x.replaceAll('"', '""') + '"';
const run = async (args: string[], input?: string | Buffer) => {
  const p = spawn("docker", args, {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let out = "",
    err = "";
  p.stdout.on("data", (b) => (out += b));
  p.stderr.on("data", (b) => (err += b));
  p.stdin.end(input);
  const code = await new Promise<number | null>((r, j) => {
    p.on("error", j);
    p.on("close", r);
  });
  if (code !== 0) {
    await writeFile(dir + "/diagnostic.private.log", err, { mode: 0o600 });
    throw Error("Docker operation failed; private diagnostic retained");
  }
  return out;
};
const local = (sql: string) =>
  run(
    [
      "exec",
      "-i",
      target,
      "psql",
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
    sql,
  );
const checksumQuery = (table: string) =>
  `select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(h,'' order by h),''))) value from(select md5(to_jsonb(t)::text) h from ${table} t)q`;
const encrypt = async (bytes: Buffer, key: Buffer, path: string) => {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key, iv),
    cipher = Buffer.concat([c.update(bytes), c.final()]);
  await writeFile(path, Buffer.concat([iv, c.getAuthTag(), cipher]), {
    flag: "wx",
    mode: 0o600,
  });
};
async function mainRun() {
  await mkdir(dir, { recursive: true });
  await mkdir(evidence, { recursive: true });
  const key = Buffer.from(
    (
      await readFile(
        process.env.USERPROFILE +
          "/.docked-secrets/launch-migration-backup-key.hex",
        "utf8",
      )
    ).trim(),
    "hex",
  );
  assert.equal(key.length, 32);
  if (process.argv.includes("--verify-archive")) {
    const bytes = await readFile(dir + "/manifest.aes");
    const md = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
    md.setAuthTag(bytes.subarray(12, 28));
    const manifest: Manifest = JSON.parse(
      Buffer.concat([md.update(bytes.subarray(28)), md.final()]).toString(),
    );
    const d = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(manifest.iv, "hex"),
    );
    d.setAuthTag(Buffer.from(manifest.tag, "hex"));
    const hash = createHash("sha256");
    let restoredBytes = 0;
    await pipeline(
      createReadStream(dir + "/production.dump.aes"),
      d,
      new Writable({
        write(chunk, _encoding, callback) {
          hash.update(chunk);
          restoredBytes += chunk.length;
          callback();
        },
      }),
    );
    assert.equal(restoredBytes, manifest.bytes);
    assert.equal(hash.digest("hex"), manifest.sha256);
    const verification = {
      at: new Date().toISOString(),
      authenticated: true,
      sha256Matches: true,
      bytes: restoredBytes,
      plaintextWritten: false,
    };
    await writeFile(
      evidence + "/archive-integrity.json",
      JSON.stringify(verification, null, 2),
    );
    console.log(JSON.stringify(verification));
    return;
  }
  const provision = JSON.parse(
    await readFile(
      main + "/private-data/production/provision-request.json",
      "utf8",
    ),
  );
  const url = new URL(
    (
      await readFile(
        main +
          "/private-data/production/provider-config/supabase/.temp/pooler-url",
        "utf8",
      )
    ).trim(),
  );
  assert.equal(url.username, "postgres.pojoymtniryarxxunyvz");
  assert.equal(url.port, "5432");
  assert.match(url.hostname, /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/);
  const resume = process.argv.includes("--restore-existing");
  let manifest: Manifest;
  if (!resume) {
    process.chdir(main);
    const sql = ownerDatabase();
    process.chdir(root);
    try {
      manifest = await sql.begin(
        "isolation level repeatable read read only",
        async (tx) => {
          await tx`set local statement_timeout='120s'`;
          const snapshot = (await tx`select pg_export_snapshot() snapshot`)[0]
            .snapshot;
          const roles =
            await tx`select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls from pg_roles where rolname !~ '^pg_'`;
          const members =
            await tx`select r.rolname role,m.rolname member from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member where r.rolname !~ '^pg_'`;
          const sums: Record<string, Checksum> = {};
          for (const t of tables) {
            if ((await tx`select to_regclass(${t}) name`)[0].name)
              sums[t] = (await tx.unsafe(checksumQuery(t)))[0].value;
          }
          await run([
            "cp",
            root + "/certs/supabase-prod-ca-2021.crt",
            client + ":/tmp/docked-restore-ca.crt",
          ]);
          const env = {
            PGHOST: url.hostname,
            PGPORT: url.port,
            PGUSER: decodeURIComponent(url.username),
            PGPASSWORD: provision.databasePassword,
            PGDATABASE: "postgres",
            PGCONNECT_TIMEOUT: "20",
            PGSSLMODE: "verify-full",
            PGSSLROOTCERT: "/tmp/docked-restore-ca.crt",
          };
          const script =
            Object.entries(env)
              .map(([k, v]) => `export ${k}=${quote(v)}`)
              .join("\n") +
            `\nexec pg_dump -Fc --snapshot=${quote(snapshot)} --lock-wait-timeout=15000\n`;
          const iv = randomBytes(12),
            cipher = createCipheriv("aes-256-gcm", key, iv),
            hash = createHash("sha256");
          let bytes = 0;
          const p = spawn("docker", ["exec", "-i", client, "sh", "-s"], {
            windowsHide: true,
            stdio: ["pipe", "pipe", "pipe"],
          });
          let err = "";
          p.stderr.on("data", (b) => (err += b));
          const code = new Promise<number | null>((r, j) => {
            p.on("close", r);
            p.on("error", j);
          });
          p.stdin.end(script);
          await pipeline(
            p.stdout,
            new Transform({
              transform(b, _e, cb) {
                bytes += b.length;
                hash.update(b);
                cb(null, b);
              },
            }),
            cipher,
            createWriteStream(dir + "/production.dump.aes", {
              flags: "wx",
              mode: 0o600,
            }),
          );
          if ((await code) !== 0) {
            await writeFile(dir + "/dump-error.private.log", err, {
              mode: 0o600,
            });
            throw Error(
              "Production export failed; encrypted partial archive retained; no writes",
            );
          }
          const m: Manifest = {
            at: new Date().toISOString(),
            project: "pojoymtniryarxxunyvz",
            bytes,
            sha256: hash.digest("hex"),
            iv: iv.toString("hex"),
            tag: cipher.getAuthTag().toString("hex"),
            roles: roles as unknown as Role[],
            members: members as unknown as Membership[],
            sums,
          };
          await encrypt(
            Buffer.from(JSON.stringify(m)),
            key,
            dir + "/manifest.aes",
          );
          return m;
        },
      );
    } finally {
      await sql.end({ timeout: 5 });
    }
  } else {
    const b = await readFile(dir + "/manifest.aes"),
      d = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
    d.setAuthTag(b.subarray(12, 28));
    manifest = JSON.parse(
      Buffer.concat([d.update(b.subarray(28)), d.final()]).toString(),
    );
    // The original capture used SQL LIKE 'pg_%', whose underscore also matched
    // pgbouncer. Refresh role definitions only; never credentials or table data.
    if (!manifest.roles.some((r) => r.rolname === "pgbouncer")) {
      const cached = await stat(dir + "/roles.aes").then(
        () => true,
        (e) => {
          if (e.code === "ENOENT") return false;
          throw e;
        },
      );
      if (cached) {
        const b = await readFile(dir + "/roles.aes"),
          d = createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
        d.setAuthTag(b.subarray(12, 28));
        const extra = JSON.parse(
          Buffer.concat([d.update(b.subarray(28)), d.final()]).toString(),
        );
        manifest.roles = extra.roles;
        manifest.members = extra.members;
        manifest.rolesCapturedAt = extra.at;
      } else {
        process.chdir(main);
        const sql = ownerDatabase();
        process.chdir(root);
        try {
          const extra = await sql.begin("read only", async (tx) => ({
            roles:
              await tx`select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls from pg_roles where rolname !~ '^pg_'`,
            members:
              await tx`select r.rolname role,m.rolname member from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member where r.rolname !~ '^pg_'`,
          }));
          manifest.roles = extra.roles as unknown as Role[];
          manifest.members = extra.members as unknown as Membership[];
          manifest.rolesCapturedAt = new Date().toISOString();
          await encrypt(
            Buffer.from(
              JSON.stringify({ ...extra, at: manifest.rolesCapturedAt }),
            ),
            key,
            dir + "/roles.aes",
          );
        } finally {
          await sql.end({ timeout: 5 });
        }
      }
    }
  }
  {
    await run([
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
      "initdb -D /restore/data -A trust --no-locale --encoding=UTF8 >/restore/init.log 2>&1 && exec postgres -D /restore/data -c listen_addresses='' -c unix_socket_directories=/restore -c shared_preload_libraries=pg_cron,pg_net -c cron.launch_active_jobs=off -c pg_net.database_name=network_worker_disabled",
    ]);
    createdTarget = true;
    await run(["start", target]);
    let ready = false;
    for (let n = 0; n < 20; n++) {
      try {
        await local("select 1;");
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    assert(ready);
    for (const r of manifest.roles) {
      if (r.rolname === "postgres") continue;
      await local(
        `create role ${sqlQuote(r.rolname)} ${r.rolsuper ? "superuser" : "nosuperuser"} ${r.rolinherit ? "inherit" : "noinherit"} ${r.rolcreaterole ? "createrole" : "nocreaterole"} ${r.rolcreatedb ? "createdb" : "nocreatedb"} ${r.rolreplication ? "replication" : "noreplication"} ${r.rolbypassrls ? "bypassrls" : "nobypassrls"} nologin;`,
      );
    }
    for (const m of manifest.members)
      await local(`grant ${sqlQuote(m.role)} to ${sqlQuote(m.member)};`);
  }
  const p = spawn(
    "docker",
    [
      "exec",
      "-i",
      target,
      "pg_restore",
      "--exit-on-error",
      "--no-owner",
      "-h",
      "/restore",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  let err = "";
  p.stderr.on("data", (b) => (err += b));
  p.stdout.resume();
  const code = new Promise<number | null>((r, j) => {
    p.on("close", r);
    p.on("error", j);
  });
  const d = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(manifest.iv, "hex"),
  );
  d.setAuthTag(Buffer.from(manifest.tag, "hex"));
  let streamError: unknown;
  try {
    await pipeline(createReadStream(dir + "/production.dump.aes"), d, p.stdin);
  } catch (error) {
    streamError = error;
  }
  if ((await code) !== 0) {
    await writeFile(dir + "/restore-error.private.log", err, { mode: 0o600 });
    throw Error(
      "Restore needs compatibility repair; no hosted mutation occurred",
    );
  }
  // A successful database process alone cannot excuse failed GCM authentication.
  if (streamError)
    throw Error("Encrypted archive authentication/stream verification failed");
  const before: Record<string, Checksum> = {};
  for (const [table, expected] of Object.entries(manifest.sums)) {
    before[table] = JSON.parse(
      (await local(checksumQuery(table) + ";")).trim(),
    );
    assert.deepEqual(before[table], expected, table);
  }
  assert.equal(
    (await local("select current_setting('cron.launch_active_jobs');")).trim(),
    "off",
  );
  assert.equal(
    (await local("select current_setting('pg_net.database_name');")).trim(),
    "network_worker_disabled",
  );
  const migrations = [];
  for (const file of files) {
    const source = await readFile(
      root + "/supabase/migrations/" + file,
      "utf8",
    );
    await local("begin;\n" + source + "\ncommit;");
    migrations.push({
      file,
      sha256: createHash("sha256").update(source).digest("hex"),
    });
  }
  const after: Record<string, Checksum> = {};
  for (const table of Object.keys(before)) {
    after[table] = JSON.parse((await local(checksumQuery(table) + ";")).trim());
    assert.deepEqual(after[table], before[table], table);
  }
  for (const file of files)
    await local(
      "begin;\n" +
        (await readFile(root + "/supabase/migrations/" + file, "utf8")) +
        "\ncommit;",
    );
  for (const table of Object.keys(before))
    assert.deepEqual(
      JSON.parse((await local(checksumQuery(table) + ";")).trim()),
      before[table],
      table + " after second application",
    );
  const report = {
    at: new Date().toISOString(),
    sourceProject: manifest.project,
    backupAt: manifest.at,
    archiveBytes: manifest.bytes,
    archiveSha256: manifest.sha256,
    encryptedAtRest: "AES-256-GCM with existing operator-held key",
    restoreTarget: target,
    network: "none",
    publishedPorts: 0,
    cronActive: false,
    postgres: "17.11",
    restored: true,
    migrationsReapplied: true,
    migrations,
    protectedTables: Object.keys(before),
    protectedRecordsUnchanged: true,
    productionWrites: 0,
    storageObjectBodiesIncluded: false,
    scope:
      "Logical PostgreSQL database and role definitions/membership; no custom role passwords, hosted configuration, Storage object bodies or external service secrets restored",
  };
  await writeFile(
    evidence + "/restore-drill.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
  await run(["stop", target]);
  createdTarget = false;
}
mainRun().catch(async (error) => {
  await writeFile(dir + "/failure.private.log", String(error), { mode: 0o600 });
  if (createdTarget) {
    try {
      await run(["stop", target]);
    } catch {
      console.error(
        "Unable to stop this run's isolated restore container; operator must stop it.",
      );
    }
  }
  console.error(
    "Restore drill stopped safely. Review private diagnostic; no Production writes were attempted.",
  );
  process.exitCode = 1;
});
