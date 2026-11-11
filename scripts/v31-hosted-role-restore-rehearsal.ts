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
import postgres from "postgres";
import { readdirSync, readFileSync } from "node:fs";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
const previewRestore = process.argv.includes("--existing-free-preview");
const prelaunchReadiness = process.argv.includes("--prelaunch-readiness");
const resumeRestored = process.argv.includes("--resume-restored");
assert(
  prelaunchReadiness &&
    process.argv.includes("--restore-existing") !==
      process.argv.includes("--capture-fresh"),
  "Choose existing encrypted backup or a fresh read-only capture",
);
const finalReconciliation =
  process.argv.includes("--final-reconciliation") || prelaunchReadiness;
const keepIsolatedTarget = process.argv.includes("--keep-isolated-target");
assert(!keepIsolatedTarget || prelaunchReadiness);
const p1p4 = process.argv.includes("--p1-p4") || finalReconciliation;
const remainingAdditions = process.argv.includes("--remaining-additions");
const finalApproval = process.argv.includes("--final-approval");
assert(!finalApproval || remainingAdditions);
assert(!p1p4 || (!previewRestore && !remainingAdditions && !finalApproval));
assert.ok(
  !(previewRestore && remainingAdditions),
  "Choose one rehearsal source",
);
const previewConnection = previewRestore
  ? JSON.parse(
      readFileSync(
        "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
        "utf8",
      ),
    )
  : null;
const sourceRef = previewRestore
  ? "bckkllmndoxzpzdqrevb"
  : "pojoymtniryarxxunyvz";
function sourceDatabase() {
  if (!previewRestore) {
    const provision = JSON.parse(
      readFileSync(
        main + "/private-data/production/provision-request.json",
        "utf8",
      ),
    );
    assert.equal(provision.organizationId, "otldyeunbqabbcjydjpe");
    const u = new URL(
      readFileSync(
        main +
          "/private-data/production/provider-config/supabase/.temp/pooler-url",
        "utf8",
      ).trim(),
    );
    assert.equal(u.username, `postgres.${sourceRef}`);
    assert.match(u.hostname, /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/);
    u.password = provision.databasePassword;
    return postgres(u.href, {
      max: 1,
      ssl: {
        rejectUnauthorized: true,
        ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
      },
      onnotice: () => {},
    });
  }
  assert.equal(previewConnection.projectRef, sourceRef);
  const u = new URL(previewConnection.databaseUrl);
  assert.equal(u.username, `postgres.${sourceRef}`);
  assert.match(u.hostname, /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/);
  return postgres(u.href, {
    max: 1,
    ssl: {
      rejectUnauthorized: true,
      ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
    },
    onnotice: () => {},
  });
}
const root = process.cwd(),
  main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const runId =
  process.env.DOCKED_RESTORE_RUN ??
  (prelaunchReadiness
    ? "20261111"
    : finalReconciliation
      ? "20261110r"
      : p1p4
        ? "20261110"
        : previewRestore
          ? "20261102p"
          : "20261102");
assert.match(runId, /^2026\d{4}[a-z]?$/);
assert(!prelaunchReadiness || /^2026\d{4}[a-z]?$/.test(runId));
const dir =
  root +
  (previewRestore
    ? "/private-data/preview-restore-"
    : "/private-data/commercial-restore-") +
  runId;
const _originalEvidence =
  root +
  (prelaunchReadiness
    ? "/docs/qa/v31-prelaunch-execution-20261111/database/restore-" + runId
    : finalReconciliation
      ? "/docs/qa/v31-final-reconciliation-20261110/restore"
      : p1p4
        ? "/docs/qa/v31-p1-p4-20261110/restore"
        : finalApproval
          ? "/docs/qa/final-australia-20261102/restore"
          : remainingAdditions
            ? "/docs/qa/launch-convergence-20261102/restore"
            : previewRestore
              ? "/docs/qa/launch-resolution-20261102/restore"
              : runId === "20261102"
                ? "/docs/qa/public-activation-20261102"
                : "/docs/qa/approved-production-20261102/restore");
const evidenceRelative =
  process.env.DOCKED_V31_RESTORE_EVIDENCE ??
  "docs/qa/v31-prelaunch-execution-20261111/database/retention-role-correction/full-restore";
assert(
  evidenceRelative.startsWith("docs/qa/") && !evidenceRelative.includes(".."),
);
const evidence = root + "/" + evidenceRelative;
const attempt = process.argv.find((a) => a.startsWith("--attempt="))?.slice(10);
assert.ok(attempt === undefined || /^[2-9]$/.test(attempt));
const client = "supabase_db_deletion-auth-local",
  target =
    (previewRestore
      ? "docked-preview-restore-"
      : "docked-commercial-restore-") +
    runId +
    (attempt ? `-attempt-${attempt}` : "");
