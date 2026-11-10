import test from "node:test";
import assert from "node:assert/strict";
import {
  assertIsolatedPublicPreview,
  isolatedPreviewReadOnlyIdentity,
  isolatedExternalEmailRecipient,
  isolatedPhoneTestIdentity,
} from "../../src/core/isolated-public-preview.mjs";
import { customerEmailEnabled } from "../../src/core/customer-email-readiness";
import { assertDeploymentEnvironment } from "../../src/core/deployment-environment";
import {
  authUiReadiness,
  productionAuthRequestDenial,
} from "../../src/core/auth-readiness";
import { customerOnboardingEnabled } from "../../src/core/customer-onboarding.mjs";
import { phoneDeliveryReady } from "../../src/core/public-phone";
import {
  commercialLedgerEnvironment,
  isolatedBillingConfiguration,
  isolatedBillingIdentity,
} from "../../src/core/isolated-billing-acceptance";
import {
  authUsersRelation,
  authSessionsRelation,
} from "../../src/core/auth-relations";
const ref = "bckkllmndoxzpzdqrevb";
const env: Record<string, string> = {
  DOCKED_ISOLATED_PUBLIC: "true",
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_PROJECT_ID: "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR",
  VERCEL_ORG_ID: "team_tf6xweKKyVCj9bTppUKttJ4l",
  APP_ENV: "preview",
  SUPABASE_ENV: "preview",
  DOCKED_PUBLIC_CUSTOMERS: "true",
  REGISTRATION_ENABLED: "true",
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  SITE_URL: "https://docked-preview-s24-briant-ginty.vercel.app",
  VERCEL_URL: "docked-preview-abc-briant-s-projects.vercel.app",
  DATABASE_URL: `postgresql://docked_app.${ref}:fixture@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`,
  ...Object.fromEntries(
    [
      "DOCKED_BETA_STAGING",
      "DOCKED_PRIVATE_PREVIEW",
      "DOCKED_HOSTED_PRODUCTION",
      "DOCKED_HOSTED_REVIEW",
      "DOCKED_HOSTED_PREVIEW",
      "DOCKED_FRIENDS_BETA",
      "DOCKED_COMMERCIAL_CHECKOUT",
      "DOCKED_RETENTION_APPLY",
      "PRIZES_ENABLED",
      "COMPETITIONS_ENABLED",
      "PAID_PLANS_ENABLED",
      "SENDING_ENABLED",
      "PRO_ENTITLEMENTS_ENABLED",
      "DOCKED_OWNER_GAMEPLAY",
    ].map((k) => [k, "false"]),
  ),
};
test("private phone acceptance admits only two existing accounts and keeps registration closed", () => {
  const memberA = "00000000-0000-4000-8000-000000000001";
  const memberB = "00000000-0000-4000-8000-000000000002";
  const phoneEnv = {
    ...env,
    NODE_ENV: "test" as const,
    REGISTRATION_ENABLED: "false",
    DOCKED_ISOLATED_PHONE_TEST: "true",
    DOCKED_ISOLATED_PHONE_MEMBERS: `${memberA},${memberB}`,
    DOCKED_ISOLATED_PHONE_UNTIL: new Date(Date.now() + 3600000).toISOString(),
    DOCKED_PUBLIC_PHONE_OTP: "true",
    DOCKED_PUBLIC_PHONE_POLICY_REFERENCE:
      "Founder-approved isolated OTP acceptance",
    DOCKED_ISOLATED_GOOGLE_TEST: "false",
  };
  assert.doesNotThrow(() => assertDeploymentEnvironment(phoneEnv));
  assert.equal(authUsersRelation(phoneEnv), "private.runtime_auth_users");
  assert.equal(authUiReadiness(phoneEnv, true).registrationAvailable, false);
  assert.equal(customerOnboardingEnabled(phoneEnv), false);
  assert(productionAuthRequestDenial("signup", undefined, phoneEnv));
  assert(
    productionAuthRequestDenial("signup", "old-preview-invitation", phoneEnv),
  );
  assert.equal(productionAuthRequestDenial("login", undefined, phoneEnv), null);
  assert.equal(phoneDeliveryReady(phoneEnv), true);
  assert.equal(isolatedPhoneTestIdentity(phoneEnv, memberA), true);
  assert.equal(isolatedPhoneTestIdentity(phoneEnv, memberB), true);
  assert.equal(
    isolatedPhoneTestIdentity(phoneEnv, "00000000-0000-4000-8000-000000000003"),
    false,
  );
  assert.equal(isolatedPhoneTestIdentity(env, memberA), false);
  for (const patch of [
    { REGISTRATION_ENABLED: "true" },
    { DOCKED_ISOLATED_PHONE_MEMBERS: `${memberA},${memberA}` },
    { DOCKED_ISOLATED_PHONE_MEMBERS: "*" },
    { DOCKED_ISOLATED_PHONE_UNTIL: "2000-01-01" },
    {
      DOCKED_ISOLATED_PHONE_UNTIL: new Date(
        Date.now() + 7 * 3600000,
      ).toISOString(),
    },
    { DOCKED_PUBLIC_PHONE_POLICY_REFERENCE: "" },
    { DOCKED_PUBLIC_PHONE_OTP: "false" },
    { DOCKED_ISOLATED_GOOGLE_TEST: "true" },
    { VERCEL_ENV: "production" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://pojoymtniryarxxunyvz.supabase.co" },
    { DOCKED_COMMERCIAL_CHECKOUT: "true" },
  ])
    assert.throws(() => assertDeploymentEnvironment({ ...phoneEnv, ...patch }));
});
test("closed Google test window preserves isolated ledger reads without admitting checkout", () => {
  const e = {
    ...env,
    DOCKED_COMMERCIAL_DATABASE_URL: `postgresql://docked_isolated_commercial.${ref}:fixture@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`,
    DOCKED_ISOLATED_GOOGLE_TEST: "false",
  };
  assert.equal(commercialLedgerEnvironment(e), "acceptance");
  assert.equal(isolatedBillingConfiguration(e), null);
  assert.equal(
    isolatedBillingIdentity(e, "unadmitted", "unknown@example.invalid"),
    false,
  );
  assert.equal(commercialLedgerEnvironment({}), "commercial");
  for (const patch of [
    { VERCEL_ENV: "production" },
    { VERCEL_PROJECT_ID: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST" },
    { DOCKED_COMMERCIAL_CHECKOUT: "true" },
    {
      DOCKED_COMMERCIAL_DATABASE_URL: e.DOCKED_COMMERCIAL_DATABASE_URL.replace(
        "docked_isolated_commercial",
        "docked_app",
      ),
    },
    {
      DOCKED_COMMERCIAL_DATABASE_URL: e.DOCKED_COMMERCIAL_DATABASE_URL.replace(
        ref,
        "pojoymtniryarxxunyvz",
      ),
    },
  ])
    assert.throws(() => commercialLedgerEnvironment({ ...e, ...patch }));
});
test("Google TEST admission cannot select Production, a different account, live checkout or an expired window", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const email = "docked-preview-public-member-abcdef@example.invalid";
  const e = {
    ...env,
    DOCKED_COMMERCIAL_DATABASE_URL: `postgresql://docked_isolated_commercial.${ref}:fixture@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres`,
    DOCKED_ISOLATED_GOOGLE_TEST: "true",
    DOCKED_ISOLATED_GOOGLE_MEMBER: id,
    DOCKED_ISOLATED_GOOGLE_EMAIL: email,
    DOCKED_ISOLATED_GOOGLE_UNTIL: new Date(Date.now() + 3600000).toISOString(),
  };
  assert(isolatedBillingIdentity(e, id, email));
  assert(
    !isolatedBillingIdentity(e, "00000000-0000-4000-8000-000000000002", email),
  );
  assert(!isolatedBillingIdentity(e, id, "someone@example.invalid"));
  assert.equal(isolatedBillingConfiguration({}), null);
  for (const patch of [
    { VERCEL_ENV: "production" },
    { DOCKED_COMMERCIAL_CHECKOUT: "true" },
    { DOCKED_ISOLATED_GOOGLE_UNTIL: "2000-01-01" },
    {
      DOCKED_COMMERCIAL_DATABASE_URL: e.DOCKED_COMMERCIAL_DATABASE_URL.replace(
        ref,
        "pojoymtniryarxxunyvz",
      ),
    },
  ])
    assert.throws(() => isolatedBillingConfiguration({ ...e, ...patch }));
});
test("external Preview email uses exact expiring admission without granting transactions or invitations", () => {
  const e = {
    ...env,
    AUTH_EMAIL_ENABLED: "true",
    DOCKED_ISOLATED_EMAIL_RECIPIENT: "authorised@example.test",
    DOCKED_ISOLATED_EMAIL_UNTIL: new Date(Date.now() + 3600000).toISOString(),
  };
  assert.equal(customerEmailEnabled(e), true);
  assert.equal(
    isolatedExternalEmailRecipient(e, "authorised@example.test"),
    true,
  );
  assert.equal(
    isolatedPreviewReadOnlyIdentity(e, "authorised@example.test"),
    true,
  );
  assert.equal(isolatedExternalEmailRecipient(e, "other@example.test"), false);
  assert.equal(customerEmailEnabled(env), false);
  for (const patch of [
    { AUTH_EMAIL_ENABLED: "false" },
    { DOCKED_ISOLATED_EMAIL_UNTIL: "invalid" },
    { DOCKED_ISOLATED_EMAIL_UNTIL: "2000-01-01" },
    { DOCKED_ISOLATED_EMAIL_RECIPIENT: "a@b.test,c@d.test" },
  ])
    assert.equal(customerEmailEnabled({ ...e, ...patch }), false);
  assert.throws(() => customerEmailEnabled({ ...e, VERCEL_ENV: "production" }));
});
test("public acceptance is bound to existing protected Preview, with ordinary-customer mode and narrow Auth projections", () => {
  assert.equal(assertIsolatedPublicPreview(env), true);
  assert.doesNotThrow(() => assertDeploymentEnvironment(env));
  assert.equal(authUsersRelation(env), "private.runtime_auth_users");
  assert.equal(authSessionsRelation(env), "private.runtime_auth_sessions");
  assert.equal(assertIsolatedPublicPreview({}), false);
  assert.equal(authUiReadiness(env, true).registrationAvailable, true);
  assert.equal(authUiReadiness(env, false).registrationAvailable, false);
  assert.equal(
    isolatedPreviewReadOnlyIdentity(
      env,
      "docked-preview-public-member-a1@example.invalid",
    ),
    true,
  );
  assert.equal(
    isolatedPreviewReadOnlyIdentity(
      {},
      "docked-preview-public-member-a1@example.invalid",
    ),
    false,
  );
  assert.equal(
    isolatedPreviewReadOnlyIdentity(env, "unrelated@example.invalid"),
    false,
  );
});
test("public acceptance rejects Production, cross-project credentials, privileged runtime and checkout", () => {
  const mutations = [
    { VERCEL_ENV: "production" },
    { VERCEL_TARGET_ENV: "production" },
    { VERCEL_PROJECT_ID: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST" },
    { SITE_URL: "https://docked.com.au" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://pojoymtniryarxxunyvz.supabase.co" },
    { DATABASE_URL: env.DATABASE_URL.replace(ref, "pojoymtniryarxxunyvz") },
    { DATABASE_URL: env.DATABASE_URL.replace("docked_app.", "postgres.") },
    {
      DOCKED_COMMERCIAL_DATABASE_URL: env.DATABASE_URL.replace(
        ref,
        "pojoymtniryarxxunyvz",
      ),
    },
    { DOCKED_COMMERCIAL_CHECKOUT: "true" },
    { PRIZES_ENABLED: "true" },
    { SUPABASE_SECRET_KEY: "fixture" },
    { DOCKED_GOOGLE_COMMERCIAL_PRIVATE_KEY: "fixture" },
    { DOCKED_BETA_STAGING: "true" },
    { DOCKED_RETENTION_APPLY: "true" },
    { DOCKED_ISOLATED_PUBLIC: "yes" },
  ];
  for (const change of mutations)
    assert.throws(() => assertDeploymentEnvironment({ ...env, ...change }));
});
