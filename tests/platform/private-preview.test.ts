import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPrivatePreview,
  privatePreviewOrigin,
  privatePreviewDisabledFlags,
} from "../../src/core/private-preview.mjs";
import { assertHostedBeta, betaOrigin } from "../../src/core/hosted-beta.mjs";
import { assertSportSandbox } from "../../src/core/sport-sandbox";
const valid = () => ({
  DOCKED_PREVIEW_OWNER_ID: "00000000-0000-4000-8000-000000000001",
  DOCKED_PREVIEW_OWNER_EMAIL: "support@docked.com.au",
  ...Object.fromEntries(privatePreviewDisabledFlags.map((k) => [k, "false"])),
  DOCKED_PRIVATE_PREVIEW: "true",
  DOCKED_BETA_STAGING: "true",
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_PROJECT_ID: "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR",
  VERCEL_ORG_ID: "team_tf6xweKKyVCj9bTppUKttJ4l",
  VERCEL_GIT_COMMIT_REF: "pivot/fantasy-cards-preview-v1",
  VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
  VERCEL_URL: "docked-preview-candidate.vercel.app",
  SITE_URL: "https://docked-preview-s24-briant-ginty.vercel.app",
  APP_ENV: "preview",
  SUPABASE_ENV: "preview",
  DOCKED_RELEASE_CHANNEL: "beta",
  DATABASE_RUNTIME: "serverless",
  NEXT_PUBLIC_SUPABASE_URL: "https://bckkllmndoxzpzdqrevb.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  DATABASE_CONNECTION_MODE: "direct",
  DATABASE_URL:
    "postgresql://docked_beta_app:" +
    encodeURIComponent("generated-local-test-value") +
    "@db.bckkllmndoxzpzdqrevb.supabase.co:5432/postgres",
  BETA_ACCESS_ENABLED: "false",
  BETA_TESTERS_ENABLED: "false",
  AUTH_EMAIL_ENABLED: "false",
  DOCKED_AUTH_INVITES_READY: "false",
  FANTASY_FREE_PLAY_PRODUCTION: "false",
});

test("closed Preview binds the isolated project and restricted database role", () => {
  const env = valid();
  assert.equal(assertPrivatePreview(env), true);
  assert.equal(assertHostedBeta(env), true);
  assert.equal(betaOrigin(env), env.SITE_URL);
  assert.equal(privatePreviewOrigin(env), env.SITE_URL);
  assert.equal(assertPrivatePreview({}), false);
});

test("sport sandbox accepts the restricted closed Preview without enabling admission", () => {
  const env = { ...valid(), DOCKED_MULTI_SPORT_SANDBOX: "true" };
  assert.doesNotThrow(() => assertSportSandbox(env));
  for (const [key, value] of Object.entries({
    VERCEL_ENV: "production",
    DOCKED_MULTI_SPORT_SANDBOX: "false",
    DATABASE_URL: env.DATABASE_URL.replace("docked_beta_app", "postgres"),
    NEXT_PUBLIC_SUPABASE_URL: "https://pojoymtniryarxxunyvz.supabase.co",
    BETA_ACCESS_ENABLED: "true",
    AUTH_EMAIL_ENABLED: "true",
    FANTASY_CARDS_PREVIEW: "true",
  })) {
    assert.throws(() => assertSportSandbox({ ...env, [key]: value }), key);
  }
});
test("Preview refuses Production, privileged roles, capture mode and unsupported activation", () => {
  assert.throws(
    () =>
      assertPrivatePreview({ ...valid(), DOCKED_NFL_HOSTED_TESTING: "true" }),
    /not approved/,
  );
  for (const [key, value] of Object.entries({
    VERCEL_ENV: "production",
    VERCEL_PROJECT_ID: "prj_l0rpVDPRuIRp9UcBUkR3rk4oRFegYR",
    SUPABASE_ENV: "production",
    APP_ENV: "production",
    SITE_URL: "https://docked.com.au",
    NEXT_PUBLIC_SUPABASE_URL: "https://pojoymtniryarxxunyvz.supabase.co",
    DATABASE_URL: valid().DATABASE_URL.replace("docked_beta_app", "postgres"),
    DOCKED_FRIENDS_BETA: "true",
    BETA_ACCESS_ENABLED: "true",
    BETA_TESTERS_ENABLED: "true",
    AUTH_EMAIL_ENABLED: "true",
    FANTASY_FREE_PLAY_PRODUCTION: "true",
    SUPABASE_SERVICE_ROLE_KEY: "not-an-actual-key",
    PREVIEW_AUTH_CAPTURE_MODE: "verified_db_hook",
  }))
    assert.throws(
      () => assertPrivatePreview({ ...valid(), [key]: value }),
      /Unreviewed/,
      key,
    );
  for (const flag of privatePreviewDisabledFlags)
    assert.throws(
      () => assertPrivatePreview({ ...valid(), [flag]: "true" }),
      /Unreviewed/,
      flag,
    );
});
