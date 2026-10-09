import { test } from "node:test";
import assert from "node:assert/strict";
import {
  previewSignupSchema,
  signupUsername,
  previewCapabilitySet,
  appOnboardingSchema,
  requirePreviewEnvironment,
} from "../../src/core/preview-testers";
import {
  isEmailOwnershipVerified,
  staffAllowed,
  verifiedSessionClaims,
  conclusiveAuthFailure,
} from "../../src/core/auth-policy";

test("authentication outages remain unknown while expired or revoked sessions fail closed", () => {
  for (const error of [
    { name: "AuthRetryableFetchError", status: 503 },
    { name: "AuthApiError", status: 500 },
    { name: "AuthApiError", status: 429 },
    new TypeError("network"),
    { name: "AuthApiError", status: 400, code: "unexpected_failure" },
  ])
    assert.equal(conclusiveAuthFailure(error), false);
  for (const error of [
    { name: "AuthApiError", status: 401 },
    { name: "AuthApiError", status: 403 },
    { name: "AuthSessionMissingError", status: 400 },
    { name: "AuthApiError", status: 400, code: "refresh_token_not_found" },
  ])
    assert.equal(conclusiveAuthFailure(error), true);
});
test("invitation signup requires separate legal acceptances, reserved-safe username and defaults marketing off", () => {
  const form = {
    email: "qa@example.invalid",
    password: "fictional-password-only",
    username: "preview_reader",
    invitationCode: "a".repeat(43),
    country: "AU",
    state: "NSW",
    age: true,
    terms: true,
    privacy: true,
  };
  assert.equal(previewSignupSchema.parse(form).marketing, false);
  for (const key of ["age", "terms", "privacy"])
    assert.equal(
      previewSignupSchema.safeParse({ ...form, [key]: false }).success,
      false,
    );
  for (const value of [
    "docked",
    "Docked Admin",
    "../docked",
    "ab",
    "name@site",
  ])
    assert.equal(signupUsername.safeParse(value).success, false);
  assert.equal(
    previewSignupSchema.safeParse({ ...form, invitationCode: "guess" }).success,
    false,
  );
});
test("capabilities are explicit, unique and cannot become genuine features or production privileges", () => {
  assert.equal(
    previewCapabilitySet.safeParse(["community_social", "public_profiles"])
      .success,
    true,
  );
  for (const extra of [
    "preview_market_fixtures",
    "preview_top_docked",
    "leaderboards",
    "community_edges",
    "admin",
    "community_social",
  ])
    assert.equal(
      previewCapabilitySet.safeParse([
        "community_social",
        "public_profiles",
        extra,
      ]).success,
      false,
    );
  assert.throws(() =>
    requirePreviewEnvironment({
      APP_ENV: "production",
      DOCKED_HOSTED_PREVIEW: "false",
    }),
  );
});
test("onboarding canonicalizes selected sports without duplicating choices or fabricating legal consent", () => {
  const result = appOnboardingSchema.parse({
    sports: ["nba", "racing"],
    interests: "both",
    officialEdges: false,
    followedMembers: true,
    replies: true,
    timezone: "Australia/Sydney",
  });
  assert.deepEqual(result.sports, ["basketball", "horse-racing"]);
  assert.equal(result.age, undefined);
  assert.equal(result.privacy, undefined);
  assert.equal(
    appOnboardingSchema.safeParse({ ...result, sports: ["nba", "basketball"] })
      .success,
    false,
  );
});
test("administrator confirmation never counts as proof of email ownership; legacy staff/session exports remain intact", () => {
  const confirmed = { email_confirmed_at: "2026-10-03T00:00:00Z" };
  assert.equal(isEmailOwnershipVerified(confirmed), true);
  assert.equal(
    isEmailOwnershipVerified({
      ...confirmed,
      app_metadata: { email_ownership_verified: false },
    }),
    false,
  );
  assert.equal(
    isEmailOwnershipVerified({
      ...confirmed,
      app_metadata: { preview_invitation_confirmed: true },
    }),
    false,
  );
  assert.equal(
    isEmailOwnershipVerified({
      app_metadata: { email_ownership_verified: true },
    }),
    false,
  );
  assert.equal(staffAllowed("auditor", "aal2", "publish"), false);
  assert.equal(verifiedSessionClaims("bad", "unknown"), null);
});
