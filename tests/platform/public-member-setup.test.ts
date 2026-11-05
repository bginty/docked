import test from "node:test";
import assert from "node:assert/strict";
import { publicMemberSetupConfiguration } from "../../src/core/public-member-setup";

test("existing-member setup is independently opt-in and cannot inherit beta consent IDs", () => {
  const env = {
    DOCKED_BETA_STAGING: "true",
    REGISTRATION_ENABLED: "false",
    DOCKED_PUBLIC_CUSTOMERS: "false",
    DOCKED_COMMERCIAL_CHECKOUT: "false",
    DOCKED_PUBLIC_MEMBER_SETUP: "true",
    DOCKED_PUBLIC_MEMBER_SETUP_POLICY_APPROVED: "true",
    LEGAL_ENTITY_VERIFIED: "true",
    DOCKED_PUBLIC_TERMS_VERSION: "reviewed-public-terms-v2",
    DOCKED_PUBLIC_PRIVACY_VERSION: "reviewed-public-privacy-v2",
    TERMS_VERSION: "legacy-beta-v1",
    PRIVACY_POLICY_VERSION: "legacy-beta-v1",
  };
  const before = { ...env };
  assert.deepEqual(publicMemberSetupConfiguration(env), {
    versions: {
      terms: "reviewed-public-terms-v2",
      privacy: "reviewed-public-privacy-v2",
    },
    termsHref: "/commercial-policy",
    privacyHref: "/privacy",
  });
  assert.deepEqual(env, before);
  for (const missing of [
    "DOCKED_PUBLIC_MEMBER_SETUP",
    "DOCKED_PUBLIC_MEMBER_SETUP_POLICY_APPROVED",
    "LEGAL_ENTITY_VERIFIED",
    "DOCKED_PUBLIC_TERMS_VERSION",
    "DOCKED_PUBLIC_PRIVACY_VERSION",
  ])
    assert.equal(
      publicMemberSetupConfiguration({ ...env, [missing]: undefined }),
      null,
    );
  assert.equal(
    publicMemberSetupConfiguration({ ...env, LEGAL_ENTITY_VERIFIED: "false" }),
    null,
  );
  assert.equal(
    publicMemberSetupConfiguration({
      ...env,
      DOCKED_PUBLIC_TERMS_VERSION: "draft-next",
    }),
    null,
  );
});
