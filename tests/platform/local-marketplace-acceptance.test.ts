import { test } from "node:test";
import assert from "node:assert/strict";
import { localMarketplaceAcceptance } from "../../src/core/local-marketplace-acceptance.mjs";
import config from "../../next.config";
import { healthOrigin } from "../../src/core/owner-health";
const local = () => ({
  DOCKED_LOCAL_MARKETPLACE_ACCEPTANCE: "true",
  NODE_ENV: "development",
  SITE_URL: "http://127.0.0.1:3033",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  APP_ENV: "production",
  SUPABASE_ENV: "production",
  DOCKED_BETA_STAGING: "true",
  DOCKED_FRIENDS_BETA: "true",
  DOCKED_OWNER_GAMEPLAY: "true",
  BETA_ACCESS_ENABLED: "true",
  DATABASE_URL: new URL(
    "postgresql://docked_beta_app:qa@127.0.0.1:55322/postgres",
  ).href,
  ...Object.fromEntries(
    [
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
    ].map((k) => [k, "false"]),
  ),
});
test("development eval is restricted to validated local acceptance and absent from normal headers", async () => {
  const before = { ...process.env };
  try {
    delete process.env.DOCKED_LOCAL_MARKETPLACE_ACCEPTANCE;
    const normal = JSON.stringify(await config.headers!());
    assert.ok(
      !normal.includes("unsafe-eval"),
      "Normal CSP retains its existing restriction",
    );
    Object.assign(process.env, local());
    assert.ok(
      JSON.stringify(await config.headers!()).includes("unsafe-eval"),
      "Local webpack can hydrate",
    );
    process.env.VERCEL = "1";
    await assert.rejects(async () => config.headers!(), /Invalid local/);
  } finally {
    for (const key of Object.keys(process.env))
      if (!(key in before)) delete process.env[key];
    Object.assign(process.env, before);
  }
});
test("local profile accepts only loopback development, real restricted-role target and closed activation", () => {
  assert.equal(localMarketplaceAcceptance({}), false);
  assert.equal(localMarketplaceAcceptance(local()), true);
  for (const change of [
    { NODE_ENV: "production" },
    { VERCEL: "1" },
    { NETLIFY: "1" },
    { DATABASE_URL: "postgresql://postgres:qa@127.0.0.1:55322/postgres" },
    { SITE_URL: "https://docked.com.au" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
    { SENDING_ENABLED: "true" },
    { PAID_PLANS_ENABLED: "true" },
    { DOCKED_OWNER_GAMEPLAY: "false" },
    { SUPABASE_SERVICE_ROLE_KEY: "fixture" },
  ])
    assert.throws(() => localMarketplaceAcceptance({ ...local(), ...change }));
});
test("explicit local admin health acceptance retains every nondeployable target boundary", () => {
  const admin = {
    ...local(),
    DOCKED_ADMIN_LOCAL_ACCEPTANCE: "true",
    APP_ENV: "development",
  };
  assert.equal(localMarketplaceAcceptance(admin), true);
  assert.equal(healthOrigin(admin.SITE_URL, false), admin.SITE_URL);
  assert.throws(() => healthOrigin(admin.SITE_URL, true));
  assert.throws(() =>
    localMarketplaceAcceptance({ ...local(), APP_ENV: "development" }),
  );
  for (const change of [
    { VERCEL: "1" },
    { NODE_ENV: "production" },
    { DOCKED_HOSTED_PRODUCTION: "true" },
    { SITE_URL: "https://docked.com.au" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co" },
    { DATABASE_URL: "postgresql://postgres:qa@127.0.0.1:55322/postgres" },
    { SENDING_ENABLED: "true" },
    { SUPABASE_SERVICE_ROLE_KEY: "fixture" },
    { DOCKED_ADMIN_LOCAL_ACCEPTANCE: "false" },
  ])
    assert.throws(() => localMarketplaceAcceptance({ ...admin, ...change }));
});