const image = "public.ecr.aws/supabase/postgres:17.11.0.002";
let createdTarget = false;
let files = [
  "20261101120754_commercial_google_ledger.sql",
  "20261102010000_commercial_lineup_inventory.sql",
  "20261102010001_public_customer_gameplay.sql",
];
const remainingHashes: Record<string, string> = {
  "20261102011703_commercial_retention_controls.sql":
    "30382db53d5ca29e869f385b640169b935808e1e57d9f3de8000735b74f9c20b",
  "20261102023100_commercial_social_inventory.sql":
    "2a019dce3789f34ce050b5ea70eb0cca5090fdbf69191f0e286c42875437d3a0",
};
if (remainingAdditions) files = Object.keys(remainingHashes);
if (p1p4)
  files = [
    "20261109231834_commercial_lifetime_supply_guards.sql",
    "20261109232000_public_practice_phone_guards.sql",
    "20261109232124_operational_incident_review.sql",
  ];
if (finalReconciliation)
  files.push(
    "20261110005726_operational_incident_retention.sql",
    "20261110010050_australian_verified_phone_uniqueness.sql",
  );
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
  catalogueFingerprint?: { fingerprint: string; objects: number };
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
let localRole = "bootstrap_admin";
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
      localRole,
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
// Keep the same per-table hashes while avoiding thousands of Docker startups.
async function localChecksums(names: string[]) {
  const sums: Record<string, Checksum> = {};
  for (let offset = 0; offset < names.length; offset += 25) {
    const queries = names
      .slice(offset, offset + 25)
      .map(
        (name) =>
          `select jsonb_build_object('table','${name.replaceAll("'", "''")}','value',q.value) from (${checksumQuery(name)})q;`,
      );
    const lines = (await local(queries.join("\n"))).trim().split("\n");
    for (const line of lines) {
      const row = JSON.parse(line);
      sums[row.table] = row.value;
    }
  }
  return sums;
}
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
  const provision = previewRestore
    ? {
        databasePassword: decodeURIComponent(
          new URL(previewConnection.databaseUrl).password,
        ),
      }
    : JSON.parse(
        await readFile(
          main + "/private-data/production/provision-request.json",
          "utf8",
        ),
      );
  const url = new URL(
    previewRestore
      ? previewConnection.databaseUrl
      : (
          await readFile(
            main +
              "/private-data/production/provider-config/supabase/.temp/pooler-url",
            "utf8",
          )
        ).trim(),
  );
  assert.equal(url.username, `postgres.${sourceRef}`);
  assert.equal(url.port, "5432");
  assert.match(url.hostname, /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/);
  if (previewRestore) {
    const sql = sourceDatabase();
    try {
      const applied =
        await sql`select version from supabase_migrations.schema_migrations`;
      files = readdirSync("supabase/migrations")
        .filter(
          (f) =>
            f.endsWith(".sql") &&
            !applied.some((a) => a.version === f.split("_")[0]),
        )
        .sort();
    } finally {
      await sql.end();
    }
  }
  const resume = process.argv.includes("--restore-existing");
  let manifest: Manifest;
  if (!resume) {
    process.chdir(main);
    const sql = sourceDatabase();
    process.chdir(root);
    try {
      manifest = await sql.begin(
        "isolation level repeatable read read only",
        async (tx) => {
          await tx`set local statement_timeout='120s'`;
          const snapshot = (await tx`select pg_export_snapshot() snapshot`)[0]
            .snapshot;
          const catalogueRow = (await tx.unsafe(v31SchemaFingerprintSql))[0];
          assert.match(String(catalogueRow.fingerprint), /^[a-f0-9]{32}$/);
          const catalogueFingerprint = {
            fingerprint: String(catalogueRow.fingerprint),
            objects: Number(catalogueRow.objects),
          };
          assert.ok(Number.isSafeInteger(catalogueFingerprint.objects));
          const roles =
            await tx`select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls from pg_roles where rolname !~ '^pg_'`;
          const members =
            await tx`select r.rolname role,m.rolname member from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member where r.rolname !~ '^pg_'`;
          const sums: Record<string, Checksum> = {};
          if (remainingAdditions || p1p4) {
            const capturedTables =
              await tx`select schemaname,tablename from pg_tables where schemaname not in ('pg_catalog','information_schema') and schemaname !~ '^pg_' order by schemaname,tablename`;
            tables.splice(
              0,
              tables.length,
              ...capturedTables.map(
                (t) => sqlQuote(t.schemaname) + "." + sqlQuote(t.tablename),
              ),
            );
          }
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
            project: sourceRef,
            bytes,
            sha256: hash.digest("hex"),
            iv: iv.toString("hex"),
            tag: cipher.getAuthTag().toString("hex"),
            roles: roles as unknown as Role[],
            members: members as unknown as Membership[],
            sums,
            catalogueFingerprint,
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
        const sql = sourceDatabase();
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
  if (!resumeRestored) {
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
        "initdb -D /restore/data -U bootstrap_admin -A trust --no-locale --encoding=UTF8 >/restore/init.log 2>&1 && exec postgres -D /restore/data -c listen_addresses='' -c unix_socket_directories=/restore -c shared_preload_libraries=pg_cron,pg_net -c cron.launch_active_jobs=off -c pg_net.database_name=network_worker_disabled",
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
        await local(
          `create role ${sqlQuote(r.rolname)} ${r.rolsuper ? "superuser" : "nosuperuser"} ${r.rolinherit ? "inherit" : "noinherit"} ${r.rolcreaterole ? "createrole" : "nocreaterole"} ${r.rolcreatedb ? "createdb" : "nocreatedb"} ${r.rolreplication ? "replication" : "noreplication"} ${r.rolbypassrls ? "bypassrls" : "nobypassrls"} nologin;`,
        );
      }
      // The old capture omitted predefined pg_* memberships and membership flags.
      // Refresh role metadata read-only; first require the captured role/member
      // pairs and attributes still to match, then preserve effective permissions.
      const roleDb = sourceDatabase();
      try {
        const metadata = await roleDb.begin("read only", async (tx) => ({
          roles:
            await tx`select rolname,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolreplication,rolbypassrls from pg_roles where rolname !~ '^pg_'`,
          members:
            await tx`select r.rolname role,m.rolname member,g.rolname grantor,a.admin_option,a.inherit_option,a.set_option from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member join pg_roles g on g.oid=a.grantor`,
        }));
        const sorted = (rows: unknown[]) =>
          rows.map((r) => JSON.stringify(r)).sort();
        assert.deepEqual(
          sorted(metadata.roles),
          sorted(manifest.roles),
          "Role attributes drifted from backup",
        );
        assert.deepEqual(
          sorted(
            metadata.members
              .filter((m) => !m.role.startsWith("pg_"))
              .map(({ role, member }) => ({ role, member })),
          ),
          sorted(manifest.members),
          "Membership pairs drifted from backup",
        );
        for (const m of metadata.members)
          await local(
            `grant ${sqlQuote(m.role)} to ${sqlQuote(m.member)} with admin ${m.admin_option}, inherit ${m.inherit_option}, set ${m.set_option};`,
          );
        const actual = JSON.parse(
          (
            await local(
              "select jsonb_agg(jsonb_build_object('role',r.rolname,'member',m.rolname,'admin_option',a.admin_option,'inherit_option',a.inherit_option,'set_option',a.set_option)) from pg_auth_members a join pg_roles r on r.oid=a.roleid join pg_roles m on m.oid=a.member;",
            )
          ).trim(),
        );
        const normalize = (rows: any[]) =>
          rows.map(
            ({ role, member, admin_option, inherit_option, set_option }) => ({
              role,
              member,
              admin_option,
              inherit_option,
              set_option,
            }),
          );
        assert.deepEqual(
          sorted(normalize(actual)),
          sorted(normalize(metadata.members)),
          "Effective membership options must match hosted",
        );
        await writeFile(
          evidence + "/role-fidelity.json",
          JSON.stringify(
            {
              at: new Date().toISOString(),
              rolesMatchBackup: true,
              membershipPairsMatchBackup: true,
              predefinedMembershipsIncluded: true,
              effectiveMembershipOptionsMatch: true,
              membershipCount: metadata.members.length,
              grantorProvenance:
                "bootstrap_admin grants emulate effective permissions; original grantor names are not reproduced",
              postgresSuperuser: false,
              productionWrites: 0,
            },
            null,
            2,
          ),
        );
      } finally {
        await roleDb.end({ timeout: 5 });
      }
    }
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
      await pipeline(
        createReadStream(dir + "/production.dump.aes"),
        d,
        p.stdin,
      );
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
      throw Error(
        "Encrypted archive authentication/stream verification failed",
      );
  } else {
    const inspection = JSON.parse(await run(["inspect", target]))[0];
    assert.equal(inspection.HostConfig.NetworkMode, "none");
    assert.equal(
      Object.keys(inspection.HostConfig.PortBindings ?? {}).length,
      0,
    );
    assert.equal(inspection.State.Running, true);
    localRole = "postgres";
  }
  // pg_net extension transport caches/queues are unlogged and excluded from
  // pg_dump. Never replay their outbound requests in a restored environment.
  // These are not durable application notification/outbox or financial tables.
  const excludedTransportTables = [
    '"net"."_http_response"',
    '"net"."http_request_queue"',
  ];
  const protectedNames = Object.keys(manifest.sums).filter(
    (table) =>
      !(
        (remainingAdditions || p1p4) &&
        excludedTransportTables.includes(table)
      ),
  );
  if (!resumeRestored)
    await local(
      "alter database postgres owner to postgres; alter role postgres login;",
    );
  localRole = "postgres";
  assert.equal(
    (
      await local("select rolsuper from pg_roles where rolname=current_user;")
    ).trim(),
    "f",
  );
  const before = resumeRestored
    ? Object.fromEntries(protectedNames.map((n) => [n, manifest.sums[n]]))
    : await localChecksums(protectedNames);
  for (const table of protectedNames)
    assert.deepEqual(before[table], manifest.sums[table], table);
  assert.equal(
    (await local("select current_setting('cron.launch_active_jobs');")).trim(),
    "off",
  );
  assert.equal(
    (await local("select current_setting('pg_net.database_name');")).trim(),
    "network_worker_disabled",
  );
  const previewRounds = previewRestore
    ? (JSON.parse(
        (
          await local(
            "select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from beta_fantasy.competitions c;",
          )
        ).trim(),
      ) as {
        id: string;
        sport: string;
        locks_at: string;
        scored_at: string | null;
        rules: Record<string, unknown>;
      }[])
    : [];
  const approvedRoundChanges: {
    id: string;
    sport: string;
    previous: string;
    version: string;
  }[] = [];
  const migrations = [];
  const migrationSources = new Map<string, string>();
  if (remainingAdditions) {
    assert.equal(
      (
        await local(
          "select count(*) from supabase_migrations.schema_migrations where version in ('20261102011703','20261102023100');",
        )
      ).trim(),
      "0",
      "Do not rehearse already-applied additions",
    );
    assert.equal(
      (
        await local(
          "select count(*) from supabase_migrations.schema_migrations where version in ('20261101120754','20261102010000','20261102010001');",
        )
      ).trim(),
      "3",
      "Approved dependencies must already be present",
    );
  }
  if (finalReconciliation)
    await writeFile(
      evidence + "/preflight.txt",
      await local(
        await readFile(
          root + "/docs/qa/v31-final-reconciliation-20261110/preflight.sql",
          "utf8",
        ),
      ),
    );
  for (const file of files) {
    const source = await readFile(
      "C:/Users/61412/.codex/worktrees/v31-founder-acceptance-20261111/Docked.com.au" +
        "/supabase/migrations/" +
        file,
      "utf8",
    );
    migrationSources.set(file, source);
    if (remainingAdditions)
      assert.equal(
        createHash("sha256").update(source).digest("hex"),
        remainingHashes[file],
        "Approval-package hash mismatch",
      );
    await local("begin;\n" + source + "\ncommit;");
    migrations.push({
      file,
      sha256: createHash("sha256").update(source).digest("hex"),
    });
  }
  if (previewRestore) {
    const current = JSON.parse(
      (
        await local(
          "select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from beta_fantasy.competitions c;",
        )
      ).trim(),
    );
    assert.equal(current.length, previewRounds.length);
    for (let i = 0; i < current.length; i++) {
      const prior = previewRounds[i],
        next = current[i];
      if (JSON.stringify(prior) === JSON.stringify(next)) continue;
      assert.equal(prior.id, next.id);
      assert.ok(["afl", "nrl"].includes(prior.sport));
      assert.ok(new Date(prior.locks_at).getTime() > Date.now());
      assert.equal(prior.scored_at, null);
      assert.equal(prior.rules.mode, "SALARY_CAP");
      assert.equal(
        prior.rules.lineup_version,
        prior.sport === "afl" ? "docked-afl-22-v1-qa" : "docked-nrl-13-v1-qa",
      );
      const approved = "docked-australian-owner-2026-10-24-v1-" + prior.sport;
      assert.equal(next.rules.lineup_version, approved);
      assert.equal(
        (
          await local(
            "select (select count(*) from beta_fantasy.entries where competition_id='" +
              prior.id +
              "')+(select count(*) from beta_fantasy.round_drafts where competition_id='" +
              prior.id +
              "')+(select count(*) from beta_fantasy.slot_locks where competition_id='" +
              prior.id +
              "');",
          )
        ).trim(),
        "0",
      );
      assert.deepEqual(next, {
        ...prior,
        rules: { ...prior.rules, lineup_version: approved },
      });
      approvedRoundChanges.push({
        id: prior.id,
        sport: prior.sport,
        previous: prior.rules.lineup_version,
        version: approved,
      });
    }
    before["beta_fantasy.competitions"] = JSON.parse(
      (await local(checksumQuery("beta_fantasy.competitions") + ";")).trim(),
    );
  }
  for (const file of previewRestore
    ? files.filter((f) => f.startsWith("20261102"))
    : files)
    await local("begin;\n" + migrationSources.get(file) + "\ncommit;");
  const reapplied = await localChecksums(Object.keys(before));
  for (const table of Object.keys(before))
    assert.deepEqual(
      reapplied[table],
      before[table],
      table + " after second application",
    );
  for (const [file, source] of migrationSources)
    assert.equal(
      await readFile(
        "C:/Users/61412/.codex/worktrees/v31-founder-acceptance-20261111/Docked.com.au" +
          "/supabase/migrations/" +
          file,
        "utf8",
      ),
      source,
      "Migration changed during rehearsal: " + file,
    );
  if (remainingAdditions) {
    assert.equal(
      (
        await local("select enabled from billing_retention.policy where id;")
      ).trim(),
      "f",
    );
    assert.equal(
      (
        await local(
          "select count(*) from pg_tables t join pg_class c on c.oid=(quote_ident(t.schemaname)||'.'||quote_ident(t.tablename))::regclass where t.schemaname='billing_retention' and not c.relrowsecurity;",
        )
      ).trim(),
      "0",
    );
    assert.equal(
      (
        await local(
          "select has_function_privilege('authenticated','commercial_billing.social_inventory(uuid)','execute') or has_function_privilege('anon','commercial_billing.social_inventory(uuid)','execute');",
        )
      ).trim(),
      "f",
    );
    assert.equal(
      (
        await local(
          "select has_function_privilege('docked_app','commercial_billing.social_inventory(uuid)','execute');",
        )
      ).trim(),
      "t",
    );
    assert.equal(
      (
        await local(
          "select rolcanlogin or rolsuper or rolbypassrls from pg_roles where rolname='docked_retention_worker';",
        )
      ).trim(),
      "f",
    );
  }
  if (finalReconciliation)
    await writeFile(
      evidence + "/postflight.txt",
      await local(
        await readFile(
          "C:/Users/61412/.codex/worktrees/v31-founder-acceptance-20261111/Docked.com.au/docs/qa/v31-final-reconciliation-20261110/postflight.sql",
          "utf8",
        ),
      ),
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
    operatorSuperuser: false,
    effectiveMembershipOptionsMatch: true,
    restored: true,
    resumedRetainedRestore: resumeRestored,
    protectedComparison: `All ${protectedNames.length} durable table hashes/counts equal authenticated backup after both migration passes`,
    migrationsReapplied: true,
    reapplicationScope: previewRestore
      ? "Only 20261102 idempotent additions; older one-shot migrations applied once in snapshot"
      : "all listed",
    migrations,
    protectedTables: Object.keys(before),
    protectedRecordsUnchanged: true,
    remainingAdditionsVerified: remainingAdditions,
    excludedTransportTables:
      remainingAdditions || p1p4 ? excludedTransportTables : [],
    approvedRoundChanges,
    productionWrites: 0,
    storageObjectBodiesIncluded: false,
    scope:
      "Logical database restored with original object ownership; postgres has captured non-superuser attributes and is used for migrations. All effective membership options, including pg_* memberships, match a fresh read-only capture with backup drift checks. Bootstrap grantor names differ. No external services or keys restored.",
    targetRetainedForLocalAcceptance: keepIsolatedTarget,
  };
  await writeFile(
    evidence + "/restore-drill.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify({
      ...report,
      protectedTables: report.protectedTables.length,
    }),
  );
  if (!keepIsolatedTarget) await run(["stop", target]);
  createdTarget = false;
}
mainRun().catch(async (error) => {
  await writeFile(dir + "/failure.private.log", String(error), { mode: 0o600 });
  if (createdTarget && !keepIsolatedTarget) {
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
