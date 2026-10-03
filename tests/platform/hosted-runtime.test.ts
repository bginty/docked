import { test } from "node:test";
import assert from "node:assert/strict";
import { NextResponse } from "next/server";
import postgres from "postgres";
import { authCookieOptions } from "../../src/core/auth-cookies";
import {
  assertHostedPreview,
  hostedPreviewDisabledFlags,
} from "../../src/core/hosted-preview";
import {
  communityImageMaxBytes,
  communityUploadMaxBytes,
} from "../../src/core/community-media";
import { boundedCommunityBody } from "../../src/core/community-social";
import { databasePoolOptions } from "../../src/server/database-pool";
import { config } from "../../src/server/config";
import {
  previewCommunityContext,
  previewCommunityFeature,
} from "../../src/core/preview-community";

const hosted = () => ({
  DOCKED_HOSTED_PREVIEW: "true",
  APP_ENV: "preview",
  SUPABASE_ENV: "preview",
  SITE_URL: "https://docked-preview.example.invalid",
  NEXT_PUBLIC_SUPABASE_URL: "https://bckkllmndoxzpzdqrevb.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fictional_test_only",
  DATABASE_URL:
    "postgres://postgres.bckkllmndoxzpzdqrevb:fictional@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres",
  DATABASE_CONNECTION_MODE: "session",
  ...Object.fromEntries(
    hostedPreviewDisabledFlags.map((key) => [key, "false"]),
  ),
});

test("preview tester context is explicit, project-bound and restricted to social features without operators", () => {
  assert.equal(previewCommunityContext({}), "");
  assert.equal(
    previewCommunityContext({
      APP_ENV: "preview",
      DOCKED_HOSTED_PREVIEW: "false",
    }),
    "",
  );
  assert.equal(previewCommunityContext(hosted()), "bckkllmndoxzpzdqrevb");
  assert.throws(() =>
    previewCommunityContext({ ...hosted(), APP_ENV: "production" }),
  );
  assert.throws(() =>
    previewCommunityContext({
      ...hosted(),
      NEXT_PUBLIC_SUPABASE_URL: "https://unrelated.supabase.co",
    }),
  );
  assert.throws(() =>
    previewCommunityContext({ ...hosted(), REGISTRATION_ENABLED: "true" }),
  );
  for (const feature of ["community_social", "public_profiles"]) {
    assert.equal(previewCommunityFeature(feature), true);
    assert.equal(previewCommunityFeature(feature, "bookmaker"), false);
  }
  for (const feature of [
    "tips",
    "community_edges",
    "leaderboards",
    "marketing",
    "paid_analysis",
    "competitions",
    "prizes",
    "deals",
    "sponsorship",
    "",
  ])
    assert.equal(previewCommunityFeature(feature), false);
});

