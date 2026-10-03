import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dockedPreviewProjectRef as ref,
  hostedPreviewCaptureReady,
  hostedPreviewEnvironmentBound,
  localPreviewAuth,
  previewDatabaseBound,
  type PreviewCaptureReadiness,
} from "../../src/core/preview-auth";
import { config } from "../../src/server/config";
const email = "docked-preview-gate-fixture@example.invalid";
const env = {
  APP_ENV: "preview",
  SUPABASE_ENV: "preview",
  PREVIEW_AUTH_PROJECT_REF: ref,
  PREVIEW_AUTH_CAPTURE_MODE: "verified_db_hook",
  SITE_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  DATABASE_URL: `postgresql://postgres:fictional-password@db.${ref}.supabase.co:5432/postgres`,
  DATABASE_CONNECTION_MODE: "direct",
};
const proof: PreviewCaptureReadiness = {
  databaseNow: "2026-10-03T10:00:00Z",
  enabled: true,
  projectRef: ref,
  siteUrl: env.SITE_URL,
  configuredAt: "2026-10-03T09:45:00Z",
  configurationExpiresAt: "2026-10-03T11:00:00Z",
  hookVerifiedAt: "2026-10-03T09:56:00Z",
  hookVerifiedEventId: "00000000-0000-4000-8000-000000000001",
  hookFunctionSha256: "a".repeat(64),
  actualFunctionSha256: "a".repeat(64),
  recipientEmail: email,
  recipientApprovedAt: "2026-10-03T09:45:00Z",
  recipientExpiresAt: "2026-10-03T11:00:00Z",
  recipientRevokedAt: null,
  proofId: "00000000-0000-4000-8000-000000000001",
  proofEmail: "docked-preview-canary@example.invalid",
  proofAction: "signup",
  proofRedirect: "http://localhost:3000/auth/callback",
  proofReceivedAt: "2026-10-03T09:55:00Z",
  proofExpiresAt: "2026-10-03T10:25:00Z",
  proofRecipientApprovedAt: "2026-10-03T09:45:00Z",
  proofRecipientExpiresAt: "2026-10-03T11:00:00Z",
  proofRecipientRevokedAt: null,
  signupRedirectAllowed: true,
  recoveryRedirectAllowed: true,
};
test("hosted capture needs exact project-bound direct or Sydney session connection and explicit preview intent", () => {
  assert.equal(hostedPreviewCaptureReady(email, env, proof), true);
  const session = {
    ...env,
    DATABASE_CONNECTION_MODE: "session",
    DATABASE_URL: `postgresql://postgres.${ref}:fictional@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres`,
  };
  assert.equal(hostedPreviewCaptureReady(email, session, proof), true);
  for (const changed of [
    { APP_ENV: "production" },
    { SUPABASE_ENV: "production" },
    { PREVIEW_AUTH_CAPTURE_MODE: "true" },
    { PREVIEW_AUTH_PROJECT_REF: "unrelated" },
    { SITE_URL: "https://docked.com.au" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://unrelated.supabase.co" },
    {
      NEXT_PUBLIC_SUPABASE_URL: `${env.NEXT_PUBLIC_SUPABASE_URL}.evil.invalid`,
    },
    { DATABASE_CONNECTION_MODE: "transaction" },
    {
      DATABASE_URL: `postgres://postgres:fixture@db.unrelated.supabase.co:5432/postgres`,
    },
  ])
    assert.equal(hostedPreviewEnvironmentBound({ ...env, ...changed }), false);
  assert.equal(hostedPreviewEnvironmentBound({}), false);
});
test("connection parser rejects transaction ports, credential-host tricks, unknown options and ambient-port fallbacks", () => {
  for (const url of [
    `postgres://postgres.${ref}:fixture@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres`,
    `postgres://postgres.other:fixture@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres`,
    `postgres://postgres:fixture@db.${ref}.supabase.co/postgres`,
    `postgres://postgres:fixture@db.${ref}.supabase.co:5432/postgres?host=unrelated`,
    `postgres://postgres:fixture@db.${ref}.supabase.co.evil.invalid:5432/postgres`,
    `postgres://postgres:fixture@db.${ref}.supabase.co:5432/other`,
  ])
    assert.equal(previewDatabaseBound({ ...env, DATABASE_URL: url }), false);
});
test("only an exact reserved allowlisted address is eligible; matching a prefix/domain alone cannot send", () => {
  for (const address of [
    undefined,
    "real@example.com",
    "real@example.invalid",
    "docked-preview-a@example.com",
    "docked-preview-a+alias@example.invalid",
    "docked-preview-*@example.invalid",
    "DOCKED-PREVIEW-GATE-FIXTURE@example.invalid",
    "docked-preview-other@example.invalid",
  ])
    assert.equal(hostedPreviewCaptureReady(address, env, proof), false);
  assert.equal(hostedPreviewCaptureReady(email, env, null), false);
});
test("missing, altered, expired, revoked or future capture proof fails closed", () => {
  const changes: Partial<PreviewCaptureReadiness>[] = [
    { enabled: false },
    { projectRef: "other" },
    { configurationExpiresAt: proof.databaseNow },
    { configurationExpiresAt: "2026-10-05T09:45:00Z" },
    { hookVerifiedAt: null },
    { hookVerifiedAt: "2026-10-03T10:01:00Z" },
    { hookVerifiedEventId: null },
    { actualFunctionSha256: "b".repeat(64) },
    { hookFunctionSha256: null },
    { proofExpiresAt: proof.databaseNow },
    { proofExpiresAt: "2026-10-03T10:26:00Z" },
    { proofReceivedAt: "2026-10-03T09:40:00Z" },
    { proofAction: "email_change" },
    { proofEmail: "real@example.com" },
    { proofRedirect: "https://docked.com.au/auth/callback" },
    { recipientRevokedAt: proof.databaseNow },
    { recipientExpiresAt: proof.databaseNow },
    { proofRecipientRevokedAt: proof.databaseNow },
    { proofRecipientExpiresAt: proof.databaseNow },
    { recoveryRedirectAllowed: false },
    { databaseNow: "invalid" },
  ];
  for (const changed of changes)
    assert.equal(
      hostedPreviewCaptureReady(email, env, { ...proof, ...changed }),
      false,
      JSON.stringify(changed),
    );
});
test("local mail-sink behavior remains available and production cannot repurpose the verified preview project", () => {
  assert.equal(
    localPreviewAuth({ NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }),
    true,
  );
  assert.equal(
    localPreviewAuth({
      APP_ENV: "preview",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    }),
    true,
  );
  assert.equal(
    localPreviewAuth({
      APP_ENV: "production",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    }),
    false,
  );
  assert.equal(
    localPreviewAuth({
      NEXT_PUBLIC_SUPABASE_URL: "https://localhost.evil.invalid",
    }),
    false,
  );
  assert.equal(config({}).environment, "preview");
  assert.throws(
    () => config({ ...env, APP_ENV: "production" }),
    /Hosted preview/,
  );
  assert.throws(
    () =>
      config({
        APP_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: `HTTPS://${ref}.supabase.co/path`,
      }),
    /cannot run in production/,
  );
  assert.equal(config(env).sending, false);
});
