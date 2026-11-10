import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizedPhone,
  phoneDeliveryReady,
  verifiedPhone,
} from "../../src/core/public-phone";
import { mfaDestination } from "../../src/core/mfa-flow";
import { nativeDeepLink } from "../../src/core/native-navigation";
test("phone evidence must come from confirmed Auth fields, never a typed number", () => {
  assert.equal(verifiedPhone({ phone: "61400000001" }), false);
  assert.equal(
    verifiedPhone(
      { phone: "61400000001", phone_confirmed_at: "2026-01-01T00:00:00Z" },
      Date.parse("2026-02-01"),
    ),
    true,
  );
  assert.equal(
    verifiedPhone({ phone: "61400000001", phone_confirmed_at: "2099-01-01" }),
    false,
  );
  assert.equal(
    verifiedPhone({ phone: "invalid", phone_confirmed_at: "2026-01-01" }),
    false,
  );
  assert.equal(normalizedPhone("+61 (400) 000-001"), "+61400000001");
  assert.throws(() => normalizedPhone("0400000001"));
});
test("SMS cannot send before public/OTP/policy configuration; beta unchanged", () => {
  const env = {
    DOCKED_PUBLIC_CUSTOMERS: "true",
    DOCKED_PUBLIC_PHONE_OTP: "true",
    DOCKED_PUBLIC_PHONE_POLICY_REFERENCE: "Approved isolated policy reference",
  };
  assert.equal(phoneDeliveryReady(env), true);
  for (const key of Object.keys(env))
    assert.equal(phoneDeliveryReady({ ...env, [key]: "" }), false);
  assert.equal(
    phoneDeliveryReady({ ...env, DOCKED_BETA_STAGING: "true" }),
    false,
  );
  assert.equal(mfaDestination("/app/verify-phone"), "/app/verify-phone");
  assert.equal(
    nativeDeepLink("docked://app/verify-phone"),
    "/app/verify-phone",
  );
});
