import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const dir = "private-data/customer-signup";
mkdirSync(dir, { recursive: true });
const passwordFile = dir + "/password.txt";
if (!existsSync(passwordFile))
  writeFileSync(passwordFile, randomBytes(32).toString("hex"), { mode: 0o600 });
const password = readFileSync(passwordFile, "utf8");
assert.match(password, /^[a-f0-9]{64}$/);
const sql = ownerDatabase();
try {
  assert.equal(
    (await sql`select enabled from beta_private.friends_control`)[0].enabled,
    false,
  );
  await sql.unsafe(
    `alter role docked_signup_worker login password '${password}'`,
  );
  const runtime = JSON.parse(
    readFileSync(
      "private-data/production/beta-runtime-connection.json",
      "utf8",
    ),
  );
  assert.equal(runtime.projectRef, projectRef);
  const url = new URL(runtime.databaseUrl);
  url.username = "docked_signup_worker." + projectRef;
  url.password = password;
  writeFileSync(
    dir + "/worker.env",
    `DOCKED_SIGNUP_DATABASE_URL=${url.href}\nDOCKED_CUSTOMER_SIGNUP_ENABLED=false\n`,
    { mode: 0o600 },
  );
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/supabase/dist/supabase.js",
      "secrets",
      "set",
      "--project-ref",
      projectRef,
      "--env-file",
      dir + "/worker.env",
    ],
    { encoding: "utf8", windowsHide: true, timeout: 60000 },
  );
  writeFileSync(dir + "/install.log", result.stdout + "\n" + result.stderr, {
    mode: 0o600,
  });
  assert.equal(result.status, 0, "Inspect private install log");
  console.log(
    JSON.stringify({
      projectRef,
      worker: "docked_signup_worker",
      installed: true,
      signupEnabled: false,
      emailsSent: 0,
    }),
  );
} finally {
  await sql.end();
}
