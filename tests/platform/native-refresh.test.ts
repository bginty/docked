import test from "node:test";
import assert from "node:assert/strict";
import { nativeRefreshAllowed } from "../../src/core/native-navigation";

test("initial and duplicate native connected notifications do not reload a page", () => {
  assert.equal(
    nativeRefreshAllowed("/fantasy/play", "network", undefined, true),
    false,
  );
  assert.equal(
    nativeRefreshAllowed("/fantasy/play", "network", true, true),
    false,
  );
  assert.equal(
    nativeRefreshAllowed("/fantasy/play", "network", false, false),
    false,
  );
  assert.equal(
    nativeRefreshAllowed("/fantasy/play", "network", false, true),
    true,
  );
  assert.equal(nativeRefreshAllowed("/fantasy/play", "resume"), true);
});

test("native resume and reconnection preserve authentication forms and MFA", () => {
  for (const path of [
    "/app/login",
    "/app/signup",
    "/app/reset-password",
    "/app/onboarding",
    "/mfa",
  ]) {
    assert.equal(nativeRefreshAllowed(path, "resume"), false, path);
    assert.equal(
      nativeRefreshAllowed(path, "network", false, true),
      false,
      path,
    );
  }
});
