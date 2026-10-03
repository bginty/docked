import { test } from "node:test";
import assert from "node:assert/strict";
import {
  providerTrialEnvironment,
  trialRequestSchema,
  trialScope,
  trialTokenHash,
  trialMappingAccepted,
  trialExecutionAvailable,
} from "../../src/core/provider-trial";
import { scannerWorkerAuthorized } from "../../src/server/scanner-auth";
import manifest from "../../config/hosted-preview.json";
import {
  newTrialProgress,
  trackedTrialFetch,
  trialFailureDiagnostics,
} from "../../src/core/provider-trial-diagnostics";
const env = {
  DOCKED_HOSTED_PREVIEW: "true",
  APP_ENV: "preview",
  SUPABASE_ENV: "preview",
  VERCEL_ENV: "preview",
  VERCEL_PROJECT_ID: manifest.projectId,
  MARKET_DATA_PROJECT_REF: manifest.supabaseProjectRef,
  SITE_URL: manifest.origin,
  NEXT_PUBLIC_SUPABASE_URL: `https://${manifest.supabaseProjectRef}.supabase.co`,
  DATABASE_URL:
    `postgres://postgres.${manifest.supabaseProjectRef}:` +
    "fictional" +
    "@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres",
  DATABASE_CONNECTION_MODE: "session",
  MARKET_DATA_PROVIDER: "the-odds-api",
  PROVIDER_TRIAL_ENABLED: "true",
  ...Object.fromEntries(
    [
      "MARKET_DATA_POLLING_ENABLED",
      "ODDS_POLLING_ENABLED",
      "PUBLICATION_ENABLED",
      "FORWARD_PAPER_ENABLED",
      "SENDING_ENABLED",
      "EDGE_SCANNER_ENABLED",
      "AUTO_PUBLISH_DOCKED_EDGES",
      "ADS_ENABLED",
      "AFFILIATES_ENABLED",
      "PAID_PLANS_ENABLED",
      "PRO_ENTITLEMENTS_ENABLED",
      "COMPETITIONS_ENABLED",
      "PRIZES_ENABLED",
      "DEALS_ENABLED",
    ].map((k) => [k, "false"]),
  ),
};
test("manual trial exact Preview binding rejects production, general polling, scanner, live, paper and foreign authority", () => {
  assert.equal(providerTrialEnvironment(env), true);
  for (const change of [
    { APP_ENV: "production" },
    { VERCEL_ENV: "production" },
    { VERCEL_PROJECT_ID: "other" },
    { SITE_URL: "https://docked.com.au" },
    { MARKET_DATA_PROJECT_REF: "other" },
    { MARKET_DATA_POLLING_ENABLED: "true" },
    { ODDS_POLLING_ENABLED: "true" },
    { EDGE_SCANNER_ENABLED: "true" },
    { PUBLICATION_ENABLED: "true" },
    { FORWARD_PAPER_ENABLED: "true" },
    { PAID_PLANS_ENABLED: "true" },
    { ODDSPAPI_API_KEY: "fictional" },
    { PROVIDER_TRIAL_ENABLED: "false" },
  ])
    assert.equal(
      providerTrialEnvironment({ ...env, ...change }),
      false,
      JSON.stringify(Object.keys(change)),
    );
});
test("manual request contains only a permit identifier and never provider parameters or key", () => {
  assert.deepEqual(
    trialRequestSchema.parse({
      permitId: "2ec9f1a2-29b6-43fb-aabc-a27a3065a317",
    }),
    { permitId: "2ec9f1a2-29b6-43fb-aabc-a27a3065a317" },
  );
  assert.throws(() =>
    trialRequestSchema.parse({
      permitId: "2ec9f1a2-29b6-43fb-aabc-a27a3065a317",
      apiKey: "fictional",
    }),
  );
  assert.equal(trialScope("sports", null), "sports");
  assert.equal(trialScope("odds", "soccer_epl"), "odds:soccer_epl");
  assert.throws(() => trialScope("sports", "soccer_epl"));
  assert.throws(() => trialScope("history", "soccer_epl"));
});
test("operator bearer is strict ASCII constant-time verified and only its hash belongs in database", () => {
  const token = "x".repeat(40);
  assert.equal(scannerWorkerAuthorized(token, `Bearer ${token}`), true);
  for (const actual of [
    null,
    `Bearer ${"é".repeat(40)}`,
    `Bearer ${token} `,
    token,
  ])
    assert.equal(scannerWorkerAuthorized(token, actual), false);
  assert.match(trialTokenHash(token), /^[a-f0-9]{64}$/);
  assert.notEqual(trialTokenHash(token), token);
});
test("canonical ingestion conflicts stop the manual trial rather than looking healthy", () => {
  assert.equal(trialMappingAccepted(0), true);
  for (const count of [1, 2, -1, NaN, Infinity, 0.1])
    assert.equal(trialMappingAccepted(count), false);
});
test("known exhausted account or lifetime ceiling blocks even free repeated metadata calls", () => {
  const base = {
    cap: 250,
    charged: 0,
    attempts: 0,
    attemptCap: 25,
    remaining: null,
  };
  assert.equal(trialExecutionAvailable(base), true);
  for (const change of [
    { remaining: 0 },
    { remaining: -1 },
    { charged: 250 },
    { cap: 251 },
    { attempts: 25 },
    { charged: NaN },
  ])
    assert.equal(trialExecutionAvailable({ ...base, ...change }), false);
  assert.equal(
    trialExecutionAvailable({
      ...base,
      remaining: 1,
      charged: 249,
      attempts: 24,
    }),
    true,
  );
});

test("failure evidence records fixed stages and classes without messages, URLs, tokens or arbitrary SQL states", async () => {
  const progress = newTrialProgress();
  const fake = "fictional-secret-must-not-persist";
  const fetcher = trackedTrialFetch(progress, async () => new Response("[]"));
  await fetcher("https://example.invalid/?apiKey=" + fake);
  progress.stage = "QUOTA_PERSISTENCE";
  const error = Object.assign(new TypeError(fake), {
    code: "42501",
    detail: fake,
    query: fake,
  });
  assert.deepEqual(trialFailureDiagnostics(error, progress), {
    failureStage: "QUOTA_PERSISTENCE",
    httpResponseReceived: true,
    httpStatus: 200,
    errorClass: "TypeError",
    sqlState: "42501",
  });
  const unknown = trialFailureDiagnostics(
    { name: fake, code: fake, message: fake },
    progress,
  );
  assert.equal(unknown.errorClass, "UnknownError");
  assert.equal(unknown.sqlState, null);
  assert.equal(JSON.stringify(unknown).includes(fake), false);
  const failed = newTrialProgress();
  await assert.rejects(
    trackedTrialFetch(failed, async () => {
      throw new Error(fake);
    })("https://example.invalid"),
  );
  assert.equal(failed.stage, "HTTP_REQUEST");
  assert.equal(failed.httpResponseReceived, false);
});
