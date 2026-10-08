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
  const id = "a".repeat(64);
  const jobs = [
    {
      id,
      fingerprint: "b".repeat(64),
      envelope: { version: 1, iv: "authored", ciphertext: "authored" },
    },
  ];
  const rpc = async (action, data) =>
    (
      await sql`select public.docked_mail_queue(${action},${sql.json({ mode: "controlled", ...data })}::jsonb) r`
    )[0].r;
  await Promise.all(Array.from({ length: 24 }, () => rpc("enqueue", { jobs })));
  assert.equal(
    (await sql`select count(*)::int n from private.docked_auth_mail_outbox`)[0]
      .n,
    1,
  );
  checks.push("24 concurrent enqueue requests create exactly one receipt");
  const workers = Array.from({ length: 24 }, () => crypto.randomUUID());
  const claims = await Promise.all(
    workers.map((worker) => rpc("claim", { id, worker })),
  );
  assert.equal(claims.filter(Boolean).length, 1);
  const worker = workers[claims.findIndex(Boolean)];
  checks.push("24 concurrent claims produce one lease owner");
  await rpc("dispatch", { id, worker });
  assert.equal(
    (
      await Promise.all(workers.map((worker) => rpc("claim", { id, worker })))
    ).filter(Boolean).length,
    0,
  );
  checks.push("No worker can reclaim a dispatched message");
  for (const code of ["authorization", "429", "ambiguous"])
    await assert.rejects(() =>
      rpc("settle", { id, worker, state: "pending", code }),
    );
  checks.push("Every tested post-dispatch retry transition denied");
  await rpc("settle", { id, worker, state: "unknown", code: "ambiguous" });
  assert.equal(await rpc("claim", { id, worker }), null);
  assert.equal(
    (
      await sql`select envelope from private.docked_auth_mail_outbox where id=${id}`
    )[0].envelope,
    null,
  );
  checks.push("Ambiguous outcome held and encrypted message removed");
  for (const role of ["anon", "authenticated", "docked_app"])
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          await tx.unsafe("set local role " + role);
          await tx.unsafe("select public.docked_mail_queue($1,$2::jsonb)", [
            "status",
            JSON.stringify({ mode: "controlled", id }),
          ]);
        }),
      /permission denied/,
    );
  checks.push("Anonymous, member and application-runtime RPC access denied");
  const report = {
    checkedAt: new Date().toISOString(),
    scope:
      "Isolated actual PostgreSQL 17.10 on loopback; no cloud credentials or records",
    passed: checks.length,
    checks,
  };
  writeFileSync(
    "docs/qa/fantasy-production/auth-mail-postgres.json",
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
} finally {
  await sql?.end({ timeout: 5 });
  if (started) await pg.stop();
  if (failed) process.exitCode = 1;
}
