/** Local restored Production copy ONLY. No hosted connection or credentials. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  tableListQuery,
  checksumQuery,
  custodyQuery,
} from "./lib/reviewed-inventory";
const sourceContainer = "docked-commercial-restore-20261113c";
const container = "docked-season-catalogue-20261115";
const database = "postgres";
const directory = "docs/qa/season-catalogue-20261115/";
const migrations = [
  "20261115011415_approved_season_catalogue.sql",
  "20261115011418_season_catalogue_pack_eligibility.sql",
];
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
async function run(args: string[], input?: string) {
  return new Promise<string>((resolve, reject) => {
    const p = spawn("docker", args, {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "",
      err = "";
    p.stdout.on("data", (b) => (out += b));
    p.stderr.on("data", (b) => (err += b));
    p.stdin.on("error", () => {});
    p.on("error", reject);
    p.on("close", (c) =>
      c === 0
        ? resolve(out)
        : reject(
            Error(
              err
                .split("\n")
                .filter((s) => /ERROR|FATAL|error:/.test(s))
                .join("\n") || "Isolated Docker command failed",
            ),
          ),
    );
    p.stdin.end(input);
  });
}
const docker = (args: string[], input?: string) =>
  run(["exec", "-i", container, ...args], input);
async function sql(query: string, target = database) {
  const out = await docker(
    [
      "psql",
      "-X",
      "-q",
      "-h",
      "/restore",
      "-U",
      "postgres",
      "-d",
      target,
      "-v",
      "ON_ERROR_STOP=1",
      "-At",
    ],
    query,
  );
  return out
    .split("\n")
    .filter((s) => s.startsWith("{") || s.startsWith("["))
    .map((s) => JSON.parse(s));
}
async function capture() {
  const [tables] = await sql(tableListQuery);
  const rows = await sql(
    `begin isolation level repeatable read read only;${tables
      .filter((s: string) => !s.startsWith("season_catalogue."))
      .map(checksumQuery)
      .join(";\n")};${custodyQuery};commit;`,
  );
  return {
    tables: rows.slice(0, -1),
    custody: hash(JSON.stringify(rows.at(-1))),
  };
}
async function main() {
  // New network-disabled container, no scheduler execution and no TCP listener.
  // Copy the previously authenticated restored snapshot; no Production contact.
  if (!process.argv.includes("--reuse-isolated")) {
    const sourceConfig = JSON.parse(await run(["inspect", sourceContainer]))[0];
    assert.equal(sourceConfig.HostConfig.NetworkMode, "none");
    await run([
      "create",
      "--name",
      container,
      "--network",
      "none",
      "--user",
      "postgres",
      "--tmpfs",
      "/restore:rw,nosuid,nodev,mode=1777",
      "--entrypoint",
      "sh",
      "public.ecr.aws/supabase/postgres:17.11.0.002",
      "-c",
      "initdb -D /restore/data -U bootstrap_admin -A trust --no-locale --encoding=UTF8 >/restore/init.log 2>&1 && exec postgres -D /restore/data -c listen_addresses='' -c unix_socket_directories=/restore -c shared_preload_libraries=pg_cron,pg_net -c cron.launch_active_jobs=off -c pg_net.database_name=network_worker_disabled",
    ]);
    await run(["start", container]);
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        await docker([
          "psql",
          "-X",
          "-h",
          "/restore",
          "-U",
          "bootstrap_admin",
          "-d",
          "postgres",
          "-At",
          "-c",
          "select 1",
        ]);
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    assert(ready, "Isolated container must be ready");
    const roles = await run([
      "exec",
      sourceContainer,
      "pg_dumpall",
      "-h",
      "/restore",
      "-U",
      "bootstrap_admin",
      "--roles-only",
      "--no-role-passwords",
    ]);
    await docker(
      [
        "psql",
        "-X",
        "-q",
        "-h",
        "/restore",
        "-U",
        "bootstrap_admin",
        "-d",
        "postgres",
        "-v",
        "ON_ERROR_STOP=1",
      ],
      roles.replace(/^CREATE ROLE bootstrap_admin;$/m, ""),
    );
    // Stream plaintext only between two offline processes, never to disk/logs.
    await new Promise<void>((resolve, reject) => {
      const dump = spawn(
        "docker",
        [
          "exec",
          sourceContainer,
          "pg_dump",
          "-h",
          "/restore",
          "-U",
          "bootstrap_admin",
          "-d",
          "postgres",
          "-Fc",
        ],
        { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
      );
      const restore = spawn(
        "docker",
        [
          "exec",
          "-i",
          container,
          "pg_restore",
          "-h",
          "/restore",
          "-U",
          "bootstrap_admin",
          "-d",
          "postgres",
          "--exit-on-error",
        ],
        { windowsHide: true, stdio: ["pipe", "ignore", "pipe"] },
      );
      let errors = "",
        dumpCode: number | null = null;
      dump.stderr.on("data", (b) => (errors += b));
      restore.stderr.on("data", (b) => (errors += b));
      dump.on("error", reject);
      restore.on("error", reject);
      restore.stdin.on("error", () => {});
      dump.on("close", (c) => {
        dumpCode = c;
      });
      dump.stdout.pipe(restore.stdin);
      restore.on("close", (c) =>
        c === 0 && dumpCode === 0
          ? resolve()
          : reject(
              Error(
                errors
                  .split("\n")
                  .filter((s) => /ERROR|FATAL|error:/.test(s))
                  .join("\n") || "Isolated stream failed",
              ),
            ),
      );
    });
    await docker([
      "psql",
      "-X",
      "-h",
      "/restore",
      "-U",
      "bootstrap_admin",
      "-d",
      "postgres",
      "-c",
      "alter database postgres owner to postgres;",
    ]);
  }
  const before = await capture();
  assert.equal(
    before.tables.find((t: any) => t.table === "commercial_billing.definitions")
      .count,
    6540,
  );
  const body =
    migrations
      .map((f) => readFileSync("supabase/migrations/" + f, "utf8"))
      .join("\n") +
    "\n" +
    readFileSync(directory + "adopt-catalogue.sql", "utf8");
  // First full rehearsal rolls back, proving clean transactional failure/recovery.
  await sql(
    "begin;set local lock_timeout='3s';set local statement_timeout='60s';" +
      body +
      "\nset constraints all immediate;rollback;",
  );
  assert.deepEqual(await capture(), before);
  await sql(
    "begin;set local lock_timeout='3s';set local statement_timeout='60s';" +
      body +
      "\nset constraints all immediate;commit;",
  );
  assert.deepEqual(
    await capture(),
    before,
    "Every pre-existing row must remain byte-identical",
  );
  const [pool] = await sql(
    `select jsonb_agg(r) from (select sport,count(*)::int members,count(*) filter(where season_catalogue.can_issue(sport,season,player_id,scope))::int eligible from season_catalogue.members group by sport order by sport)r;`,
  );
  assert.deepEqual(pool, [
    { sport: "afl", members: 545, eligible: 545 },
    { sport: "nfl", members: 478, eligible: 478 },
    { sport: "nrl", members: 337, eligible: 337 },
  ]);
  const [inventory] = await sql(
    "select jsonb_build_object('definitions',count(*),'issued',sum(issued),'approved',count(*) filter(where approved)) from commercial_billing.definitions",
  );
  assert.deepEqual(inventory, { definitions: 6540, issued: 888, approved: 0 });
  const [permissions] = await sql(
    `select jsonb_build_object('rls',bool_and(c.relrowsecurity),'publicGrants',(select count(*) from information_schema.role_table_grants where table_schema='season_catalogue' and grantee in('PUBLIC','anon','authenticated','service_role','docked_app','docked_beta_app','docked_nfl_worker','docked_commercial_app'))) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='season_catalogue' and c.relkind='r'`,
  );
  assert.equal(permissions.rls, true);
  assert.equal(permissions.publicGrants, 0);
  writeFileSync(
    directory + "restored-rehearsal.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        source: sourceContainer,
        target: container,
        hostedChanges: false,
        protectedTables: before.tables.length,
        allExistingRowsUnchanged: true,
        custodySha256: before.custody,
        pool,
        inventory,
        permissions,
        transactionRollbackPassed: true,
        migrationHashes: migrations.map((f) => ({
          file: f,
          sha256: hash(readFileSync("supabase/migrations/" + f, "utf8")),
        })),
        adoptionSha256: hash(
          readFileSync(directory + "adopt-catalogue.sql", "utf8"),
        ),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "PASS restored full transaction, rollback, adoption, all protected rows, custody, rights and closed inventory",
  );
}
main().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
