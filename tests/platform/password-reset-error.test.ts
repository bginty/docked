import { test } from "node:test";
import assert from "node:assert/strict";
import { passwordResetFailure } from "../../src/core/auth-policy";

test("actual recovery MFA denial asks for existing factor without replacing the email/session", () => {
  const message = passwordResetFailure({ code: "insufficient_aal" });
  assert.match(message, /existing authenticator at \/mfa/);
  assert.match(message, /do not need another recovery email/);
  assert.doesNotMatch(message, /invalid|expired|enrol/i);
});
test("password policy failures do not falsely expire a valid recovery session", () => {
  assert.match(passwordResetFailure({ code: "same_password" }), /different/);
  assert.match(passwordResetFailure({ code: "weak_password" }), /stronger/);
});
test("unclassified provider failures remain unconfirmed and do not expose raw details", () => {
  assert.match(
    passwordResetFailure({ code: "unexpected_failure" }),
    /not confirmed/,
  );
  assert.match(
    passwordResetFailure({ name: "AuthSessionMissingError" }),
    /session is unavailable/,
  );
  assert.doesNotMatch(
    passwordResetFailure({ code: "unexpected_failure" }),
    /expired|unexpected_failure/,
  );
});
