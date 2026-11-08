// Disposable native PostgreSQL only. Reuses the already installed pinned runtime.
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const runtime = resolve(
  process.env.DOCKED_TEST_POSTGRES_RUNTIME ??
    "tmp/free-play-postgres-runtime/node_modules/embedded-postgres",
);
if (
  JSON.parse(readFileSync(resolve(runtime, "package.json"), "utf8")).version !==
  "17.10.0-beta.17"
)
  throw Error("Existing pinned local PostgreSQL runtime required");
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(resolve(runtime, "dist/index.js")).href
);
const socket = createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const password = randomBytes(32).toString("hex"),
  directory = resolve(`tmp/purchase-timing-${Date.now()}`);
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  user: "postgres",
  password,
  port,
  persistent: true,
  createPostgresUser: false,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: () => {},
});
const run = (cmd, args, env, stdio = "inherit") =>
  new Promise((r, j) => {
    const p = spawn(cmd, args, { windowsHide: true, stdio, env });
    p.once("error", j);
    p.once("close", (code) => r(code ?? 1));
  });
let started = false,
  code = 1;
try {
  const baseline = spawnSync(
    "git",
    ["show", "f07f76e0:src/server/credits-sandbox-store.ts"],
    { encoding: "utf8", windowsHide: true },
  );
  if (baseline.status !== 0) throw Error("Verified baseline unavailable");
  mkdirSync("tmp", { recursive: true });
  writeFileSync(
    "tmp/purchase-timing-baseline.ts",
    baseline.stdout.replaceAll('"../core/', '"../src/core/'),
  );
  await pg.initialise();
  await pg.start();
  started = true;
  await pg.createDatabase("docked_purchase_timing");
  const url = new URL(`postgres://127.0.0.1:${port}/docked_purchase_timing`);
  url.username = "postgres";
  url.password = password;
  code = await run(
    process.execPath,
    ["--import", "tsx", "scripts/purchase-timing-postgres.ts"],
    { ...process.env, PURCHASE_TIMING_DB: url.toString() },
  );
} finally {
  if (started) {
    // Native same-runtime executable; never stop another database instance.
    const binary = resolve(
      runtime,
      "../@embedded-postgres/windows-x64/native/bin/pg_ctl.exe",
    );
    const stopped = await run(
      binary,
      ["-D", directory, "-m", "fast", "-w", "-t", "30", "stop"],
      process.env,
      "ignore",
    );
    pg.process = undefined;
    if (stopped !== 0) code = 1;
  }
}
process.exit(code);
