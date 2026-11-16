import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPackHostedAcceptance,
  packAcceptanceDisabledFlags,
  packAcceptanceIdentity,
  packAcceptanceTarget,
} from "../../src/core/pack-hosted-acceptance.mjs";
import { assertDeploymentEnvironment } from "../../src/core/deployment-environment";
import { packAcceptancePathAllowed } from "../../src/core/pack-hosted-acceptance.mjs";
import { betaSql } from "../../src/server/beta-sql";
import { packAcceptanceStatement } from "../../src/server/pack-acceptance-sql";
const now = Date.parse("2026-11-16T05:00:00Z");
const ids = [
  "b1000000-0000-4000-8000-000000000001",
  "b1000000-0000-4000-8000-000000000002",
];
function fixture(): Record<string, string> {
  return {
    ...Object.fromEntries(packAcceptanceDisabledFlags.map((k) => [k, "false"])),
    DOCKED_PACK_ACCEPTANCE: "true",
    DOCKED_PACK_ACCEPTANCE_FROM: new Date(now - 60000).toISOString(),
    DOCKED_PACK_ACCEPTANCE_UNTIL: new Date(now + 3600000).toISOString(),
    DOCKED_PACK_ACCEPTANCE_MEMBERS: ids.join(","),
    DOCKED_TEST_MARKET_READ_ONLY: "true",
    DOCKED_SPORTS_TEST_COMMERCE: "true",
    DOCKED_SPORTS_PRIVATE_BETA: "true",
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_PROJECT_ID: packAcceptanceTarget.projectId,
    VERCEL_ORG_ID: packAcceptanceTarget.teamId,
    VERCEL_GIT_COMMIT_REF: packAcceptanceTarget.branch,
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    VERCEL_URL: "docked-preview-acceptance.vercel.app",
    SITE_URL: "https://docked-preview-acceptance.vercel.app",
    APP_ENV: "preview",
    SUPABASE_ENV: "preview",
    DOCKED_RELEASE_CHANNEL: "beta",
    DOCKED_BETA_STAGING: "true",
    BETA_ACCESS_ENABLED: "true",
    DOCKED_OWNER_GAMEPLAY: "true",
    DATABASE_RUNTIME: "serverless",
    DATABASE_CONNECTION_MODE: "session",
    NEXT_PUBLIC_SUPABASE_URL: `https://${packAcceptanceTarget.projectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic",
    DATABASE_URL: `postgresql://${packAcceptanceTarget.databaseRole}.${packAcceptanceTarget.projectRef}:synthetic-only@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`,
  };
}
test("exact protected synthetic target and fixed expiry", () => {
  assert.equal(assertPackHostedAcceptance(fixture(), now), true);
  assert.throws(() => assertPackHostedAcceptance(fixture(), now + 3600000));
  assert.throws(() => assertPackHostedAcceptance(fixture(), now - 120000));
  assert.throws(() =>
    assertPackHostedAcceptance(
      {
        ...fixture(),
        DOCKED_PACK_ACCEPTANCE_UNTIL: new Date(now + 86400000).toISOString(),
      },
      now,
    ),
  );
});
test("Production, wrong target, privileged credentials and every activation flag denied", () => {
  for (const [key, value] of Object.entries({
    VERCEL_ENV: "production",
    VERCEL_PROJECT_ID: "prj_other",
    NEXT_PUBLIC_SUPABASE_URL: "https://pojoymtniryarxxunyvz.supabase.co",
    DATABASE_URL: fixture().DATABASE_URL.replace(
      "docked_pack_acceptance",
      "postgres",
    ),
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-forbidden",
    TWILIO_AUTH_TOKEN: "synthetic-forbidden",
    DOCKED_COMMERCIAL_DATABASE_URL: fixture().DATABASE_URL,
    DOCKED_PACK_ACCEPTANCE_MEMBERS: ids[0] + "," + ids[0],
    DOCKED_PACK_ACCEPTANCE: "yes",
    SITE_URL: "https://docked.com.au",
  }))
    assert.throws(
      () => assertPackHostedAcceptance({ ...fixture(), [key]: value }, now),
      key,
    );
  for (const key of packAcceptanceDisabledFlags)
    assert.throws(
      () => assertPackHostedAcceptance({ ...fixture(), [key]: "true" }, now),
      key,
    );
  assert.throws(() =>
    assertDeploymentEnvironment({
      ...fixture(),
      VERCEL_ENV: "production",
      DOCKED_ISOLATED_PUBLIC: "true",
    }),
  );
});
test("synthetic allowlist uses server metadata, not editable user metadata", () => {
  const user = {
    id: ids[0],
    email: "docked-batch1-0000000000000001@example.invalid",
    email_confirmed_at: new Date(now).toISOString(),
    is_anonymous: false,
    app_metadata: { docked_acceptance: "batch1-hosted-20261116" },
  };
  assert.equal(packAcceptanceIdentity(fixture(), user, now), true);
  for (const change of [
    { id: "b1000000-0000-4000-8000-000000000003" },
    { email: "founder@example.com" },
    { is_anonymous: true },
    { email_confirmed_at: null },
    { app_metadata: {}, user_metadata: user.app_metadata },
  ])
    assert.equal(
      packAcceptanceIdentity(fixture(), { ...user, ...change }, now),
      false,
    );
});
test("unconfigured mode preserves existing behaviour", () => {
  assert.equal(assertPackHostedAcceptance({}), false);
  assert.equal(
    assertPackHostedAcceptance({ DOCKED_PACK_ACCEPTANCE: "false" }),
    false,
  );
});

test("acceptance rewrites identifiers, never bound values or JSON", () => {
  const calls: unknown[][] = [];
  const fake = (...args: unknown[]) => {
    calls.push(args);
    return args;
  };
  const sql = betaSql(fake as never, packAcceptanceStatement) as typeof fake;
  const value = "credits_sandbox.state";
  const captured = sql`select * from credits_sandbox.state where marker=${value}`;
  assert.deepEqual(captured, calls[0]);
  assert.equal(
    (calls[0][0] as string[])[0],
    "select * from b1_credits_sandbox.state where marker=",
  );
  assert.equal(calls[0][1], value);
  sql("credits_sandbox");
  assert.equal(calls[1][0], "b1_credits_sandbox");
  sql({ payload: value });
  assert.deepEqual(calls[2][0], { payload: value });
  assert.equal(
    packAcceptanceStatement(
      "select auth.uid(),auth.jwt(),b1_credits_sandbox.state",
    ),
    "select b1_acceptance.uid(),b1_acceptance.jwt(),b1_credits_sandbox.state",
  );
});

test("only pack surfaces and static assets are exposed", () => {
  for (const path of ["/api/test-wallet", "/api/weekly-core"])
    assert.equal(packAcceptancePathAllowed(path, "POST"), true);
  for (const path of [
    "/api/auth",
    "/api/store/google/commercial",
    "/admin",
    "/fantasy/market",
    "/api/phone",
    "/app/signup",
  ])
    assert.equal(packAcceptancePathAllowed(path, "POST"), false);
  assert.equal(packAcceptancePathAllowed("/fantasy/cards", "GET"), true);
  assert.equal(packAcceptancePathAllowed("/fantasy/cards", "POST"), false);
});
