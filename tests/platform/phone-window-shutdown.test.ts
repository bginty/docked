import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePhoneWindow,
  watchPhoneWindow,
} from "../../scripts/lib/phone-window-shutdown.mjs";

const start = Date.parse("2026-11-17T00:00:00Z");
const plan = {
  schemaVersion: 1,
  projectRef: "bckkllmndoxzpzdqrevb",
  organizationId: "ernfnkcbalhyqpsrzdwa",
  sourceCommit: "7".repeat(40),
  memberSetSha256: "a".repeat(64),
  startsAt: new Date(start).toISOString(),
  until: new Date(start + 30000).toISOString(),
  maximumAttempts: 6,
  maximumSegments: 20,
  maximumAud: 5,
  cumulativeMaximumAud: 20,
  attended: true,
  signupEnabled: false,
};
const safe = {
  disable_signup: true,
  sms_autoconfirm: false,
  sms_otp_length: 6,
  sms_otp_exp: 300,
  sms_max_frequency: 60,
  rate_limit_sms_sent: 6,
  sms_test_otp: "",
  external_phone_enabled: false,
};
function fixture() {
  let time = start;
  const config = { ...safe };
  const patches: unknown[] = [];
  return {
    patches,
    enable: () => {
      config.external_phone_enabled = true;
    },
    unsafe: () => {
      config.disable_signup = false;
    },
    api: {
      project: async () => ({
        id: plan.projectRef,
        organization_id: plan.organizationId,
        status: "ACTIVE_HEALTHY",
      }),
      config: async () => ({ ...config }),
      disable: async (_: string, payload: typeof safe) => {
        patches.push(payload);
        Object.assign(config, payload);
      },
    },
    options: {
      now: () => time,
      wait: async (ms: number) => {
        time += ms;
      },
    },
  };
}
test("phone window rejects wrong project/org, stale start, excess time/budget and signup", () => {
  for (const delta of [
    { projectRef: "foreign" },
    { organizationId: "foreign" },
    { startsAt: new Date(start - 300001).toISOString() },
    { until: new Date(start + 7200001).toISOString() },
    { until: new Date(start).toISOString() },
    { maximumAttempts: 7 },
    { maximumAud: 6 },
    { attended: false },
    { signupEnabled: true },
  ]) {
    assert.throws(() => validatePhoneWindow({ ...plan, ...delta }, start));
  }
});
test("expiry disables and verifies only the exact provider flag", async () => {
  const f = fixture();
  const result = await watchPhoneWindow(plan, f.api, {
    ...f.options,
    onReady: f.enable,
  });
  assert.equal(result.closureVerified, true);
  assert.equal(result.reason, "expiry");
  assert.deepEqual(f.patches, [{ external_phone_enabled: false }]);
});
test("manual stop closes early without sending or enabling", async () => {
  const f = fixture();
  const result = await watchPhoneWindow(plan, f.api, {
    ...f.options,
    onReady: f.enable,
    stopRequested: () => true,
  });
  assert.equal(result.reason, "manual-stop");
  assert.equal(result.enabledProvider, false);
  assert.equal(result.smsSent, 0);
  assert.deepEqual(f.patches, [{ external_phone_enabled: false }]);
});
test("unsafe signup drift closes Phone but never changes signup or credentials", async () => {
  const f = fixture();
  const result = await watchPhoneWindow(plan, f.api, {
    ...f.options,
    onReady: () => {
      f.enable();
      f.unsafe();
    },
  });
  assert.equal(result.safetyFailure, true);
  assert.equal(result.closureVerified, true);
  assert.deepEqual(f.patches, [{ external_phone_enabled: false }]);
});
test("wrong remote project prevents every mutation", async () => {
  const f = fixture();
  f.api.project = async () => ({
    id: "foreign",
    organization_id: plan.organizationId,
    status: "ACTIVE_HEALTHY",
  });
  await assert.rejects(watchPhoneWindow(plan, f.api, f.options));
  assert.equal(f.patches.length, 0);
});
test("failed provider shutdown is retried then reported unverified", async () => {
  const f = fixture();
  f.api.disable = async () => {
    f.patches.push("failed");
    throw Error("offline");
  };
  await assert.rejects(
    watchPhoneWindow(plan, f.api, f.options),
    /PHONE_CLOSURE_UNVERIFIED/,
  );
  assert.equal(f.patches.length, 3);
});
