import test from "node:test";
import assert from "node:assert/strict";
import {
  appAuthCallbackDestination,
  isPendingEmailChange,
} from "../../src/core/app-auth";

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
