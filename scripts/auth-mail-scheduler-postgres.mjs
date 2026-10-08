import { schedulerScenarios } from "./auth-mail-scheduler-scenarios.mjs";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import postgres from "postgres";
const runtime = resolve(
  "tmp/free-play-postgres-runtime/node_modules/embedded-postgres",
);
assert.equal(
  JSON.parse(readFileSync(runtime + "/package.json", "utf8")).version,
  "17.10.0-beta.17",
);
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(runtime + "/dist/index.js").href
);
const server = createServer();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
await new Promise((r) => server.close(r));
const password = randomBytes(30).toString("hex"),
  stamp = Date.now();
const log = resolve("tmp/mail-pg-" + stamp + ".log");
const record = (m) =>
  appendFileSync(log, String(m).replaceAll(password, "[redacted]") + "\n");
const pg = new EmbeddedPostgres({
  databaseDir: resolve("tmp/mail-pg-" + stamp),
  user: "postgres",
  password,
  port,
  persistent: true,
  createPostgresUser: false,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: record,
  onError: record,
});
let sql,
  started = false,
  failed = false;
const checks = [];
try {
  await pg.initialise();
  await pg.start();
  started = true;
  await pg.createDatabase("docked_mail_test");
  sql = postgres({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password,
    database: "docked_mail_test",
    max: 12,
    onnotice: () => {},
  });
  await sql.unsafe(
    "create role anon;create role authenticated;create role service_role;create role docked_app;",
  );
  await sql.unsafe(
    readFileSync(
      "config/production-email/supabase/migrations/20261008121711_docked_auth_email_outbox.sql",
      "utf8",
    ),
  );
  checks.push(...(await schedulerScenarios(sql)));
  const report = {
    checkedAt: new Date().toISOString(),
    scope:
      "Isolated actual PostgreSQL 17.10 on loopback; no cloud credentials or records",
    passed: checks.length,
    checks,
  };
  writeFileSync(
    "docs/qa/fantasy-production/auth-mail-scheduler-postgres.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} catch (e) {
  console.error(
    JSON.stringify({
      failed: true,
      name: e.name,
      message: String(e.message)
        .replaceAll(password, "[redacted]")
        .slice(0, 250),
    }),
  );
  failed = true;
  process.exitCode = 1;
} finally {
  await sql?.end({ timeout: 5 });
  if (started) await pg.stop();
  if (failed) process.exitCode = 1;
}