test("HTTPS Auth issue, refresh and deletion cookies are consistently private and secure", () => {
  for (const options of [
    { path: "/", maxAge: 3600, secure: false, httpOnly: false },
    {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
      secure: false,
      httpOnly: false,
    },
  ]) {
    const response = NextResponse.next();
    response.cookies.set(
      "sb-fictional-auth-token.0",
      "fictional",
      authCookieOptions(options, hosted().SITE_URL),
    );
    const cookie = response.headers.get("set-cookie")!;
    assert.match(cookie, /; Secure/);
    assert.match(cookie, /; HttpOnly/);
    assert.match(cookie, /; SameSite=lax/);
    assert.match(cookie, /; Path=\//);
    if (!options.maxAge) assert.match(cookie, /; Max-Age=0/);
  }
  const local = authCookieOptions(
    { httpOnly: false, maxAge: 0 },
    "http://localhost:3000",
  );
  assert.equal(local.secure, false);
  assert.equal(local.httpOnly, false);
  assert.equal(local.maxAge, 0);
});

test("hosted preview accepts only the exact project and canonical external HTTPS origin", () => {
  assert.doesNotThrow(() => assertHostedPreview(hosted()));
  assert.equal(config(hosted()).registration, false);
  for (const change of [
    { APP_ENV: "production" },
    { SUPABASE_ENV: "production" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://unrelated-project.supabase.co" },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_forbidden" },
    {
      DATABASE_URL:
        "postgres://postgres:fictional@db.unrelated.supabase.co:5432/postgres",
    },
    { DATABASE_CONNECTION_MODE: "transaction" },
    ...[
      "http://preview.example.invalid",
      "https://localhost",
      "https://docked.com.au",
      "https://www.docked.com.au",
      "https://preview.example.invalid/path",
      "https://user:password@preview.example.invalid",
      "https://preview.example.invalid?redirect=elsewhere",
    ].map((SITE_URL) => ({ SITE_URL })),
  ])
    assert.throws(() => assertHostedPreview({ ...hosted(), ...change }));
  assert.doesNotThrow(() => config({ APP_ENV: "preview" }));
  assert.throws(() => assertHostedPreview({ DOCKED_HOSTED_PREVIEW: "yes" }));
});

test("hosted mode rejects missing safety controls, provider activation and capture reuse", () => {
  for (const key of hostedPreviewDisabledFlags) {
    assert.throws(
      () => assertHostedPreview({ ...hosted(), [key]: "true" }),
      key,
    );
    assert.throws(
      () => assertHostedPreview({ ...hosted(), [key]: undefined }),
      key,
    );
  }
  for (const key of [
    "PREVIEW_AUTH_CAPTURE_MODE",
    "PREVIEW_AUTH_PROJECT_REF",
    "ODDS_API_KEY",
    "ODDS_RIGHTS_REFERENCE",
    "RESULTS_API_KEY",
    "RESULTS_PROVIDER",
    "RESULTS_RIGHTS_REFERENCE",
    "MARKET_REFERENCE_CONFIG_JSON",
    "EMAIL_API_KEY",
    "SMTP_PASSWORD",
    "PUSH_API_KEY",
    "STRIPE_SECRET_KEY",
  ])
    assert.throws(
      () =>
        assertHostedPreview({ ...hosted(), [key]: "fictional-not-enabled" }),
      key,
    );
  for (const key of ["ODDS_PROVIDER_STATUS", "RESULTS_PROVIDER_STATUS"])
    assert.throws(() =>
      assertHostedPreview({ ...hosted(), [key]: "CONFIGURED" }),
    );
  assert.throws(() =>
    assertHostedPreview({ ...hosted(), ODDS_MONTHLY_CREDIT_LIMIT: "1" }),
  );
  assert.doesNotThrow(() =>
    assertHostedPreview({
      ...hosted(),
      ODDS_PROVIDER_STATUS: "NOT_CONFIGURED",
      RESULTS_PROVIDER_STATUS: "NOT_CONFIGURED",
    }),
  );
});

test("serverless database pool is opt-in and actual driver receives bounded settings", async () => {
  assert.deepEqual(databasePoolOptions({ VERCEL: "1" }), {
    max: 5,
    prepare: false,
  });
  assert.deepEqual(databasePoolOptions({ DATABASE_RUNTIME: "persistent" }), {
    max: 5,
    prepare: false,
  });
  assert.throws(() => databasePoolOptions({ DATABASE_RUNTIME: "automatic" }));
  const driver = postgres(
    "postgres://fictional:password@localhost:5432/unused",
    databasePoolOptions({ DATABASE_RUNTIME: "serverless" }),
  );
  try {
    assert.equal(driver.options.max, 1);
    assert.equal(driver.options.prepare, false);
    assert.equal(driver.options.idle_timeout, 20);
    assert.equal(driver.options.connect_timeout, 10);
  } finally {
    await driver.end();
  }
});

test("multipart budget fits hosted requests and streamed oversized bodies cannot bypass it", async () => {
  assert.equal(communityImageMaxBytes, 4 * 1024 * 1024);
  assert.ok(communityUploadMaxBytes < 4_500_000);
  const data = new FormData();
  data.set(
    "file",
    new File([new Uint8Array(communityImageMaxBytes)], "fictional.png", {
      type: "image/png",
    }),
  );
  data.set("action", "media_upload");
  data.set("alt", "Fictional test file only");
  const valid = new Request("https://preview.example.invalid/api/community", {
    method: "POST",
    body: data,
  });
  const bytes = await boundedCommunityBody(valid, communityUploadMaxBytes);
  assert.ok(bytes.byteLength < communityUploadMaxBytes);
  const oversized = new Request(
    "https://preview.example.invalid/api/community",
    {
      method: "POST",
      body: new Uint8Array(communityUploadMaxBytes + 1),
      headers: { "content-length": "1" },
    },
  );
  await assert.rejects(
    boundedCommunityBody(oversized, communityUploadMaxBytes),
  );
});
