import { test } from "node:test";
import assert from "node:assert/strict";
import { schedulePreviewInAppBatch } from "../../src/core/preview-maintenance";
import { hostedPreviewDisabledFlags } from "../../src/core/hosted-preview";

const environment = (): Record<string, string | undefined> => ({
  DOCKED_HOSTED_PREVIEW: "true",
  APP_ENV: "preview",
  SUPABASE_ENV: "preview",
  SITE_URL: "https://docked-preview.example.invalid",
  NEXT_PUBLIC_SUPABASE_URL: "https://bckkllmndoxzpzdqrevb.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fictional_test_only",
  DATABASE_URL: [
    "postgres://postgres.bckkllmndoxzpzdqrevb:",
    "fictional",
    "@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres",
  ].join(""),
  DATABASE_CONNECTION_MODE: "session",
  ...Object.fromEntries(
    hostedPreviewDisabledFlags.map((key) => [key, "false"]),
  ),
});
function harness() {
  const state = {
    env: environment(),
    allowed: true,
    rateAllowed: true,
    deferred: [] as Array<() => Promise<void>>,
    processed: 0,
    audited: 0,
    rates: [] as Array<{ key: string; limit: number; seconds: number }>,
  };
  const dependencies = {
    environment: () => state.env,
    eligible: async () => state.allowed,
    rate: async (key: string, limit: number, seconds: number) => {
      state.rates.push({ key, limit, seconds });
      return state.rateAllowed;
    },
    defer: (work: () => Promise<void>) => {
      state.deferred.push(work);
    },
    process: async () => {
      state.processed++;
    },
    failure: async () => {
      state.audited++;
    },
  };
  return { state, dependencies };
}

test("preview fanout is deferred, limited per actor and globally, and runs one injected batch", async () => {
  const { state, dependencies } = harness();
  await schedulePreviewInAppBatch("fixture-user", dependencies);
  assert.equal(state.processed, 0);
  assert.equal(state.deferred.length, 1);
  assert.deepEqual(state.rates, [
    { key: "preview:in-app:fixture-user", limit: 1, seconds: 10 },
    { key: "preview:in-app:global", limit: 30, seconds: 60 },
  ]);
  await state.deferred[0]();
  assert.equal(state.processed, 1);
  assert.equal(state.audited, 0);
});

test("ordinary/local/production/wrong-project/open-service environments cannot schedule preview work", async () => {
  for (const change of [
    { DOCKED_HOSTED_PREVIEW: "false" },
    { DOCKED_HOSTED_PREVIEW: undefined },
    { APP_ENV: "production" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://unrelated.supabase.co" },
    { SENDING_ENABLED: "true" },
    { ODDS_POLLING_ENABLED: "true" },
    { REGISTRATION_ENABLED: "true" },
  ]) {
    const { state, dependencies } = harness();
    state.env = { ...state.env, ...change };
    await schedulePreviewInAppBatch("fixture-user", dependencies);
    assert.equal(state.deferred.length, 0);
    assert.equal(state.processed, 0);
    assert.equal(state.rates.length, 0);
  }
});

test("ineligible or rate-limited actors cannot trigger a batch", async () => {
  for (const mode of ["ineligible", "rate-limited"]) {
    const { state, dependencies } = harness();
    state.allowed = mode !== "ineligible";
    state.rateAllowed = mode !== "rate-limited";
    await schedulePreviewInAppBatch("fixture-user", dependencies);
    assert.equal(state.deferred.length, 0);
    assert.equal(state.processed, 0);
  }
});

test("grant/session revocation and changed safety flags are rechecked after response", async () => {
  for (const mode of ["revoked", "environment-changed"]) {
    const { state, dependencies } = harness();
    await schedulePreviewInAppBatch("fixture-user", dependencies);
    if (mode === "revoked") state.allowed = false;
    else state.env.SENDING_ENABLED = "true";
    await state.deferred[0]();
    assert.equal(state.processed, 0);
  }
});

test("batch and audit failures never reject a successfully saved user mutation", async () => {
  const { state, dependencies } = harness();
  dependencies.process = async () => {
    throw new Error("fictional-sensitive-provider-error");
  };
  await schedulePreviewInAppBatch("fixture-user", dependencies);
  await assert.doesNotReject(state.deferred[0]);
  assert.equal(state.audited, 1);
  dependencies.failure = async () => {
    throw new Error("audit unavailable");
  };
  await assert.doesNotReject(state.deferred[0]);
});
