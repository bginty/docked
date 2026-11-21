import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const file = process.argv[2];
if (!file) throw Error("Supply the local deletion-auth-local status file");
const raw = readFileSync(file, "utf8");
const settings = JSON.parse(
  raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1),
);
assert.equal(settings.API_URL, "http://127.0.0.1:54321");
const env = JSON.parse(
  execFileSync("docker", ["inspect", "supabase_auth_deletion-auth-local"], {
    encoding: "utf8",
  }),
)[0].Config.Env;
assert(env.includes("GOTRUE_SMTP_HOST=supabase_inbucket_deletion-auth-local"));
assert(!env.includes("GOTRUE_HOOK_SEND_EMAIL_ENABLED=true"));
const local = (key) =>
  createClient(settings.API_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
const admin = local(settings.SERVICE_ROLE_KEY);
const email = "owner-session-" + randomUUID() + "@example.invalid",
  password = randomBytes(32).toString("hex");
const { data, error } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});
assert.ifError(error);
const uid = data.user.id;
const active = () =>
  Number(
    execFileSync(
      "docker",
      [
        "exec",
        "supabase_db_deletion-auth-local",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-Atc",
        "select count(*) from auth.sessions where user_id='" + uid + "'",
      ],
      { encoding: "utf8" },
    ).trim(),
  );
try {
  const a = local(settings.ANON_KEY),
    b = local(settings.ANON_KEY);
  for (const c of [a, b])
    assert.ifError(
      (await c.auth.signInWithPassword({ email, password })).error,
    );
  assert.equal(active(), 2);
  assert.ifError((await a.auth.signOut({ scope: "local" })).error);
  assert.equal(active(), 1);
  assert.ifError((await b.auth.refreshSession()).error);
  assert.ifError((await a.auth.signInWithPassword({ email, password })).error);
  assert.equal(active(), 2);
  assert.ifError((await a.auth.signOut({ scope: "global" })).error);
  assert.equal(active(), 0);
  assert.ok((await b.auth.refreshSession()).error);
  console.log(
    "PASS two real isolated Auth sessions, local revocation, sibling refresh, re-login, global revocation and stale sibling rejection.",
  );
} finally {
  assert.ifError((await admin.auth.admin.deleteUser(uid)).error);
}
