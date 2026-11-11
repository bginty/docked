import test from "node:test";
import assert from "node:assert/strict";
import {
  executePhoneChallenge,
  publicPhoneErrorMessage,
} from "../../src/core/phone-challenge";
import { normalizedPhone } from "../../src/core/public-phone";
const request = {
  action: "verify" as const,
  phone: "0400000001",
  token: "123456",
};
const base = () => ({
  updateUser: async () => ({ error: null }),
  verifyOtp: async (_value: {
    phone: string;
    token: string;
    type: "phone_change";
  }) => ({ error: null }),
  getUser: async () => ({
    error: null,
    data: {
      user: {
        id: "member",
        phone: "61400000001",
        phone_confirmed_at: "2026-01-01",
      },
    },
  }),
});
test("challenge uses user-session phone_change and fresh same-member provider confirmation", async () => {
  const auth = base();
  let observed: unknown;
  auth.verifyOtp = async (v) => {
    observed = v;
    return { error: null };
  };
  assert.deepEqual(await executePhoneChallenge(request, "member", auth), {
    ok: true,
    verified: true,
  });
  assert.deepEqual(observed, {
    phone: "+61400000001",
    type: "phone_change",
    token: "123456",
  });
});
test("provider rejection, outage and expired/wrong code never expose raw provider data", async () => {
  for (const action of ["send", "verify"] as const) {
    const auth = base();
    auth.updateUser = auth.verifyOtp = async () => {
      throw Error("secret provider phone/token diagnostic");
    };
    await assert.rejects(
      executePhoneChallenge({ ...request, action }, "member", auth),
      (e) =>
        e instanceof Error &&
        !e.message.includes("secret") &&
        e.message.includes(
          action === "send" ? "Unable to send" : "could not be verified",
        ),
    );
  }
});
test("successful OTP response alone cannot prove identity, number or confirmed timestamp", async () => {
  for (const user of [
    { id: "other", phone: "61400000001", phone_confirmed_at: "2026-01-01" },
    { id: "member", phone: "61400000002", phone_confirmed_at: "2026-01-01" },
    { id: "member", phone: "61400000001", phone_confirmed_at: "" },
  ]) {
    const auth = base();
    auth.getUser = async () => ({ error: null, data: { user } });
    await assert.rejects(
      executePhoneChallenge(request, "member", auth),
      /did not complete/,
    );
  }
});

test("invalid Australian number and resend cooldown retain actionable public guidance", () => {
  let invalidNumber: unknown;
  try {
    normalizedPhone("+14155550123");
  } catch (error) {
    invalidNumber = error;
  }
  assert.equal(
    publicPhoneErrorMessage(invalidNumber),
    "Enter an Australian mobile number, starting with 04 or +614.",
  );
  assert.equal(
    publicPhoneErrorMessage(
      Error("Please wait one minute before requesting another code."),
    ),
    "Please wait one minute before requesting another code.",
  );
});

test("phone API cannot expose raw diagnostics merely because they start with a public prefix", () => {
  for (const error of [
    Error("Authentication required"),
    Error("Privileged MFA required"),
    Error("Unable to send a code. provider token=secret phone=+61400000001"),
    Error("Phone verification failed: token=123456"),
    Error("Too many attempts: raw request contains a phone number"),
    { message: "Please wait one minute before requesting another code." },
    null,
  ]) {
    assert.equal(
      publicPhoneErrorMessage(error),
      "Unable to verify your phone. Please sign in again or contact support.",
    );
  }
});
