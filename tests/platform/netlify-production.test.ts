import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  copyFile,
  writeFile,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  assertHostedProduction,
  productionDisabledFlags,
} from "../../src/core/hosted-production.mjs";
import {
  netlifyBuildCandidate,
  netlifyCodeCommit,
} from "../../src/core/hosting-identity.mjs";

const site = "11111111-2222-4333-8444-555555555555";
const manifest = {
  schemaVersion: 1,
  approved: true,
  hostingProvider: "netlify",
  netlifySiteId: site,
  netlifyAccountId: "authored_account",
  origin: "https://docked.com.au",
  projectName: "docked-production",
  supabaseProjectRef: "abcdefghijklmnopqrst",
  supabaseOrganizationId: "otldyeunbqabbcjydjpe",
  supabaseRegion: "ap-southeast-2",
  databaseRole: "docked_app",
};
function environment(): Record<string, string> {
  const database = new URL(
    "postgres://aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres",
  );
  database.username = `docked_app.${manifest.supabaseProjectRef}`;
  database.password = "fixture-only";
  return {
    NETLIFY: "true",
    SITE_ID: site,
    ACCOUNT_ID: manifest.netlifyAccountId,
    CONTEXT: "production",
    COMMIT_REF: "a".repeat(40),
    DEPLOY_ID: "b".repeat(24),
    APP_ENV: "production",
    SUPABASE_ENV: "production",
    DOCKED_HOSTED_PRODUCTION: "true",
    DOCKED_HOSTED_PREVIEW: "false",
    SITE_URL: manifest.origin,
    NEXT_PUBLIC_SUPABASE_URL: `https://${manifest.supabaseProjectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
    SUPABASE_SECRET_KEY: "sb_secret_fixture",
    DATABASE_URL: database.href,
    DATABASE_CONNECTION_MODE: "session",
    LEGAL_ENTITY_VERIFIED: "true",
    REGISTRATION_ENABLED: "false",
    ...Object.fromEntries(productionDisabledFlags.map((k) => [k, "false"])),
  };
}

test("Netlify production binds site, account and build provenance without pretending to be Vercel", () => {
  const env = environment();
  const build = netlifyBuildCandidate(env);
  assert.doesNotThrow(() => assertHostedProduction(env, manifest, build));
  // Netlify documents only SITE_ID, SITE_NAME and URL at function runtime.
  const runtime = { ...env };
  for (const key of [
    "NETLIFY",
    "ACCOUNT_ID",
    "CONTEXT",
    "COMMIT_REF",
    "DEPLOY_ID",
  ])
    delete runtime[key];
  assert.doesNotThrow(() => assertHostedProduction(runtime, manifest, build));
  assert.equal(netlifyCodeCommit(runtime, build), env.COMMIT_REF);
  assert.throws(() => assertHostedProduction(runtime, manifest)); // unbuilt checked-in record
  for (const change of [
    { SITE_ID: "different" },
    { SITE_ID: "" },
    { ACCOUNT_ID: "different" },
    { CONTEXT: "deploy-preview" },
    { COMMIT_REF: "c".repeat(40) },
    { DOCKED_CODE_COMMIT: "c".repeat(40) },
    { DEPLOY_ID: "c".repeat(24) },
    { VERCEL: "1" },
    { NETLIFY: "false" },
    { NETLIFY_PREVIEW_SERVER: "true" },
    { DOCKED_HOSTED_PREVIEW: "true" },
    { PAID_PLANS_ENABLED: "true" },
    { PREVIEW_AUTH_CAPTURE_MODE: "verified_db_hook" },
  ])
    assert.throws(
      () => assertHostedProduction({ ...env, ...change }, manifest, build),
      JSON.stringify(change),
    );
  for (const change of [
    { netlifySiteId: null },
    { netlifyAccountId: null },
    { hostingProvider: "unknown" },
    { approved: false },
    { supabaseProjectRef: "bckkllmndoxzpzdqrevb" },
    { supabaseProjectRef: "dwdjeecjdkkiidoutnme" },
  ])
    assert.throws(() =>
      assertHostedProduction(env, { ...manifest, ...change }, build),
    );
  for (const change of [
    { commit: null },
    { context: "deploy-preview" },
    { siteId: "wrong" },
    { accountId: "wrong" },
    { deployId: null },
  ])
    assert.throws(() =>
      assertHostedProduction(env, manifest, { ...build, ...change }),
    );
});

test("controlled Netlify staging uses only its reviewed exact platform URL before DNS cutover", () => {
  const stagingOrigin = "https://docked-authored-stage.netlify.app";
  const reviewed = { ...manifest, stagingOrigin };
  const env = {
    ...environment(),
    DOCKED_PRODUCTION_STAGE: "staging",
    SITE_URL: stagingOrigin,
    URL: stagingOrigin,
  };
  const build = netlifyBuildCandidate(env);
  assert.doesNotThrow(() => assertHostedProduction(env, reviewed, build));
  for (const change of [
    { URL: "https://other.netlify.app" },
    { URL: "" },
    { SITE_URL: "https://other.netlify.app" },
    { SITE_URL: manifest.origin },
    { DOCKED_PRODUCTION_STAGE: "live" },
  ])
    assert.throws(() =>
      assertHostedProduction({ ...env, ...change }, reviewed, build),
    );
  for (const stagingOrigin of [
    null,
    "https://*.netlify.app",
    "https://docked.com.au.evil.invalid",
    "http://docked-authored-stage.netlify.app",
    "https://docked-authored-stage.netlify.app/path",
  ])
    assert.throws(() =>
      assertHostedProduction(env, { ...manifest, stagingOrigin }, build),
    );
  assert.doesNotThrow(() =>
    assertHostedProduction(
      { ...environment(), DOCKED_PRODUCTION_STAGE: "live" },
      reviewed,
      build,
    ),
  );
});

test("Netlify guard writes only validated non-secret build metadata and denies unreviewed contexts", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "docked-netlify-guard-"));
  try {
    for (const folder of ["scripts", "src/core", "config"])
      await mkdir(path.join(directory, folder), { recursive: true });
    for (const file of [
      "scripts/guard-hosted-build.mjs",
      "src/core/hosted-production.mjs",
      "src/core/hosted-review.mjs",
      "src/core/hosting-identity.mjs",
      "config/netlify-build.json",
    ])
      await copyFile(file, path.join(directory, file));
    await writeFile(
      path.join(directory, "config/hosted-production.json"),
      JSON.stringify(manifest),
    );
    const run = (env: Record<string, string | undefined>) =>
      spawnSync(
        process.execPath,
        [path.join(directory, "scripts/guard-hosted-build.mjs")],
        { env: { ...env, NODE_ENV: "test" }, encoding: "utf8", timeout: 10000 },
      );
    assert.equal(run(environment()).status, 0);
    const stamp = await readFile(
      path.join(directory, "config/netlify-build.json"),
      "utf8",
    );
    assert.deepEqual(JSON.parse(stamp), netlifyBuildCandidate(environment()));
    assert.doesNotMatch(stamp, /fixture-only|sb_secret|DATABASE_URL/);
    for (const change of [
      { CONTEXT: "deploy-preview" },
      { CONTEXT: "branch-deploy" },
      { NETLIFY: "" },
      { COMMIT_REF: "" },
      { SITE_ID: "" },
      { ACCOUNT_ID: "wrong" },
    ]) {
      const result = run({ ...environment(), ...change });
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(result.stderr, /fixture-only|sb_secret/);
      assert.equal(
        await readFile(
          path.join(directory, "config/netlify-build.json"),
          "utf8",
        ),
        stamp,
      );
    }
  } finally {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("docked-netlify-guard-"));
    await rm(directory, { recursive: true });
  }
});
