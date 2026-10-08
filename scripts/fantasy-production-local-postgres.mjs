// Optional Windows test runner. No cloud connections or production dependencies.
// First: npm install --prefix tmp/free-play-postgres-runtime --save-exact embedded-postgres@17.10.0-beta.17
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const runtime = resolve(
  "tmp/free-play-postgres-runtime/node_modules/embedded-postgres",
);
if (
  JSON.parse(readFileSync(resolve(runtime, "package.json"), "utf8")).version !==
  "17.10.0-beta.17"
)
  throw Error("Install the documented pinned test runtime first");
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(resolve(runtime, "dist/index.js")).href
);
const listener = createServer();
await new Promise((done) => listener.listen(0, "127.0.0.1", done));
const port = listener.address().port;
await new Promise((done) => listener.close(done));
const password = randomBytes(30).toString("hex");
const stamp = Date.now();
const log = resolve(`tmp/free-play-pg-${stamp}.log`);
const record = (message) =>
  appendFileSync(
    log,
    String(message).replaceAll(password, "[redacted]") + "\n",
  );
const pg = new EmbeddedPostgres({
  databaseDir: resolve(`tmp/free-play-pg-${stamp}`),
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
let started = false;
try {
  await pg.initialise();
  await pg.start();
  started = true;
  const database = `docked_free_play_test_${stamp}`;
  await pg.createDatabase(database);
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "scripts/fantasy-production-concurrency.ts"],
    {
      windowsHide: true,
      stdio: "inherit",
      env: {
        ...process.env,
        FANTASY_TEST_DATABASE_URL: `postgres://postgres:${password}@127.0.0.1:${port}/${database}`,
      },
    },
  );
  process.exitCode = await new Promise((done, reject) => {
    child.once("error", reject);
    child.once("close", (code) => done(code ?? 1));
  });
} catch {
  console.error(
    "Isolated PostgreSQL runner failed. Inspect its ignored tmp log; no credential was printed.",
  );
  process.exitCode = 1;
} finally {
  if (started) await pg.stop();
}
