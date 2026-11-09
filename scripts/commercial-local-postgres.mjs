// Dedicated loopback-only, disposable real PostgreSQL acceptance runner.
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
const runtime = resolve(
  "tmp/free-play-postgres-runtime/node_modules/embedded-postgres",
);
if (
  JSON.parse(readFileSync(resolve(runtime, "package.json"), "utf8")).version !==
  "17.10.0-beta.17"
)
  throw Error("Pinned local PostgreSQL runtime required");
const { default: EmbeddedPostgres } = await import(
  pathToFileURL(resolve(runtime, "dist/index.js")).href
);
const socket = createServer();
await new Promise((r) => socket.listen(0, "127.0.0.1", r));
const port = socket.address().port;
await new Promise((r) => socket.close(r));
const password = randomBytes(32).toString("hex"),
  directory = resolve(
    `tmp/commercial-acceptance-${Date.now()}-${randomBytes(6).toString("hex")}`,
  );
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
    p.once("close", (c) => r(c ?? 1));
  });
let started = false,
  code = 1;
try {
  await pg.initialise();
  await pg.start();
  started = true;
  await pg.createDatabase("commercial_acceptance");
  const connection = new URL(
    `postgres://127.0.0.1:${port}/commercial_acceptance`,
  );
  connection.username = "postgres";
  connection.password = password;
  const publicGameplay = process.argv.includes("--public-gameplay");
  const social = process.argv.includes("--social");
  const gameplay =
    process.argv.includes("--gameplay") || publicGameplay || social;
  const gameConnection = new URL(connection);
  gameConnection.pathname = `/docked_free_play_test_${Date.now()}`;
  if (gameplay) await pg.createDatabase(gameConnection.pathname.slice(1));
  code = await run(
    process.execPath,
    [
      "--import",
      "tsx",
      ...(gameplay
        ? [
            "--test",
            `--test-name-pattern=${social ? "Commercial social" : publicGameplay ? `${process.argv.includes("--nfl") ? "NFL" : process.argv.includes("--nrl") ? "NRL" : "AFL"} public member` : process.argv.includes("--nrl") ? "NRL" : "AFL"}`,
            social
              ? "tests/database/commercial-social.test.ts"
              : publicGameplay
                ? "tests/database/public-customer.test.ts"
                : "tests/database/commercial-lineup.test.ts",
          ]
        : [
            process.argv.includes("--pack-supply")
              ? "scripts/commercial-pack-supply-postgres.ts"
              : process.argv.includes("--ops-alerts")
                ? "scripts/billing-ops-alerts-postgres.ts"
                : process.argv.includes("--pool-preparation")
                  ? "scripts/commercial-pool-rehearsal.ts"
                  : process.argv.includes("--report-snapshot")
                    ? "scripts/commercial-report-snapshot.ts"
                    : process.argv.includes("--retention")
                      ? "scripts/commercial-retention-postgres.ts"
                      : "scripts/commercial-billing-postgres.ts",
          ]),
      ...(process.argv.includes("--browser") ? ["--browser"] : []),
      ...(process.argv.includes("--reproduce-old") ? ["--reproduce-old"] : []),
      ...["--candidate", "--evidence"].flatMap((flag) => {
        const at = process.argv.indexOf(flag);
        if (at < 0) return [];
        const value = process.argv[at + 1];
        if (!value || value.startsWith("--"))
          throw Error(`${flag} requires a path`);
        return [flag, value];
      }),
    ],
    {
      ...process.env,
      COMMERCIAL_ACCEPTANCE_DB: connection.toString(),
      ...(gameplay
        ? { AUSTRALIAN_SALARY_TEST_DB: gameConnection.toString() }
        : {}),
    },
  );
} finally {
  if (started) {
    const stop = await run(
      resolve(
        "tmp/free-play-postgres-runtime/node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe",
      ),
      ["-D", directory, "-m", "fast", "-w", "-t", "30", "stop"],
      process.env,
      "ignore",
    );
    pg.process = undefined;
    if (stop !== 0) code = 1;
  }
}
process.exit(code);
