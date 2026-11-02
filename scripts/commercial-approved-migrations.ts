/** Exact owner-approved dormant Production DDL, 2 November 2026.
 * Full transaction, snapshot drift checks, encrypted rollback evidence, no activation. */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import {
  createHash,
  createDecipheriv,
  createCipheriv,
  randomBytes,
} from "node:crypto";
import { spawn } from "node:child_process";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  readRoundCopy,
  assertOnlyRoundTelemetryChanged,
  roundTelemetry,
} from "./lib/round-backup-compare";
import {
  readArchivedRows,
  textRowsQuery,
  type BackupRow,
} from "./lib/backup-row-review";
import { assertOperationalDrift } from "./lib/operational-drift";
const root = process.cwd(),
  main = "C:/Users/61412/Documents/ChatGPT/Docked.com.au";
const mode = process.argv[2];
const remaining = process.argv.includes("--remaining-additions");
assert(["inspect", "apply"].includes(mode));
if (mode === "apply")
  assert(process.argv.includes("--owner-approved-20261102"));
const out =
  root +
  (remaining
    ? "/docs/qa/final-australia-20261102/migrations"
    : "/docs/qa/approved-production-20261102");
const fresh = process.argv.includes("--fresh-backup");
const vault =
  root +
  "/private-data/commercial-restore-" +
  (remaining ? "20261102d" : fresh ? "20261102b" : "20261102");
const h = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");
const q = (x: string) => "'" + x.replaceAll("'", "'\\''") + "'";
const tableHash = (table: string) =>
  `select count(*)::text count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`;
const normalize = (s: string) =>
  s
    .replaceAll("\r\n", "\n")
    .split("\n")
    .filter(
      (l) => !/^\\(un)?restrict /.test(l) && !/^-- Dumped (by|from) /.test(l),
    )
    .join("\n")
    .trim();
