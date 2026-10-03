import test from "node:test";
import assert from "node:assert/strict";
import { appAuthCallbackDestination } from "../../src/core/app-auth";

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
