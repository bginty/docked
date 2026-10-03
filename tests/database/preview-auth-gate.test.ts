import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { previewAuthReadinessQuery } from "../../src/server/preview-auth-query";
import {
  dockedPreviewProjectRef as ref,
  hostedPreviewCaptureReady,
  type PreviewCaptureReadiness,
} from "../../src/core/preview-auth";
let pg: PGlite;
const email = "docked-preview-gate-local@example.invalid",
  canary = "docked-preview-gate-canary@example.invalid";
const env = {
  APP_ENV: "preview",
  SUPABASE_ENV: "preview",
  PREVIEW_AUTH_PROJECT_REF: ref,
  PREVIEW_AUTH_CAPTURE_MODE: "verified_db_hook",
  SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  DATABASE_URL: `postgresql://postgres:fictional-password@db.${ref}.supabase.co:5432/postgres`,
  DATABASE_CONNECTION_MODE: "direct",
};
before(async () => {
  pg = new PGlite();
  await pg.exec(
    "create role anon;create role authenticated;create role service_role;create role supabase_auth_admin;",
  );
  await pg.query("select set_config('docked.preview_project_ref',$1,false)", [
    ref,
  ]);
  await pg.exec(
    await readFile("docs/qa/hosted-preview/setup-auth-capture.sql", "utf8"),
  );
});
after(async () => {
  await pg?.close();
});
async function allowed(recipient = email) {
  const rows = (
    await pg.query<Record<string, unknown>>(previewAuthReadinessQuery, [
      recipient,
    ])
  ).rows;
  const value = rows[0]
    ? (Object.fromEntries(
        Object.entries(rows[0]).map(([k, v]) => [
          k,
          v instanceof Date ? v.toISOString() : v,
        ]),
      ) as PreviewCaptureReadiness)
    : null;
  return hostedPreviewCaptureReady(recipient, env, value);
}
async function rollback(fn: () => Promise<void>) {
  await pg.exec("begin");
  try {
    await fn();
  } finally {
    await pg.exec("rollback");
  }
}
test("application query needs a real capture row, not only enabled configuration or proof ID", async () => {
  assert.equal(await allowed(), false);
  await pg.exec(
    "update preview_auth.configuration set enabled=true,configured_at=clock_timestamp(),expires_at=clock_timestamp()+interval '1 hour'",
  );
  await pg.query(
    "insert into preview_auth.allowed_recipients(email,expires_at) values($1,clock_timestamp()+interval '1 hour'),($2,clock_timestamp()+interval '1 hour')",
    [email, canary],
  );
  await pg.exec(
    "update preview_auth.configuration set hook_verified_at=clock_timestamp(),hook_verified_event_id='00000000-0000-4000-8000-000000000001',hook_function_sha256=repeat('a',64)",
  );
  assert.equal(await allowed(), false);
  await pg.exec("set role supabase_auth_admin");
  const captured = await pg.query<{ response: unknown }>(
    "select preview_auth.capture_email($1::jsonb) response",
    [
      JSON.stringify({
        user: { id: "00000000-0000-4000-8000-000000000002", email: canary },
        email_data: {
          email_action_type: "signup",
          site_url: "https://bckkllmndoxzpzdqrevb.supabase.co/auth/v1",
          redirect_to: `${env.SITE_URL}/auth/callback`,
          token_hash: "b".repeat(64),
        },
      }),
    ],
  );
  await pg.exec("reset role");
  assert.deepEqual(captured.rows[0].response, {});
  await pg.exec(
    "update preview_auth.configuration set hook_verified_at=clock_timestamp(),hook_verified_event_id=(select id from preview_auth.captured_mail limit 1),hook_function_sha256=encode(sha256(convert_to(pg_get_functiondef('preview_auth.capture_email(jsonb)'::regprocedure),'UTF8')),'hex')",
  );
  assert.equal(await allowed(), true);
  const projected = (
    await pg.query<Record<string, unknown>>(previewAuthReadinessQuery, [email])
  ).rows[0];
  assert.equal(
    Object.keys(projected).some((key) => /token|password/i.test(key)),
    false,
  );
  assert.equal(await allowed("docked-preview-unlisted@example.invalid"), false);
});
test("live hook definition changes, revoked proof and expired configuration immediately close app authorization", async () => {
  await rollback(async () => {
    await pg.exec(
      "alter function preview_auth.capture_email(jsonb) set search_path=public",
    );
    assert.equal(await allowed(), false);
  });
  await rollback(async () => {
    await pg.query(
      "update preview_auth.allowed_recipients set revoked_at=clock_timestamp() where email=$1",
      [canary],
    );
    assert.equal(await allowed(), false);
  });
  await rollback(async () => {
    await pg.query(
      "update preview_auth.allowed_recipients set revoked_at=clock_timestamp() where email=$1",
      [email],
    );
    assert.equal(await allowed(), false);
  });
  await rollback(async () => {
    await pg.exec(
      "update preview_auth.configuration set expires_at=clock_timestamp()-interval '1 second'",
    );
    assert.equal(await allowed(), false);
  });
  await rollback(async () => {
    await pg.exec(
      "update preview_auth.captured_mail set received_at=clock_timestamp()-interval '31 minutes',expires_at=clock_timestamp()-interval '1 minute'",
    );
    assert.equal(await allowed(), false);
  });
  assert.equal(await allowed(), true);
});
