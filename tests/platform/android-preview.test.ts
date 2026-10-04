import test from "node:test";
import assert from "node:assert/strict";
import {
  validatePreviewManifest,
  resolveAndroidTarget,
} from "../../scripts/android-preview-config.mjs";
import { renderOfflineShell } from "../../scripts/build-mobile-shell.mjs";

const now = Date.parse("2026-10-03T12:00:00Z");
// In-memory test receipt only. Never written to the actual deployment config.
const manifest = {
  schemaVersion: 1,
  kind: "docked-android-preview",
  environment: "preview",
  origin: "https://preview.example.test",
  supabaseProjectRef: "bckkllmndoxzpzdqrevb",
  applicationId: "au.com.docked.app.preview",
  deploymentId: "fixture_only_123",
  verifiedAt: new Date(now - 60_000).toISOString(),
  safety: {
    emailSending: false,
    pushSending: false,
    billing: false,
    competitions: false,
    prizes: false,
    deals: false,
    affiliates: false,
    forwardPaper: false,
    productionSupabaseAllowed: false,
    oddsProviderStatus: "NOT_CONFIGURED",
    resultsProviderStatus: "NOT_CONFIGURED",
    strategyStatus: "UNVALIDATED",
  },
};
test("hosted Android config binds one approved origin and whitelists only public metadata", () => {
  const safe = validatePreviewManifest(
    { ...manifest, unexpectedSecret: "must-not-be-copied" },
    now,
  );
  assert.equal(safe.origin, manifest.origin);
  assert.equal("unexpectedSecret" in safe, false);
  const target = resolveAndroidTarget(
    { CAPACITOR_PREVIEW_MODE: "hosted" },
    () => JSON.stringify(manifest),
    now,
  );
  assert.equal(target.entryUrl, `${manifest.origin}/app`);
  assert.equal(target.inspect, false);
  assert.equal(target.cleartext, false);
  const html = renderOfflineShell(target);
  assert.ok(html.includes(`${manifest.origin}/app`));
  assert.doesNotMatch(
    html.replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, "approved-image"),
    /localhost|ADB|reverse port|Connect the reviewed preview/,
  );
  assert.match(html, /window\.addEventListener\("online", reconnect\)/);
});
test("hosted Android build fails closed without current preview identity and disabled services", () => {
  for (const change of [
    { origin: "http://preview.example.test" },
    { origin: "https://docked.com.au" },
    { origin: "https://preview.docked.com.au" },
    { origin: "https://preview.example.test/" },
    { origin: "https://preview.example.test:444" },
    { origin: "https://user:pass@preview.example.test" },
    { origin: "https://preview.example.test/?token=private" },
    { supabaseProjectRef: "unrelated-project" },
    { applicationId: "au.com.docked.app" },
    { environment: "production" },
    { verifiedAt: new Date(now - 86_400_001).toISOString() },
    { verifiedAt: new Date(now + 120_000).toISOString() },
    { safety: { ...manifest.safety, billing: true } },
    { safety: { ...manifest.safety, productionSupabaseAllowed: true } },
  ])
    assert.throws(() =>
      validatePreviewManifest({ ...manifest, ...change }, now),
    );
  assert.throws(() =>
    resolveAndroidTarget(
      { CAPACITOR_PREVIEW_MODE: "hosted" },
      () => {
        throw new Error("missing");
      },
      now,
    ),
  );
  assert.throws(() =>
    resolveAndroidTarget({
      CAPACITOR_PREVIEW_MODE: "hosted",
      CAPACITOR_PREVIEW_DEBUGGING: "1",
    }),
  );
  assert.throws(() =>
    resolveAndroidTarget({
      CAPACITOR_PREVIEW_MODE: "hosted",
      CAPACITOR_PREVIEW_SERVER: "https://arbitrary.example.test",
    }),
  );
  assert.equal(
    resolveAndroidTarget({
      CAPACITOR_PREVIEW_MODE: "local",
      CAPACITOR_PREVIEW_DEBUGGING: "1",
    }).entryUrl,
    "http://localhost:3000/app",
  );
});

test("a stored pending-rights provider requires explicit non-polling and publication-off proof", () => {
  const pending = {
    ...manifest,
    safety: {
      ...manifest.safety,
      oddsProviderStatus: "PENDING_RIGHTS",
      providerPolling: false,
      publication: false,
    },
  };
  assert.equal(validatePreviewManifest(pending, now).origin, manifest.origin);
  for (const gate of ["providerPolling", "publication"] as const) {
    for (const value of [undefined, null, true, "false"]) {
      assert.throws(() =>
        validatePreviewManifest(
          { ...pending, safety: { ...pending.safety, [gate]: value } },
          now,
        ),
      );
    }
    assert.throws(() =>
      validatePreviewManifest(
        { ...manifest, safety: { ...manifest.safety, [gate]: true } },
        now,
      ),
    );
  }
  for (const oddsProviderStatus of [
    "READY",
    "CONFIGURED",
    "ACTIVE",
    "UNKNOWN",
    "",
  ]) {
    assert.throws(() =>
      validatePreviewManifest(
        { ...pending, safety: { ...pending.safety, oddsProviderStatus } },
        now,
      ),
    );
  }
  assert.throws(() =>
    validatePreviewManifest(
      { ...pending, safety: { ...pending.safety, forwardPaper: true } },
      now,
    ),
  );
  assert.throws(() =>
    validatePreviewManifest(
      {
        ...pending,
        safety: { ...pending.safety, resultsProviderStatus: "READY" },
      },
      now,
    ),
  );
});
