import test from "node:test";
import assert from "node:assert/strict";
import {
  appAuthCallbackDestination,
  isPendingEmailChange,
  appSports,
} from "../../src/core/app-auth";
import { appOnboardingSchema } from "../../src/core/preview-testers";
import {
  publicCustomersEnabled,
  isPublicSport,
} from "../../src/core/public-customer";

test("public launch preferences accept all visible sports without advertising hidden catalogues", () => {
  assert.deepEqual(appSports, [
    ["nfl", "NFL"],
    ["afl", "AFL"],
    ["nrl", "NRL"],
  ]);
  const parsed = appOnboardingSchema.parse({
    sports: appSports.map(([id]) => id),
    interests: "both",
    followedMembers: false,
    replies: false,
    timezone: "Australia/Sydney",
  });
  assert.deepEqual(parsed.sports, ["nfl", "afl", "nrl"]);
  assert.equal(publicCustomersEnabled({}), false);
  assert.equal(
    publicCustomersEnabled({
      DOCKED_PUBLIC_CUSTOMERS: "true",
      DOCKED_BETA_STAGING: "true",
    }),
    false,
  );
  assert.equal(
    publicCustomersEnabled({ DOCKED_PUBLIC_CUSTOMERS: "true" }),
    true,
  );
  for (const sport of ["basketball", "nba", "nbl", "football"])
    assert.equal(isPublicSport(sport), false);
});

test("intermediate email change selects instructions only, never code or error responses", () => {
  const params = new URLSearchParams({
    message:
      "Confirmation link accepted. Please proceed to confirm link sent to the other email",
  });
  assert.equal(isPendingEmailChange(params), true);
  for (const field of ["code", "error", "error_code"]) {
    const conflicting = new URLSearchParams(params);
    conflicting.set(field, "");
    assert.equal(isPendingEmailChange(conflicting), false);
  }
  assert.equal(
    isPendingEmailChange(new URLSearchParams("message=verified")),
    false,
  );
});

test("authentication callbacks retain only reviewed app and legacy destinations", () => {
  for (const path of [
    "/app/reset-password",
    "/app/verified",
    "/reset-password",
  ])
    assert.equal(appAuthCallbackDestination(path), path);
  for (const path of [
    null,
    "https://attacker.invalid/",
    "//attacker.invalid",
    "/app/verified?next=https://attacker.invalid",
    "/app/../admin",
    "/admin",
    "/app/reset-password#token",
  ])
    assert.equal(appAuthCallbackDestination(path), "/dashboard");
});
