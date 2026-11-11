import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const v31BaselineCommit = "f1b50b6f51d7429a36df9a8d5db99aed8886bd44";
export const v31BaselineRuntimeDigest =
  "893b568f0f3e4b142cd5bff0bdaa5255d237388e7277ff0fabe0b498df5f1501";
export const v31ClosedFlags = [
  "REGISTRATION_ENABLED",
  "COMPETITIONS_ENABLED",
  "PRIZES_ENABLED",
  "DOCKED_MULTI_SPORT_SANDBOX",
  "DOCKED_MEMBER_GOOGLE_TEST",
  "DOCKED_COMMERCIAL_SERVICE",
  "DOCKED_COMMERCIAL_SURFACES",
  "DOCKED_COMMERCIAL_CHECKOUT",
  "DOCKED_PUBLIC_CUSTOMERS",
];

// Preserve the complete authenticated baseline recipe, including the existing
// member-setup database and published consent references. Never log its values.
export function dormantV31Runtime(runtime, live, expectedDigest) {
  assert.equal(live.id, "dpl_9bwmvDvt5AEszaBtR311MjHLpHg7");
  assert.equal(live.meta.githubCommitSha, v31BaselineCommit);
  assert.equal(live.projectId, "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST");
  assert.equal(
    createHash("sha256").update(JSON.stringify(runtime)).digest("hex"),
    expectedDigest,
    "Baseline runtime bytes changed",
  );
  assert.equal(runtime.VERCEL_GIT_COMMIT_SHA, v31BaselineCommit);
  for (const key of v31ClosedFlags) assert.equal(runtime[key], "false", key);
  for (const key of [
    "DOCKED_BILLING_OPS_SIGNALS",
    "DOCKED_BILLING_OPS_ALERTS",
    "DOCKED_PUBLIC_PHONE_OTP",
    "DOCKED_ISOLATED_PHONE_TEST",
  ])
    assert(
      !runtime[key] || runtime[key] === "false",
      "Unexpected active gate: " + key,
    );
  assert(
    live.env
      .filter((k) => /^(DOCKED_|NFL_|BETA_|FANTASY_|PROVIDER_)/.test(k))
      .every((k) => Object.hasOwn(runtime, k)),
    "Baseline recipe omits a current runtime setting",
  );
  assert(
    runtime.DOCKED_PUBLIC_MEMBER_SETUP_DATABASE_URL,
    "Existing member-setup connection missing",
  );
  assert.equal(
    runtime.DOCKED_PUBLIC_TERMS_VERSION,
    "2026-11-02-release-preparation-v2",
  );
  assert.equal(
    runtime.DOCKED_PUBLIC_PRIVACY_VERSION,
    "2026-11-06-privacy-sdk-v3",
  );
  return {
    ...runtime,
    REGISTRATION_ENABLED: "false",
    DOCKED_PUBLIC_PHONE_OTP: "false",
    DOCKED_ISOLATED_PHONE_TEST: "false",
  };
}
