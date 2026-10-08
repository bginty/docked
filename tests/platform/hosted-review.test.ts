import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  assertHostedReview,
  reviewDisabledFlags,
  reviewBranch,
  reviewProject,
} from "../../src/core/hosted-review.mjs";
import { assertDeploymentEnvironment } from "../../src/core/deployment-environment";
import { config, sameApplicationOrigin } from "../../src/server/config";
import manifest from "../../config/hosted-production.json";

function environment(): Record<string, string> {
  return {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_TARGET_ENV: "preview",
    VERCEL_URL: "docked-production-authored-test.vercel.app",
    VERCEL_PROJECT_ID: reviewProject,
    VERCEL_GIT_COMMIT_REF: reviewBranch,
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    DOCKED_HOSTED_REVIEW: "true",
    APP_ENV: "preview",
    SUPABASE_ENV: "unconfigured",
    DOCKED_HOSTED_PRODUCTION: "false",
    DOCKED_HOSTED_PREVIEW: "false",
    ...Object.fromEntries(
      reviewDisabledFlags.map((flag: string) => [flag, "false"]),
    ),
  };
}

test("review allows the existing shell with no services while production remains unapproved", () => {
  const env = environment();
  assert.equal(manifest.approved, false);
  assert.equal(assertHostedReview(env), true);
  assert.doesNotThrow(() => assertDeploymentEnvironment(env));
  const actual = config(env);
  assert.equal(actual.database, false);
  assert.equal(actual.auth, false);
  assert.equal(actual.registration, false);
  assert.equal(actual.sending, false);
  assert.equal(actual.production, false);
  assert.equal(actual.siteUrl, `https://${env.VERCEL_URL}`);
});

test("review accepts only its validated deployment origin and fails closed on configuration drift", () => {
  const env = environment();
  const origin = `https://${env.VERCEL_URL}`;
  assert.equal(sameApplicationOrigin(origin, env), true);
  for (const rejected of [
    null,
    "",
    "null",
    "http://localhost:3000",
    "https://docked.com.au",
    `${origin}.evil.invalid`,
    `${origin}/path`,
  ])
    assert.equal(sameApplicationOrigin(rejected, env), false);
  for (const change of [
    { VERCEL_ENV: "production" },
    { VERCEL_GIT_COMMIT_REF: "main" },
    { SITE_URL: "https://example.invalid" },
    { DATABASE_URL: "authored-invalid" },
  ])
    assert.equal(sameApplicationOrigin(origin, { ...env, ...change }), false);
  assert.equal(sameApplicationOrigin("http://localhost:3000", {}), true);
  assert.equal(
    sameApplicationOrigin("https://approved.example", {
      SITE_URL: "https://approved.example",
    }),
    true,
  );
  assert.equal(
    sameApplicationOrigin("https://approved.example", {
      SITE_URL: "not a URL",
    }),
    false,
  );
});

test("review refuses production, other projects, branches, origins and incomplete identities", () => {
  for (const change of [
    { VERCEL_ENV: "production" },
    { VERCEL_TARGET_ENV: "production" },
    { VERCEL_PROJECT_ID: "prj_other" },
    { VERCEL_GIT_COMMIT_REF: "main" },
    { VERCEL_GIT_COMMIT_SHA: "" },
    { VERCEL: "" },
    { DOCKED_HOSTED_REVIEW: "TRUE" },
    { APP_ENV: "production" },
    { SUPABASE_ENV: "production" },
    { DOCKED_HOSTED_PRODUCTION: "true" },
    { DOCKED_HOSTED_PREVIEW: "true" },
    { NETLIFY: "true" },
    { SITE_ID: "other" },
    { VERCEL_URL: "docked.com.au" },
    { VERCEL_URL: "docked-production-safe.vercel.app.evil.invalid" },
    { SITE_URL: "https://docked.com.au" },
    { PREVIEW_AUTH_CAPTURE_MODE: "true" },
  ])
    assert.throws(() =>
      assertDeploymentEnvironment({ ...environment(), ...change }),
    );
});

test("review rejects every enabled or omitted capability and any supplied service credential", () => {
  for (const flag of reviewDisabledFlags) {
    assert.throws(() =>
      assertHostedReview({ ...environment(), [flag]: "true" }),
    );
    assert.throws(() =>
      assertHostedReview({ ...environment(), [flag]: undefined }),
    );
  }
  for (const key of [
    "DATABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_ACCESS_TOKEN",
    "MICROSOFT_PRIVATE_KEY",
    "GRAPH_TOKEN",
    "SMTP_PASSWORD",
    "DOCKED_AUTH_EMAIL_WORKER_SECRET",
    "THE_ODDS_API_KEY",
    "ODDSPAPI_API_KEY",
    "RESEND_API_KEY",
    "SENDGRID_API_KEY",
    "EMAIL_API_KEY",
    "EMAIL_WEBHOOK_SECRET",
    "SCANNER_WORKER_TOKEN",
    "PROVIDER_TRIAL_OPERATOR_TOKEN",
  ]) {
    assert.throws(() =>
      assertHostedReview({ ...environment(), [key]: "authored-fixture" }),
    );
  }
});

test("review is opt-in and cannot enable the production target through the hosted build command", () => {
  assert.equal(assertHostedReview({}), false);
  const run = (change: Record<string, string | undefined> = {}) =>
    spawnSync(process.execPath, ["scripts/guard-hosted-build.mjs"], {
      env: { ...environment(), ...change, NODE_ENV: "test" },
      encoding: "utf8",
    });
  assert.equal(run().status, 0);
  for (const change of [
    { VERCEL_ENV: "production" },
    { DOCKED_HOSTED_REVIEW: "false" },
    { DATABASE_URL: "authored-private-value" },
  ]) {
    const result = run(change);
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stderr, /authored-private-value/);
  }
});
