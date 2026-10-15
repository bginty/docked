import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";
const dir = "private-data/private-preview-release/",
  ref = "bckkllmndoxzpzdqrevb";
const c = JSON.parse(
  await readFile("private-data/hosted-preview/connection.json", "utf8"),
);
assert.equal(c.projectRef, ref);
const url = new URL(c.databaseUrl);
assert.ok(
  url.hostname === `db.${ref}.supabase.co` ||
    (url.hostname.endsWith(".pooler.supabase.com") &&
      decodeURIComponent(url.username) === `postgres.${ref}`),
);
const options = {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  onnotice: () => {},
  ssl: {
    rejectUnauthorized: true,
    ca: await readFile("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
};
const db = postgres(url.href, options);
let app;
try {
  const [role] =
    await db`select rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,rolcreatedb from pg_roles where rolname='docked_beta_app'`;
  assert.ok(role);
  for (const k of ["rolsuper", "rolbypassrls", "rolcreaterole", "rolcreatedb"])
    assert.equal(role[k], false);
  assert.equal(
    (await db`select enabled from beta_private.admission_control`)[0].enabled,
    false,
  );
  let runtime;
  if (role.rolcanlogin) {
    runtime = JSON.parse(await readFile(dir + "runtime.private.json", "utf8"));
    assert.equal(runtime.projectRef, ref);
  } else {
    const password = randomBytes(36).toString("base64url");
    const appUrl = new URL(url);
    appUrl.username = url.hostname.endsWith(".pooler.supabase.com")
      ? `docked_beta_app.${ref}`
      : "docked_beta_app";
    appUrl.password = password;
    runtime = {
      projectRef: ref,
      databaseUrl: appUrl.href,
      publishableKey: c.publishableKey,
      supabaseUrl: c.supabaseUrl,
      connectionMode: url.hostname.endsWith(".pooler.supabase.com")
        ? "session"
        : "direct",
    };
    await writeFile(dir + "runtime.private.json", JSON.stringify(runtime), {
      flag: "wx",
      mode: 0o600,
    });
    assert.match(password, /^[A-Za-z0-9_-]{48}$/);
    await db.unsafe(
      `alter role docked_beta_app login password '${password}' connection limit 8`,
    );
  }
  app = postgres(runtime.databaseUrl, options);
  assert.equal(
    (await app`select current_user role`)[0].role,
    "docked_beta_app",
  );
  for (const q of [
    "select * from auth.users",
    "select * from public.profiles",
    "select * from fantasy.cards",
    "update beta_private.admission_control set enabled=true",
  ])
    await assert.rejects(() => app.unsafe(q), /permission denied/);
  const report = {
    passed: true,
    projectRef: ref,
    role: "docked_beta_app",
    tlsVerified: true,
    privilegedAccessDenied: true,
    admissionEnabled: false,
    existingCredentialsRotated: false,
  };
  await writeFile(
    "docs/qa/private-preview-release/runtime.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} catch (e) {
  console.error(
    JSON.stringify({
      failed: true,
      code: e.code ?? e.name,
      detail: "Runtime setup requires reconciliation; credentials withheld",
    }),
  );
  process.exitCode = 1;
} finally {
  await app?.end({ timeout: 5 });
  await db.end({ timeout: 5 });
}
