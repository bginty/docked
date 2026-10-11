import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const sql = ownerDatabase();
try {
  const directory = "private-data/nfl-worker";
  mkdirSync(directory, { recursive: true });
  let saved;
  try {
    saved = JSON.parse(readFileSync(directory + "/secrets.json", "utf8"));
  } catch {
    saved = {
      password: randomBytes(32).toString("hex"),
      token: randomBytes(32).toString("hex"),
    };
    writeFileSync(directory + "/secrets.json", JSON.stringify(saved));
  }
  if (
    !/^[a-f0-9]{64}$/.test(saved.password) ||
    !/^[a-f0-9]{64}$/.test(saved.token)
  )
    throw Error("Invalid private worker configuration");
  await sql.unsafe(
    `alter role docked_nfl_worker login password '${saved.password}'`,
  );
  const runtime = JSON.parse(
    readFileSync(
      "private-data/production/beta-runtime-connection.json",
      "utf8",
    ),
  );
  const url = new URL(runtime.databaseUrl);
  url.username = "docked_nfl_worker." + projectRef;
  url.password = saved.password;
  writeFileSync(
    directory + "/worker.env",
    `DOCKED_NFL_WORKER_DATABASE_URL=${url.href}\nDOCKED_NFL_WORKER_TOKEN=${saved.token}\n`,
  );
  const cmd = spawnSync(
    process.execPath,
    [
      "node_modules/supabase/dist/supabase.js",
      "secrets",
      "set",
      "--project-ref",
      projectRef,
      "--env-file",
      directory + "/worker.env",
    ],
    { encoding: "utf8", windowsHide: true, timeout: 60000 },
  );
  writeFileSync(
    directory + "/secret-install.log",
    cmd.stdout + "\n" + cmd.stderr,
  );
  if (cmd.status !== 0) throw Error("Secret install failed; see private log");
  console.log(
    JSON.stringify({
      projectRef,
      workerRole: "docked_nfl_worker",
      secretsInstalled: true,
      memberRuntimeUnchanged: true,
    }),
  );
} finally {
  await sql.end();
}
