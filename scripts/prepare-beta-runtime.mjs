// Provision only the new restricted beta connection. Never rotate any existing
// credential. This creates no Auth account and does not enable admission/mail.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import postgres from "postgres";
import { databaseConnectionOptions } from "../src/server/database-tls.ts";
const ref = "pojoymtniryarxxunyvz",
  org = "otldyeunbqabbcjydjpe",
  root = "private-data/production/";
const provision = JSON.parse(
  readFileSync(root + "provision-request.json", "utf8"),
);
const existing = JSON.parse(readFileSync(root + "connection.json", "utf8"));
assert.equal(provision.organizationId, org);
assert.equal(existing.projectRef, ref);
assert.equal(existing.organizationId, org);
const target = new URL(
  readFileSync(
    root + "provider-config/supabase/.temp/pooler-url",
    "utf8",
  ).trim(),
);
assert.equal(target.username, `postgres.${ref}`);
assert.match(
  target.hostname,
  /^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/,
);
target.password = provision.databasePassword;
const tls = databaseConnectionOptions(target.href, {
  DATABASE_SSL_CA_FILE: resolve("certs/supabase-prod-ca-2021.crt"),
});
const admin = postgres(target.href, {
  ...tls,
  max: 1,
  connect_timeout: 15,
  onnotice: () => {},
});
let app;
try {
  const role = (
    await admin`select rolcanlogin,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication from pg_roles where rolname='docked_beta_app'`
  )[0];
  assert.ok(role);
  for (const k of [
    "rolsuper",
    "rolbypassrls",
    "rolcreatedb",
    "rolcreaterole",
    "rolreplication",
  ])
    assert.equal(role[k], false);
  assert.equal(
    (
      await admin`select 1 from pg_auth_members where member=(select oid from pg_roles where rolname='docked_beta_app')`
    ).length,
    0,
  );
  assert.equal(
    (await admin`select enabled from beta_private.admission_control`)[0]
      .enabled,
    false,
  );
  const file = root + "beta-runtime-connection.json";
  if (role.rolcanlogin) {
    assert.ok(existsSync(file), "Existing beta login: reconcile, never rotate");
    target.href = JSON.parse(readFileSync(file, "utf8")).databaseUrl;
  } else {
    assert.equal(
      existsSync(file),
      false,
      "Pending credential requires explicit reconciliation",
    );
    const password = randomBytes(36).toString("base64url");
    const appUrl = new URL(target);
    appUrl.username = `docked_beta_app.${ref}`;
    appUrl.password = password;
    writeFileSync(
      file,
      JSON.stringify(
        {
          projectRef: ref,
          organizationId: org,
          databaseRole: "docked_beta_app",
          connectionMode: "session",
          databaseUrl: appUrl.href,
          supabaseUrl: existing.supabaseUrl,
          publishableKey: existing.publishableKey,
        },
        null,
        2,
      ),
      { flag: "wx", mode: 0o600 },
    );
    assert.match(password, /^[A-Za-z0-9_-]{48}$/);
    await admin.unsafe(
      `alter role docked_beta_app login password '${password}' connection limit 8`,
    );
    target.href = appUrl.href;
  }
  assert.equal(target.username, `docked_beta_app.${ref}`);
  app = postgres(target.href, {
    ...tls,
    max: 1,
    connect_timeout: 15,
    onnotice: () => {},
  });
  const identity = (
    await app`select current_user role,(select ssl from pg_stat_ssl where pid=pg_backend_pid()) tls`
  )[0];
  assert.equal(identity.role, "docked_beta_app");
  assert.equal(identity.tls, true);
  for (const q of [
    "select * from fantasy.cards",
    "select * from private.roles",
    "select * from beta_private.admissions",
    "update beta_private.admission_control set enabled=true",
    "select beta_private.reserve_admission(null,null,null,null,null,null)",
  ])
    await assert.rejects(() => app.unsafe(q), /permission denied/);
  assert.equal(
    (
      await app`select beta_private.admitted('00000000-0000-4000-8000-000000000000') allowed`
    )[0].allowed,
    false,
  );
  const report = {
    checkedAt: new Date().toISOString(),
    project: ref,
    organization: org,
    role: identity.role,
    tlsVerified: true,
    officialAccessDenied: true,
    admissionMutationDenied: true,
    admissionEnabled: false,
    credentialStoredPrivately: true,
    existingCredentialsChanged: false,
  };
  mkdirSync("docs/qa/beta-isolation", { recursive: true });
  writeFileSync(
    "docs/qa/beta-isolation/hosted-runtime.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(JSON.stringify(report));
} catch (error) {
  console.error(
    JSON.stringify({
      error: "Beta runtime setup not confirmed; reconcile before retrying",
      code: error.code ?? null,
    }),
  );
  process.exitCode = 1;
} finally {
  await app?.end({ timeout: 5 });
  await admin.end({ timeout: 5 });
}
