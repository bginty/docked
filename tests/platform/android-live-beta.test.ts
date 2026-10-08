import test from "node:test";
import assert from "node:assert/strict";
import {
  validateLiveBetaManifest,
  verifyCurrentBetaHost,
} from "../../scripts/android-live-beta-config.mjs";
import { resolveAndroidTarget } from "../../scripts/android-preview-config.mjs";
import { assertDebugAssets } from "../../scripts/verify-android-debug-assets.mjs";

const now = Date.parse("2026-10-09T00:00:00Z");
test("debug packaging refuses assets left by beta or hosted Preview sync", () => {
  assert.throws(() =>
    assertDebugAssets({ server: { url: "https://docked.com.au/app" } }, null),
  );
  assert.throws(() =>
    assertDebugAssets(
      { server: { url: "https://preview.example.test/app" } },
      null,
    ),
  );
  assert.throws(() =>
    assertDebugAssets({ server: {} }, { environment: "production-beta" }),
  );
  assert.doesNotThrow(() =>
    assertDebugAssets(
      {
        server: { url: "http://localhost:3000/app" },
        android: { webContentsDebuggingEnabled: true },
      },
      null,
    ),
  );
  assert.doesNotThrow(() =>
    assertDebugAssets(
      { server: {}, android: { webContentsDebuggingEnabled: false } },
      null,
    ),
  );
});
// In-memory fixture only; never an actual acceptance receipt.
const receipt = {
  schemaVersion: 1,
  kind: "docked-android-live-beta",
  environment: "production-beta",
  origin: "https://docked.com.au",
  applicationId: "au.com.docked.app.beta",
  supabaseProjectRef: "pojoymtniryarxxunyvz",
  netlifySiteId: "2292ba6e-7073-4804-b69a-26b41c9a9fb1",
  deploymentId: "a".repeat(24),
  commit: "b".repeat(40),
  verifiedAt: new Date(now - 1000).toISOString(),
  acceptance: {
    https: true,
    invitedAuthentication: true,
    emailRecovery: true,
    gameplay: true,
    rls: true,
    policy: true,
    betaRecordIsolation: true,
    administratorMfa: true,
  },
  safety: {
    publicRegistration: false,
    payments: false,
    marketplace: false,
    officialBettingPublication: false,
  },
};
test("Android beta selects the exact live backend and a separate package without copying extra fields", () => {
  const value = validateLiveBetaManifest(
    { ...receipt, secret: "never-copy" },
    now,
  );
  assert.equal("secret" in value, false);
  const target = resolveAndroidTarget(
    { CAPACITOR_LIVE_BETA: "true" },
    () => JSON.stringify(receipt),
    now,
  );
  assert.equal(target.entryUrl, "https://docked.com.au/app");
  assert.equal(target.manifest?.applicationId, "au.com.docked.app.beta");
  assert.equal(target.inspect, false);
  assert.equal(target.cleartext, false);
});
test("Android beta rechecks the live deployment and rejects rollout or registration drift", async () => {
  const expected = {
    channel: "beta",
    origin: receipt.origin,
    projectRef: receipt.supabaseProjectRef,
    siteId: receipt.netlifySiteId,
    commit: receipt.commit,
    deploymentId: receipt.deploymentId,
    publicRegistration: false,
    invitedAuthentication: true,
  };
  const response =
    (change = {}) =>
    async () =>
      new Response(JSON.stringify({ ...expected, ...change }), {
        headers: { "cache-control": "no-store" },
      });
  await verifyCurrentBetaHost(receipt, response());
  for (const change of [
    { deploymentId: "c".repeat(24) },
    { commit: "d".repeat(40) },
    { publicRegistration: true },
    { invitedAuthentication: false },
    { channel: "stable" },
  ])
    await assert.rejects(() =>
      verifyCurrentBetaHost(receipt, response(change)),
    );
  await assert.rejects(() =>
    verifyCurrentBetaHost(receipt, async () => new Response("holding")),
  );
  await assert.rejects(() =>
    verifyCurrentBetaHost(receipt, async () => {
      throw Error("offline");
    }),
  );
});
test("Android beta refuses failed, stale, unrelated or public registration receipts", () => {
  for (const key of Object.keys(receipt.acceptance))
    assert.throws(() =>
      validateLiveBetaManifest(
        { ...receipt, acceptance: { ...receipt.acceptance, [key]: false } },
        now,
      ),
    );
  for (const key of Object.keys(receipt.safety))
    assert.throws(() =>
      validateLiveBetaManifest(
        { ...receipt, safety: { ...receipt.safety, [key]: true } },
        now,
      ),
    );
  for (const change of [
    { origin: "https://docked-production.netlify.app" },
    { origin: "http://docked.com.au" },
    { supabaseProjectRef: "bckkllmndoxzpzdqrevb" },
    { applicationId: "au.com.docked.app.preview" },
    { deploymentId: "holding" },
    { verifiedAt: new Date(now - 86400001).toISOString() },
  ])
    assert.throws(() =>
      validateLiveBetaManifest({ ...receipt, ...change }, now),
    );
});
test("Android beta cannot fall back to preview, localhost or inspection", () => {
  for (const change of [
    { CAPACITOR_PREVIEW_MODE: "hosted" },
    { CAPACITOR_PREVIEW_MODE: "local" },
    { CAPACITOR_PREVIEW_SERVER: "http://localhost:3000" },
    { CAPACITOR_PREVIEW_DEBUGGING: "1" },
  ])
    assert.throws(() =>
      resolveAndroidTarget(
        { CAPACITOR_LIVE_BETA: "true", ...change },
        () => JSON.stringify(receipt),
        now,
      ),
    );
  assert.throws(() =>
    resolveAndroidTarget(
      { CAPACITOR_LIVE_BETA: "true" },
      () => {
        throw Error("Missing receipt");
      },
      now,
    ),
  );
  assert.throws(() =>
    resolveAndroidTarget(
      { CAPACITOR_PREVIEW_MODE: "hosted" },
      () => JSON.stringify(receipt),
      now,
    ),
  );
});
