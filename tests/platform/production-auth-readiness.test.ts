import { test } from "node:test";
import assert from "node:assert/strict";
import {
  authUiReadiness,
  currentConsentVersions,
  explicitSignupConsent,
  legalConsentRequired,
  productionAuthRequestDenial,
  signupHandleCollision,
} from "../../src/core/auth-readiness";

const approved = {
  APP_ENV: "production",
  LEGAL_ENTITY_VERIFIED: "true",
  TERMS_VERSION: "terms-2026-10-v1",
  PRIVACY_POLICY_VERSION: "privacy-2026-10-v2",
};
test("production Auth mail is off by default and independent of optional delivery", () => {
  for (const action of ["signup", "recover", "resend"])
    for (const SENDING_ENABLED of [undefined, "false", "true"])
      assert.match(
        productionAuthRequestDenial(action, undefined, {
          ...approved,
          SENDING_ENABLED,
        })!,
        /not enabled/,
      );
  assert.equal(
    productionAuthRequestDenial("recover", undefined, {
      ...approved,
      AUTH_EMAIL_ENABLED: "true",
      SENDING_ENABLED: "false",
    }),
    null,
  );
  for (const action of ["login", "logout", "reset", "mfa_enroll", "mfa_verify"])
    assert.equal(
      productionAuthRequestDenial(action, undefined, approved),
      null,
    );
});
test("a Preview invitation cannot bypass production mail or registration gates", () => {
  for (const AUTH_EMAIL_ENABLED of ["false", "true"])
    assert.match(
      productionAuthRequestDenial("signup", "fictional-invitation", {
        ...approved,
        AUTH_EMAIL_ENABLED,
      })!,
      /cannot create production/,
    );
  assert.equal(
    productionAuthRequestDenial("signup", "fictional-invitation", {
      APP_ENV: "preview",
    }),
    null,
  );
});
test("all signup paths require explicit age, Terms and separate Privacy acceptance", () => {
  assert.equal(
    explicitSignupConsent({ age: true, terms: true, privacy: true }),
    true,
  );
  for (const key of ["age", "terms", "privacy"] as const)
    for (const value of [false, undefined])
      assert.equal(
        explicitSignupConsent({
          age: true,
          terms: true,
          privacy: true,
          [key]: value,
        }),
        false,
      );
});
test("production policy versions never default to draft and require operator readiness", () => {
  assert.deepEqual(currentConsentVersions(approved), {
    terms: approved.TERMS_VERSION,
    privacy: approved.PRIVACY_POLICY_VERSION,
  });
  for (const field of ["TERMS_VERSION", "PRIVACY_POLICY_VERSION"])
    for (const value of [
      undefined,
      "2026-10-draft",
      "PREVIEW-v1",
      "fixture-v1",
      "pending",
      "version\nother",
      "https://example.invalid/policy",
    ])
      assert.throws(() =>
        currentConsentVersions({ ...approved, [field]: value }),
      );
  assert.throws(() =>
    currentConsentVersions({ ...approved, LEGAL_ENTITY_VERIFIED: "false" }),
  );
  assert.deepEqual(currentConsentVersions({ APP_ENV: "preview" }), {
    terms: "2026-10-draft",
    privacy: "2026-10-draft",
  });
});
test("safe UI registration projection includes database authority and cannot expose credentials", () => {
  const env = {
    ...approved,
    REGISTRATION_ENABLED: "true",
    AUTH_EMAIL_ENABLED: "true",
    SUPABASE_SECRET_KEY: "fictional-private-canary",
  };
  assert.equal(authUiReadiness(env).registrationAvailable, false);
  assert.equal(authUiReadiness(env, true).registrationAvailable, true);
  assert.equal(authUiReadiness(env, true).invitationAllowed, false);
  assert.equal(
    JSON.stringify(authUiReadiness(env, true)).includes(
      env.SUPABASE_SECRET_KEY,
    ),
    false,
  );
  assert.equal(
    authUiReadiness({ ...env, PRIVACY_POLICY_VERSION: undefined }, true)
      .registrationAvailable,
    false,
  );
});
test("changed production legal versions require fresh explicit acceptance", () => {
  const versions = currentConsentVersions(approved);
  const input = {
    ageAttested: true,
    termsVersion: versions.terms,
    privacyGranted: true,
    privacyVersion: versions.privacy,
  };
  assert.equal(legalConsentRequired(input, versions, true), false);
  assert.equal(
    legalConsentRequired(
      { ...input, termsVersion: "2026-10-draft" },
      versions,
      true,
    ),
    true,
  );
  assert.equal(
    legalConsentRequired(
      { ...input, privacyVersion: "older-approved" },
      versions,
      true,
    ),
    true,
  );
  assert.equal(
    legalConsentRequired({ ...input, privacyGranted: false }, versions, false),
    true,
  );
});
test("only genuine username collisions are recoverable during signup provisioning", () => {
  assert.equal(
    signupHandleCollision({
      code: "23505",
      constraint_name: "social_profiles_handle_key",
    }),
    true,
  );
  assert.equal(
    signupHandleCollision({ code: "P0001", message: "Handle is reserved" }),
    true,
  );
  for (const error of [
    { code: "23505", constraint_name: "social_profiles_user_id_key" },
    { code: "23503" },
    { code: "P0001", message: "Protected identity" },
    new Error("network"),
    null,
  ])
    assert.equal(signupHandleCollision(error), false);
});
