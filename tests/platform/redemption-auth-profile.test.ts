import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authUsersRelation,
  authSessionsRelation,
} from "../../src/core/auth-relations";
import { localMarketplaceAcceptance } from "../../src/core/local-marketplace-acceptance.mjs";
test("local beta uses admitted Auth projections without granting direct access to Auth tables", () => {
  const env = { APP_ENV: "development", DOCKED_BETA_STAGING: "true" };
  assert.equal(authUsersRelation(env), "private.runtime_auth_users");
  assert.equal(authSessionsRelation(env), "private.runtime_auth_sessions");
  assert.equal(
    authSessionsRelation({ APP_ENV: "development" }),
    "auth.sessions",
  );
});
test("redemption integration profile remains explicitly loopback and nondeployable", () => {
  const env: Record<string, string> = {
    DOCKED_LOCAL_MARKETPLACE_ACCEPTANCE: "true",
    DOCKED_REDEMPTION_LOCAL: "true",
    NODE_ENV: "development",
    SITE_URL: "http://127.0.0.1:3033",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55331",
    APP_ENV: "development",
    SUPABASE_ENV: "production",
    DOCKED_BETA_STAGING: "true",
    DOCKED_FRIENDS_BETA: "true",
    DOCKED_OWNER_GAMEPLAY: "true",
    BETA_ACCESS_ENABLED: "true",
    DATABASE_URL: new URL(
      "/docked_redemption_local_auth",
      "postgresql://127.0.0.1:55332",
    ).href,
  };
  const u = new URL(env.DATABASE_URL);
  u.username = "docked_beta_app";
  u.password = "fixture-only";
  env.DATABASE_URL = u.href;
  for (const k of [
    "REGISTRATION_ENABLED",
    "SENDING_ENABLED",
    "AUTH_EMAIL_ENABLED",
    "PAID_PLANS_ENABLED",
    "PRIZES_ENABLED",
    "COMPETITIONS_ENABLED",
    "ADS_ENABLED",
    "AFFILIATES_ENABLED",
    "DEALS_ENABLED",
    "DEMO_MODE",
  ])
    env[k] = "false";
  assert.equal(localMarketplaceAcceptance(env), true);
  for (const change of [
    { VERCEL: "1" },
    { NODE_ENV: "production" },
    { APP_ENV: "production" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.invalid" },
    { DATABASE_URL: env.DATABASE_URL.replace("127.0.0.1", "hosted.invalid") },
  ])
    assert.throws(() => localMarketplaceAcceptance({ ...env, ...change }));
});
