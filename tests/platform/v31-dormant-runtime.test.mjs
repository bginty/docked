import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  dormantV31Runtime,
  v31BaselineCommit,
  v31ClosedFlags,
} from "../../scripts/lib/v31-dormant-runtime.mjs";
const hash = (x) =>
  createHash("sha256").update(JSON.stringify(x)).digest("hex");
const fixture = () => ({
  ...Object.fromEntries(v31ClosedFlags.map((k) => [k, "false"])),
  VERCEL_GIT_COMMIT_SHA: v31BaselineCommit,
  DOCKED_PUBLIC_MEMBER_SETUP: "true",
  DOCKED_PUBLIC_MEMBER_SETUP_POLICY_APPROVED: "true",
  DOCKED_PUBLIC_MEMBER_SETUP_DATABASE_URL: "synthetic-private-connection",
  DOCKED_PUBLIC_TERMS_VERSION: "2026-11-02-release-preparation-v2",
  DOCKED_PUBLIC_PRIVACY_VERSION: "2026-11-06-privacy-sdk-v3",
});
const live = (r) => ({
  id: "dpl_9bwmvDvt5AEszaBtR311MjHLpHg7",
  projectId: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
  meta: { githubCommitSha: v31BaselineCommit },
  env: Object.keys(r),
});
test("preserves existing-account setup and consent while explicitly closing phone gates", () => {
  const r = fixture(),
    before = structuredClone(r),
    result = dormantV31Runtime(r, live(r), hash(r));
  assert.deepEqual(r, before);
  assert.deepEqual(result, {
    ...r,
    DOCKED_PUBLIC_PHONE_OTP: "false",
    DOCKED_ISOLATED_PHONE_TEST: "false",
  });
});
test("rejects omitted baseline settings, altered recipe, wrong target and open gates", () => {
  const r = fixture(),
    d = hash(r),
    target = live(r);
  assert.throws(() =>
    dormantV31Runtime(
      { ...r, DOCKED_PUBLIC_MEMBER_SETUP_DATABASE_URL: "changed" },
      target,
      d,
    ),
  );
  assert.throws(() =>
    dormantV31Runtime(
      r,
      { ...target, env: [...target.env, "DOCKED_UNREVIEWED_SETTING"] },
      d,
    ),
  );
  assert.throws(() =>
    dormantV31Runtime(r, { ...target, id: "different-deployment" }, d),
  );
  for (const key of [
    ...v31ClosedFlags,
    "DOCKED_BILLING_OPS_ALERTS",
    "DOCKED_PUBLIC_PHONE_OTP",
  ]) {
    const changed = { ...r, [key]: "true" };
    assert.throws(
      () => dormantV31Runtime(changed, live(changed), hash(changed)),
      key,
    );
  }
});