async function command(args: string[], input: string | Buffer) {
  const p = spawn("docker", args, {
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stdout = "",
    stderr = "";
  p.stdout!.on("data", (b) => (stdout += b));
  p.stderr!.on("data", (b) => (stderr += b));
  const done = new Promise<number | null>((r, j) => {
    p.on("close", r);
    p.on("error", j);
  });
  // pg_restore --schema-only intentionally stops reading archive data early.
  p.stdin!.on("error", () => {});
  p.stdin!.end(input);
  if ((await done) !== 0) {
    await writeFile(vault + "/approval-diagnostic.private.log", stderr, {
      mode: 0o600,
    });
    throw Error("Database client failed; private diagnostic retained");
  }
  return stdout;
}
async function mainRun() {
  await mkdir(out, { recursive: true });
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
  const raw = await readFile(vault + "/manifest.aes"),
    md = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  md.setAuthTag(raw.subarray(12, 28));
  const manifest = JSON.parse(
    Buffer.concat([md.update(raw.subarray(28)), md.final()]).toString(),
  );
  const evidenceDir = remaining
    ? root + "/docs/qa/final-australia-20261102/restore"
    : fresh
      ? out + "/restore"
      : root + "/docs/qa/public-activation-20261102";
  const restored = JSON.parse(
    await readFile(evidenceDir + "/restore-drill.json", "utf8"),
  );
  const integrity = JSON.parse(
    await readFile(evidenceDir + "/archive-integrity.json", "utf8"),
  );
  assert(
    restored.restored &&
      restored.migrationsReapplied &&
      restored.protectedRecordsUnchanged &&
      integrity.authenticated &&
      integrity.sha256Matches,
  );
  assert.equal(manifest.project, "pojoymtniryarxxunyvz");
  assert.equal(restored.archiveSha256, manifest.sha256);
  const originalHashes: Record<string, string> = {
    "20261101120754_commercial_google_ledger.sql":
      "a9d77454705a9c827155f1a07acda040ce48e5fb6911bf793edc3e0efed7a28c",
    "20261102010000_commercial_lineup_inventory.sql":
      "c39d5da280d2d76226740d904e93732b2ca6ecffee505bf1803924b0e54e995b",
    "20261102010001_public_customer_gameplay.sql":
      "121e97e5e41d160aee4f7bcdcd92fcaee2aae87c547c17a7af7b71ded978b4f2",
  };
  const approvedHashes: Record<string, string> = remaining
    ? {
        "20261102011703_commercial_retention_controls.sql":
          "30382db53d5ca29e869f385b640169b935808e1e57d9f3de8000735b74f9c20b",
        "20261102023100_commercial_social_inventory.sql":
          "2a019dce3789f34ce050b5ea70eb0cca5090fdbf69191f0e286c42875437d3a0",
      }
    : originalHashes;
  const migrations: {
    file: string;
    sha256: string;
    source: string;
    version: string;
  }[] = [];
  for (const m of restored.migrations) {
    const source = await readFile(
      root + "/supabase/migrations/" + m.file,
      "utf8",
    );
    assert.equal(
      m.sha256,
      approvedHashes[m.file],
      "Restore package differs from owner-approved checksums",
    );
    assert.equal(h(source), m.sha256, "Approved migration bytes changed");
    migrations.push({ ...m, source, version: m.file.slice(0, 14) });
  }
  assert.deepEqual(
    migrations.map((m) => m.version),
    Object.keys(approvedHashes).map((f) => f.slice(0, 14)),
  );
  const d = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(manifest.iv, "hex"),
  );
  d.setAuthTag(Buffer.from(manifest.tag, "hex"));
  const archive = Buffer.concat([
    d.update(await readFile(vault + "/production.dump.aes")),
    d.final(),
  ]);
  assert.equal(h(archive), manifest.sha256);
  const oldSchema = normalize(
    await command(
      [
        "exec",
        "-i",
        "supabase_db_deletion-auth-local",
        "sh",
        "-c",
        "pg_restore --schema-only --no-owner --file=-; restore_result=$?; cat >/dev/null; exit $restore_result",
      ],
      archive,
    ),
  );
  assert(
    /\n-- PostgreSQL database dump complete\n--\s*$/.test(oldSchema),
    "Archived schema extraction incomplete; no writes permitted",
  );
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
  process.chdir(main);
  const sql = ownerDatabase();
  process.chdir(root);
  try {
    const result = await sql.begin(
      mode === "inspect"
        ? "isolation level repeatable read read only"
        : "isolation level serializable",
      async (tx) => {
        await tx`set local lock_timeout='5s'`;
        await tx`set local statement_timeout='180s'`;
        if (mode === "apply") await tx`select pg_advisory_xact_lock(71820342)`;
        const prior =
          await tx`select version,statements from supabase_migrations.schema_migrations where version=any(${migrations.map((m) => m.version)}::text[]) order by version`;
        assert.equal(
          prior.length,
          0,
          "Already/partially applied: inspect existing migration history before proceeding",
        );
        if (remaining)
          for (const [file, sha] of Object.entries(originalHashes)) {
            const [applied] =
              await tx`select statements from supabase_migrations.schema_migrations where version=${file.slice(0, 14)}`;
            assert(applied, "Missing applied dependency " + file);
            assert.equal(
              h(applied.statements.join("\n")),
              sha,
              "Applied dependency differs " + file,
            );
          }
        const snapshot = (await tx`select pg_export_snapshot() snapshot`)[0]
          .snapshot;
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
        const newSchema = normalize(
          await command(
            ["exec", "-i", "supabase_db_deletion-auth-local", "sh", "-s"],
            Object.entries(env)
              .map(([k, v]) => `export ${k}=${q(v)}`)
              .join("\n") +
              `\nexec pg_dump --schema-only --no-owner --snapshot=${q(snapshot)} --lock-wait-timeout=5000\n`,
          ),
        );
        assert(
          /\n-- PostgreSQL database dump complete\n--\s*$/.test(newSchema),
          "Current schema extraction incomplete; no writes permitted",
        );
        if (h(newSchema) !== h(oldSchema)) {
          // Metadata can contain privileged definitions: encrypt the diagnostic too.
          const iv = randomBytes(12),
            c = createCipheriv("aes-256-gcm", key, iv);
          const b = Buffer.concat([
            c.update(JSON.stringify({ oldSchema, newSchema })),
            c.final(),
          ]);
          await writeFile(
            vault + "/schema-drift.aes",
            Buffer.concat([iv, c.getAuthTag(), b]),
            { mode: 0o600 },
          );
          throw Error(
            "Production schema drift: encrypted comparison requires review",
          );
        }
        const tables = (
          await tx`select format('%I.%I',n.nspname,c.relname) name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and (n.nspname in ('public','private','beta_fantasy','credits_sandbox','fantasy','scoring_beta','nfl_history','nfl_roster','commercial_billing','public_gameplay') or (n.nspname='auth' and c.relname='users') or (n.nspname='cron' and c.relname='job') or (n.nspname='sports_feed' and c.relname not in ('raw_revisions','jobs','job_events','budget'))) order by 1`
        ).map((t) => t.name as string);
        const before: Record<string, unknown> = {};
        for (const table of tables)
          before[table] = (await tx.unsafe(tableHash(table)))[0];
        const changedSinceRestore: string[] = [];
        for (const [table, previous] of Object.entries(manifest.sums) as [
          string,
          { count: number; hash: string },
        ][]) {
          const now = (await tx.unsafe(tableHash(table)))[0];
          if (
            String(previous.count) !== now.count ||
            previous.hash !== now.hash
          )
            changedSinceRestore.push(table);
        }
        const expectedOperationalDrift: {
          table: string;
          fields: string[];
          immutableRows: number;
          comparison: string;
        }[] = [];
        const nflRoundsTable = changedSinceRestore.find(
          (t) =>
            t === "sports_feed.nfl_rounds" ||
            t === '"sports_feed"."nfl_rounds"',
        );
        if (nflRoundsTable) {
          const data = await command(
            [
              "exec",
              "-i",
              "supabase_db_deletion-auth-local",
              "pg_restore",
              "--data-only",
              "--table=nfl_rounds",
              "--file=-",
            ],
            archive,
          );
          const rows = (
            await tx`select to_jsonb(t) value from sports_feed.nfl_rounds t`
          ).map((r) => r.value);
          try {
            const unchanged = assertOnlyRoundTelemetryChanged(
              readRoundCopy(data),
              rows,
            );
            expectedOperationalDrift.push({
              table: nflRoundsTable,
              fields: roundTelemetry,
              immutableRows: unchanged.length,
              comparison:
                "exact parsed rows; fixtures, lock snapshots, issues and round identities unchanged",
            });
          } catch {
            throw Error(
              "NFL round non-telemetry data changed; migration stopped before writes",
            );
          }
        }
        // The restored rehearsal explicitly excludes pg_net's unlogged
        // transport buffers. They are not durable notification/retry queues.
        // Verify the exact exclusion and relation persistence, never exempt
        // arbitrary tables or any financial/application outbox here.
        for (const table of [
          '"net"."_http_response"',
          '"net"."http_request_queue"',
        ]) {
          if (!remaining || !changedSinceRestore.includes(table)) continue;
          assert(restored.excludedTransportTables.includes(table));
          const [relation] =
            await tx`select relpersistence from pg_class where oid=to_regclass(${table})`;
          assert.equal(relation.relpersistence, "u");
          expectedOperationalDrift.push({
            table,
            fields: ["ephemeral HTTP transport buffer"],
            immutableRows: 0,
            comparison:
              "unlogged pg_net transport; excluded from the rehearsed logical archive, never replayed",
          });
        }
        const reviewedOperational = [
          '"auth"."refresh_tokens"',
          '"auth"."sessions"',
          '"auth"."users"',
          '"cron"."job_run_details"',
          '"private"."docked_mail_scheduler"',
          '"sports_feed"."nfl_worker_runs"',
          '"sports_feed"."weekly_core_job_runs"',
        ].filter((t) => changedSinceRestore.includes(t));
        if (remaining && reviewedOperational.length) {
          await tx`set local time zone 'UTC'`;
          const data = await command(
            [
              "exec",
              "-i",
              "supabase_db_deletion-auth-local",
              "pg_restore",
              "--data-only",
              ...reviewedOperational.map(
                (t) => "--table=" + t.split(".")[1].replaceAll('"', ""),
              ),
              "--file=-",
            ],
            archive,
          );
          const context = {
            sessions:
              (await tx`select id::text,user_id::text from auth.sessions`) as BackupRow[],
            jobs: (await tx`select jobid::text,command,database,username from cron.job`) as BackupRow[],
            rotatedSessions: [] as string[],
          };
          for (const table of reviewedOperational) {
            const previous = readArchivedRows(data, table);
            const columns =
              await tx`select attname name,format_type(atttypid,atttypmod) type from pg_attribute where attrelid=to_regclass(${table}) and attnum>0 and not attisdropped and attgenerated='' order by attnum`;
            const rows = (
              await tx.unsafe(
                textRowsQuery(
                  table,
                  columns.map((c) => ({
                    name: String(c.name),
                    type: String(c.type),
                  })),
                ),
              )
            ).map((r) => r.value) as BackupRow[];
            const review = assertOperationalDrift(
              table,
              previous,
              rows,
              context,
            );
            expectedOperationalDrift.push(review);
            if (table === '"auth"."refresh_tokens"') {
              const ids = new Set(previous.map((r) => r.id));
              context.rotatedSessions = rows
                .filter((r) => !ids.has(r.id))
                .map((r) => r.session_id!)
                .filter(Boolean);
            }
          }
        }
        const unexpectedDrift = changedSinceRestore.filter(
          (t) => !expectedOperationalDrift.some((d) => d.table === t),
        );
        await writeFile(
          out + "/drift.json",
          JSON.stringify(
            {
              at: new Date().toISOString(),
              schemaMatchesRestore: true,
              schemaHash: h(newSchema),
              changedSinceRestore,
              expectedOperationalDrift,
              unexpectedDrift,
              backupAt: manifest.at,
              mode,
            },
            null,
            2,
          ),
        );
        assert.equal(
          unexpectedDrift.length,
          0,
          "Protected records changed since backup: refresh/retest backup before applying " +
            unexpectedDrift.join(","),
        );
        const dependencies = [
          ...(remaining
            ? [
                "private.community_actor(uuid,text,boolean)",
                "private.social_collection_cards(uuid,jsonb)",
              ]
            : []),
          "sports_feed.free_core_inventory(uuid,uuid)",
          "sports_feed.lineup_inventory(uuid,uuid)",
          "sports_feed.sport_sandbox_state(text)",
          "beta_fantasy.production_read_state()",
          "private.active_member_session()",
          "beta_private.active_member_session()",
        ];
        for (const d of dependencies)
          assert(
            (await tx`select to_regprocedure(${d}) present`)[0].present,
            "Missing dependency " + d,
          );
        const functions =
          await tx`select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,pg_get_functiondef(p.oid) definition,p.proacl::text grants from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('sports_feed','beta_fantasy','beta_private','private') and p.prokind='f' order by 1,2,3`;
        const beforeRls =
          await tx`select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','private','beta_fantasy','credits_sandbox','sports_feed') order by 1,2`;
        const rollback = JSON.stringify({
          at: new Date().toISOString(),
          project: manifest.project,
          schemaHash: h(newSchema),
          before,
          functions,
          beforeRls,
        });
        const iv = randomBytes(12),
          cipher = createCipheriv("aes-256-gcm", key, iv),
          encrypted = Buffer.concat([cipher.update(rollback), cipher.final()]);
        await writeFile(
          vault + `/pre-${mode}-${Date.now()}.aes`,
          Buffer.concat([iv, cipher.getAuthTag(), encrypted]),
          { flag: "wx", mode: 0o600 },
        );
        if (mode === "apply") {
          for (const m of migrations) {
            await tx.unsafe(m.source);
            await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${m.version},${m.file.slice(15, -4)},${[m.source]})`;
          }
          for (const table of tables)
            assert.deepEqual(
              (await tx.unsafe(tableHash(table)))[0],
              before[table],
              "Protected data changed: " + table,
            );
          const afterRls =
            await tx`select n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in ('public','private','beta_fantasy','credits_sandbox','sports_feed') order by 1,2`;
          assert.deepEqual(
            afterRls,
            beforeRls,
            "Existing table RLS/grants changed",
          );
          assert.equal(
            (
              await tx`select count(*)::int n from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled`
            )[0].n,
            0,
          );
          assert.equal(
            (
              await tx`select count(*)::int n from public_gameplay.policy where enabled`
            )[0].n,
            0,
          );
          assert.equal(
            (
              await tx`select count(*)::int n from public_gameplay.sports where visible or play_enabled`
            )[0].n,
            0,
          );
          assert.equal(
            (await tx`select count(*)::int n from public_gameplay.rounds`)[0].n,
            0,
          );
          assert.equal(
            (
              await tx`select count(*)::int n from commercial_billing.products where approved`
            )[0].n,
            0,
          );
          for (const table of [
            "accounts",
            "receipts",
            "lots",
            "journals",
            "cards",
            "packs",
            "definitions",
            "jobs",
          ])
            assert.equal(
              (
                await tx.unsafe(
                  `select count(*)::int n from commercial_billing.${table}`,
                )
              )[0].n,
              0,
            );
          assert.equal(
            (
              await tx`select enabled from private.feature_flags where key='registration'`
            )[0].enabled,
            false,
          );
          const role = (
            await tx`select rolcanlogin,rolsuper,rolbypassrls from pg_roles where rolname='docked_commercial_app'`
          )[0];
          assert.deepEqual(role, {
            rolcanlogin: false,
            rolsuper: false,
            rolbypassrls: false,
          });
          assert.equal(
            (
              await tx`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('commercial_billing','public_gameplay') and c.relkind='r' and not c.relrowsecurity`
            )[0].n,
            0,
          );
          for (const role of ["anon", "authenticated", "service_role"])
            for (const schema of ["commercial_billing", "public_gameplay"])
              assert.equal(
                (
                  await tx`select has_schema_privilege(${role},${schema},'USAGE') allowed`
                )[0].allowed,
                false,
              );
          if (remaining) {
            assert.equal(
              (
                await tx`select enabled from billing_retention.policy where id`
              )[0].enabled,
              false,
            );
            const [retentionRole] =
              await tx`select rolcanlogin,rolsuper,rolbypassrls from pg_roles where rolname='docked_retention_worker'`;
            assert.deepEqual(retentionRole, {
              rolcanlogin: false,
              rolsuper: false,
              rolbypassrls: false,
            });
            assert.equal(
              (
                await tx`select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='billing_retention' and c.relkind='r' and c.relrowsecurity`
              )[0].n,
              5,
            );
            for (const role of [
              "anon",
              "authenticated",
              "service_role",
              "docked_beta_app",
              "docked_commercial_app",
            ]) {
              assert.equal(
                (
                  await tx`select has_function_privilege(${role},'commercial_billing.social_inventory(uuid)','execute') allowed`
                )[0].allowed,
                false,
              );
              assert.equal(
                (
                  await tx`select has_schema_privilege(${role},'billing_retention','USAGE') allowed`
                )[0].allowed,
                false,
              );
            }
            assert.equal(
              (
                await tx`select has_function_privilege('docked_app','commercial_billing.social_inventory(uuid)','execute') allowed`
              )[0].allowed,
              true,
            );
          }
        }
        return {
          at: new Date().toISOString(),
          mode,
          project: manifest.project,
          sourceCommit: remaining
            ? "211cf3a1 with exact unchanged approved migration files"
            : "78012503",
          ownerApproval: remaining
            ? "Approve both dormant migrations, 2026-11-02; call_2666be6940e44646962c257d86f7d261"
            : "APPROVED PRODUCTION MIGRATIONS AND FINAL RELEASE COMPLETION, 2026-11-02",
          schemaMatchesRestore: true,
          schemaHash: h(newSchema),
          protectedRecordsMatchBackup: changedSinceRestore.length === 0,
          protectedBusinessRecordsMatchBackup: true,
          expectedOperationalDrift,
          protectedTables: tables,
          protectedTableCount: tables.length,
          protectedRecordFingerprint: h(JSON.stringify(before)),
          protectedRecordsUnchanged: true,
          existingRlsAndTableGrantsUnchanged: true,
          migrations: migrations.map(({ file, sha256 }) => ({
            file,
            sha256,
            applied: mode === "apply",
          })),
          allActivationGatesOff: true,
        };
      },
    );
    await writeFile(
      out + "/" + mode + ".json",
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify(result));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
mainRun().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
