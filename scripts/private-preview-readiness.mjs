import { readFile, writeFile } from "node:fs/promises";
import postgres from "postgres";
import assert from "node:assert/strict";
const c = JSON.parse(
  await readFile("private-data/hosted-preview/connection.json", "utf8"),
);
assert.equal(c.projectRef, "bckkllmndoxzpzdqrevb");
const owner = JSON.parse(
  await readFile(
    "private-data/private-preview-release/owner.private.json",
    "utf8",
  ),
);
assert.equal(owner.email, "support@docked.com.au");
const db = postgres(c.databaseUrl, {
  max: 1,
  prepare: false,
  connect_timeout: 20,
  onnotice: () => {},
  ssl: {
    rejectUnauthorized: true,
    ca: await readFile("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
});
try {
  const [status] =
    await db`select email_confirmed_at is not null as email_verified,coalesce(encrypted_password,'')<>'' as password_configured,exists(select 1 from auth.mfa_factors f where f.user_id=u.id and f.status='verified') as mfa_verified from auth.users u where u.id=${owner.id}::uuid and lower(u.email)=${owner.email}`;
  assert.ok(status);
  const [admission] =
    await db`select enabled from beta_private.admission_control`;
  const [counts] =
    await db`select (select count(*)::int from beta_private.admissions) admissions,(select count(*)::int from credits_sandbox.state) credit_states`;
  const report = {
    at: new Date().toISOString(),
    projectRef: c.projectRef,
    owner: "support@docked.com.au",
    ...status,
    admissionEnabled: admission.enabled,
    ...counts,
    scope:
      "Read-only exact owner setup readiness; no credentials, factors, member balances or content read.",
  };
  await writeFile(
    "docs/qa/private-preview-release/readiness.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await db.end({ timeout: 5 });
}
