import { test } from "node:test";
import assert from "node:assert/strict";
import { validateOwnerQaManifest } from "../../scripts/android-owner-qa-config.mjs";
import { resolveAndroidTarget } from "../../scripts/android-preview-config.mjs";
test("connected owner QA pins protected Preview without privileged credentials", () => {
  const m = {
    schemaVersion: 1,
    kind: "docked-android-owner-qa",
    environment: "protected-preview",
    applicationId: "au.com.docked.app.preview",
    supabaseProjectRef: "pojoymtniryarxxunyvz",
    projectId: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
    teamId: "team_tf6xweKKyVCj9bTppUKttJ4l",
    origin: "https://docked-production-fixture-briant-s-projects.vercel.app",
    deploymentId: "dpl_fixture",
    commit: "a".repeat(40),
    verifiedAt: new Date().toISOString(),
    ownerOnly: true,
    protected: true,
    externalAdmission: false,
    registration: false,
    payments: false,
    physicalAcceptance: "PENDING",
  };
  const clean = validateOwnerQaManifest({ ...m, secret: "must not ship" });
  assert.equal("secret" in clean, false);
  const target = resolveAndroidTarget(
    { CAPACITOR_PREVIEW_MODE: "hosted", CAPACITOR_OWNER_QA: "true" },
    () => JSON.stringify(m),
  );
  assert.equal(target.entryUrl, m.origin + "/app");
  assert.equal(target.inspect, false);
  assert.equal(target.cleartext, false);
  for (const change of [
    { origin: "https://docked.com.au" },
    { supabaseProjectRef: "bckkllmndoxzpzdqrevb" },
    { ownerOnly: false },
    { protected: false },
    { registration: true },
    { externalAdmission: true },
    { payments: true },
    { physicalAcceptance: "PASS" },
    { verifiedAt: "2020-01-01" },
  ])
    assert.throws(() => validateOwnerQaManifest({ ...m, ...change }));
  assert.throws(() =>
    resolveAndroidTarget(
      {
        CAPACITOR_PREVIEW_MODE: "hosted",
        CAPACITOR_OWNER_QA: "true",
        CAPACITOR_PREVIEW_DEBUGGING: "1",
      },
      () => JSON.stringify(m),
    ),
  );
});
