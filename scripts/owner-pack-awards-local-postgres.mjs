// Disposable loopback PostgreSQL. No hosted project or customer is contacted.
// Install separately: npm install --prefix tmp/free-play-postgres-runtime --save-exact embedded-postgres@17.10.0-beta.17
import { randomBytes } from "node:crypto";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";

const runtime = resolve(
  process.env.OWNER_PACK_AWARDS_PG_RUNTIME ??
    "tmp/free-play-postgres-runtime/node_modules/embedded-postgres",
);
if (
  JSON.parse(readFileSync(join(runtime, "package.json"), "utf8")).version !==
  "17.10.0-beta.17"
)
  throw Error("Pinned isolated PostgreSQL runtime required");
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(join(runtime, "dist/index.js")).href
);
const socket = createServer();
await new Promise((done) => socket.listen(0, "127.0.0.1", done));
const port = socket.address().port;
await new Promise((done) => socket.close(done));
const directory = mkdtempSync(join(tmpdir(), "docked-pack-awards-"));
const password = randomBytes(32).toString("hex");
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  user: "postgres",
  password,
  port,
  persistent: false,
  createPostgresUser: false,
  authMethod: "scram-sha-256",
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  postgresFlags: ["-h", "127.0.0.1", "-c", "unix_socket_directories="],
  onLog: () => {},
  onError: (error) => console.error(error),
});
let code = 1;
try {
  await pg.initialise();
  let timeout;
  try {
    await Promise.race([
      pg.start(),
      new Promise((_, reject) => {
        timeout = setTimeout(
          () => reject(Error("Isolated PostgreSQL startup timed out")),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
  await pg.createDatabase("commercial_acceptance");
  const connection = new URL(
    `postgres://127.0.0.1:${port}/commercial_acceptance`,
  );
  connection.username = "postgres";
  connection.password = password;
  code = await new Promise((done, fail) => {
    const child = spawn(
      process.execPath,
      ["--import", "tsx", "scripts/owner-pack-awards-postgres.ts"],
      {
        stdio: "inherit",
        env: { ...process.env, COMMERCIAL_ACCEPTANCE_DB: connection.href },
      },
    );
    child.once("error", fail);
    child.once("close", (status) => done(status ?? 1));
  });
} finally {
  await pg.stop();
  rmSync(directory, { recursive: true, force: true });
}
process.exit(code);
