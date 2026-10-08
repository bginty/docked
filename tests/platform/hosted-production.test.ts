import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, copyFile, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import manifest from "../../config/hosted-production.json";
import {
  assertHostedProduction,
  productionDatabaseBound,
  productionDisabledFlags,
} from "../../src/core/hosted-production.mjs";
import { assertDeploymentEnvironment } from "../../src/core/deployment-environment";
import { databaseConnectionOptions } from "../../src/server/database-tls";
import {
  fantasyProductionEnabled,
  fantasyProductionAction,
} from "../../src/core/fantasy-production";

// Authored identities only. No deployed manifest or real credentials are changed.
const reviewed = {
  ...manifest,
  hostingProvider: "vercel",
  approved: true,
  vercelProjectId: "prj_AUTHOREDTESTONLY",
  vercelTeamId: "team_AUTHOREDTESTONLY",
  supabaseProjectRef: "abcdefghijklmnopqrst",
};
function database(ref = reviewed.supabaseProjectRef, role = "docked_app") {
  const url = new URL(
    "postgres://aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres",
  );
  url.username = `${role}.${ref}`;
  url.password = "fictional-test-only";
  url.searchParams.set("sslmode", "require");
  return url.toString();
}
function environment(): Record<string, string> {
  return {
    VERCEL: "1",
    VERCEL_ENV: "production",
    VERCEL_TARGET_ENV: "production",
    VERCEL_PROJECT_ID: reviewed.vercelProjectId,
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    DOCKED_HOSTED_PRODUCTION: "true",
    DOCKED_HOSTED_PREVIEW: "false",
    APP_ENV: "production",
    SUPABASE_ENV: "production",
    SITE_URL: "https://docked.com.au",
    NEXT_PUBLIC_SUPABASE_URL: `https://${reviewed.supabaseProjectRef}.supabase.co`,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture-only",
    SUPABASE_SECRET_KEY: "sb_secret_fixture-only",
    DATABASE_URL: database(),
    DATABASE_CONNECTION_MODE: "session",
    LEGAL_ENTITY_VERIFIED: "true",
    REGISTRATION_ENABLED: "false",
    ...Object.fromEntries(productionDisabledFlags.map((key) => [key, "false"])),
  };
}

test("beta deployment cannot enable public registration or use an unknown channel", () => {
  assert.doesNotThrow(() =>
    assertHostedProduction(
      { ...environment(), DOCKED_RELEASE_CHANNEL: "beta" },
      reviewed,
    ),
  );
  assert.throws(() =>
    assertHostedProduction(
      {
        ...environment(),
        DOCKED_RELEASE_CHANNEL: "beta",
        REGISTRATION_ENABLED: "true",
      },
      reviewed,
    ),
  );
  assert.throws(() =>
    assertHostedProduction(
      { ...environment(), DOCKED_RELEASE_CHANNEL: "unknown" },
      reviewed,
    ),
  );
});

test("free-play production requires separate reviewed identities and cannot borrow Preview configuration", () => {
  const env = {
    ...environment(),
    FANTASY_FREE_PLAY_PRODUCTION: "true",
    FANTASY_CARDS_PREVIEW: "false",
  };
  assert.equal(fantasyProductionEnabled(env, reviewed), true);
  assert.equal(fantasyProductionEnabled(env, manifest), false);
  for (const change of [
    { FANTASY_FREE_PLAY_PRODUCTION: "false" },
    { FANTASY_CARDS_PREVIEW: "true" },
    { APP_ENV: "preview" },
    { SUPABASE_ENV: "preview" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://bckkllmndoxzpzdqrevb.supabase.co" },
    { DATABASE_URL: database("bckkllmndoxzpzdqrevb") },
    { VERCEL_PROJECT_ID: "prj_WRONG" },
  ])
    assert.equal(
      fantasyProductionEnabled({ ...env, ...change }, reviewed),
      false,
    );
});

test("free-play action boundary rejects monetary requests and device-selected daily periods", () => {
  const request_id = "10000000-0000-4000-8000-000000000001";
  for (const action of ["claim_starter", "claim_daily"])
    assert.equal(
      fantasyProductionAction.safeParse({ action, payload: {}, request_id })
        .success,
      true,
    );
  for (const action of [
    "buy_pack",
    "admin_credit",
    "admin_pack",
    "list",
    "buy",
    "offer_trade",
    "admin_competition",
  ])
    assert.equal(
      fantasyProductionAction.safeParse({ action, payload: {}, request_id })
        .success,
      false,
    );
  assert.equal(
    fantasyProductionAction.safeParse({
      action: "claim_daily",
      payload: { period: "2099-01-01" },
      request_id,
    }).success,
    false,
  );
  for (const daily_points of [0, 51, 1.5])
    assert.equal(
      fantasyProductionAction.safeParse({
        action: "admin_reward_policy",
        payload: { daily_points, card_every: 7, daily_card_limit: 100 },
        request_id,
      }).success,
      false,
    );
});

test("reviewed community-only production is isolated and does not treat inert keys as activation", () => {
  const env = environment();
  assert.doesNotThrow(() => assertHostedProduction(env, reviewed));
  assert.doesNotThrow(() =>
    assertHostedProduction(
      {
        ...env,
        THE_ODDS_API_KEY: "fictional-unused",
        ODDSPAPI_API_KEY: "fictional-unused",
        RESULTS_API_KEY: "fictional-unused",
        AUTH_EMAIL_ENABLED: "true",
        REGISTRATION_ENABLED: "true",
      },
      reviewed,
    ),
  );
  assert.doesNotThrow(() => assertHostedProduction({}, manifest));
  assert.doesNotThrow(() =>
    assertDeploymentEnvironment({ APP_ENV: "preview" }),
  );
  assert.throws(() =>
    assertHostedProduction(env, { ...reviewed, approved: false }),
  );
  assert.throws(() =>
    assertHostedProduction(env, { ...reviewed, supabaseProjectRef: null }),
  );
  assert.throws(() =>
    assertHostedProduction(env, { ...reviewed, vercelProjectId: null }),
  );
  assert.throws(() =>
    assertHostedProduction(env, { ...reviewed, vercelTeamId: null }),
  );
  assert.throws(() =>
    assertHostedProduction(env, {
      ...reviewed,
      supabaseOrganizationId: "unrelated",
    }),
  );
});

test("production flags must be explicitly closed; runtime scope and legal provenance cannot be omitted", () => {
  for (const key of productionDisabledFlags)
    for (const value of ["true", "", "0", undefined])
      assert.throws(
        () =>
          assertHostedProduction({ ...environment(), [key]: value }, reviewed),
        key,
      );
  for (const change of [
    { DOCKED_HOSTED_PRODUCTION: "false" },
    { DOCKED_HOSTED_PRODUCTION: "yes" },
    { DOCKED_HOSTED_PREVIEW: "true" },
    { VERCEL: "" },
    { VERCEL_ENV: "preview" },
    { VERCEL_TARGET_ENV: "staging" },
    { VERCEL_PROJECT_ID: "prj_WRONG" },
    { APP_ENV: "preview" },
    { SUPABASE_ENV: "preview" },
    { LEGAL_ENTITY_VERIFIED: "false" },
    { REGISTRATION_ENABLED: "" },
    { SUPABASE_SECRET_KEY: "" },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_wrong-key-type" },
    { VERCEL_GIT_COMMIT_SHA: "" },
    { VERCEL_GIT_COMMIT_SHA: "abc123" },
    { DOCKED_CODE_COMMIT: "b".repeat(40) },
    { PREVIEW_AUTH_CAPTURE_MODE: "verified_db_hook" },
    { PREVIEW_AUTH_PROJECT_REF: "bckkllmndoxzpzdqrevb" },
  ])
    assert.throws(() =>
      assertHostedProduction({ ...environment(), ...change }, reviewed),
    );
  assert.doesNotThrow(() =>
    assertHostedProduction(
      { ...environment(), DOCKED_CODE_COMMIT: "A".repeat(40) },
      reviewed,
    ),
  );
});

test("production cannot relabel Preview, unrelated projects, domain lookalikes or the reviewed project as Preview", () => {
  for (const organization of [
    "ernfnkcbalhyqpsrzdwa",
    "eadbdqbkrqucdhialgoz",
    "abcdefghijklmnopqrst",
    "",
  ])
    assert.throws(() =>
      assertHostedProduction(environment(), {
        ...reviewed,
        supabaseOrganizationId: organization,
      }),
    );
  for (const ref of ["bckkllmndoxzpzdqrevb", "dwdjeecjdkkiidoutnme"])
    assert.throws(() =>
      assertHostedProduction(
        {
          ...environment(),
          NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
          DATABASE_URL: database(ref),
        },
        { ...reviewed, supabaseProjectRef: ref },
      ),
    );
  for (const SITE_URL of [
    "http://docked.com.au",
    "https://www.docked.com.au",
    "https://docked.com.au/",
    "https://docked.com.au/path",
    "https://docked.com.au.evil.invalid",
    "https://user:password@docked.com.au",
    "https://docked.com.au?redirect=elsewhere",
  ])
    assert.throws(() =>
      assertHostedProduction({ ...environment(), SITE_URL }, reviewed),
    );
  for (const NEXT_PUBLIC_SUPABASE_URL of [
    "https://bckkllmndoxzpzdqrevb.supabase.co",
    `https://${reviewed.supabaseProjectRef}.supabase.co/`,
    `https://${reviewed.supabaseProjectRef}.supabase.co.evil.invalid`,
  ])
    assert.throws(() =>
      assertHostedProduction(
        { ...environment(), NEXT_PUBLIC_SUPABASE_URL },
        reviewed,
      ),
    );
  assert.throws(() =>
    assertHostedProduction(
      {
        APP_ENV: "preview",
        SITE_URL: "https://docked.com.au",
      },
      reviewed,
    ),
  );
  assert.throws(() =>
    assertHostedProduction(
      {
        APP_ENV: "preview",
        DATABASE_URL: database(),
      },
      reviewed,
    ),
  );
  assert.throws(() =>
    assertHostedProduction(
      {
        APP_ENV: "preview",
        VERCEL_PROJECT_ID: reviewed.vercelProjectId,
      },
      reviewed,
    ),
  );
});

test("database binding rejects mixed projects, elevated roles, transaction pooling and URL overrides", () => {
  const env = environment();
  assert.equal(productionDatabaseBound(env, reviewed), true);
  const direct = new URL(database());
  direct.username = "docked_app";
  direct.hostname = `db.${reviewed.supabaseProjectRef}.supabase.co`;
  assert.equal(
    productionDatabaseBound(
      {
        ...env,
        DATABASE_URL: direct.toString(),
        DATABASE_CONNECTION_MODE: "direct",
      },
      reviewed,
    ),
    true,
  );
  for (const role of [
    "postgres",
    "supabase_admin",
    "service_role",
    "authenticator",
    "docked_app;drop",
  ])
    assert.equal(
      productionDatabaseBound(
        { ...env, DATABASE_URL: database(reviewed.supabaseProjectRef, role) },
        { ...reviewed, databaseRole: role },
      ),
      false,
    );
  for (const mutate of [
    (u: URL) => {
      u.username = "docked_app.zyxwvutsrqponmlkjihg";
    },
    (u: URL) => {
      u.hostname = "aws-0-ap-southeast-2.pooler.supabase.com.evil.invalid";
    },
    (u: URL) => {
      u.hostname = "aws-0-us-east-1.pooler.supabase.com";
    },
    (u: URL) => {
      u.port = "6543";
    },
    (u: URL) => {
      u.password = "";
    },
    (u: URL) => {
      u.pathname = "/other";
    },
    (u: URL) => {
      u.hash = "override";
    },
    (u: URL) => {
      u.searchParams.set("host", "evil.invalid");
    },
    (u: URL) => {
      u.searchParams.set("sslmode", "disable");
    },
    (u: URL) => {
      u.searchParams.append("sslmode", "verify-full");
    },
  ]) {
    const u = new URL(database());
    mutate(u);
    assert.equal(
      productionDatabaseBound({ ...env, DATABASE_URL: u.toString() }, reviewed),
      false,
    );
  }
  assert.equal(
    productionDatabaseBound(
      { ...env, DATABASE_CONNECTION_MODE: "transaction" },
      reviewed,
    ),
    false,
  );
  const options = databaseConnectionOptions(database(), {
    DOCKED_HOSTED_PRODUCTION: "true",
  });
  assert.notEqual(options.ssl, false);
  if (options.ssl) {
    assert.equal(options.ssl.rejectUnauthorized, true);
    assert.match(String(options.ssl.ca), /BEGIN CERTIFICATE/);
    assert.equal(typeof options.ssl.checkServerIdentity, "function");
  }
});

test("plain Node hosted build uses the same reviewed manifest and rejects incomplete production before compilation", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "docked-production-guard-"),
  );
  try {
    for (const folder of ["scripts", "config", "src/core"])
      await mkdir(path.join(directory, folder), { recursive: true });
    for (const file of [
      "scripts/guard-hosted-build.mjs",
      "src/core/hosted-production.mjs",
      "src/core/hosted-review.mjs",
      "src/core/hosting-identity.mjs",
      "config/netlify-build.json",
    ])
      await copyFile(file, path.join(directory, file));
    const target = path.join(directory, "config/hosted-production.json");
    await writeFile(target, JSON.stringify(reviewed));
    const run = (env: Record<string, string | undefined>) =>
      spawnSync(
        process.execPath,
        [path.join(directory, "scripts/guard-hosted-build.mjs")],
        { env: { NODE_ENV: "test", ...env }, encoding: "utf8" },
      );
    assert.equal(run(environment()).status, 0);
    for (const change of [
      { PUBLICATION_ENABLED: "true" },
      { VERCEL_ENV: "preview" },
      { DOCKED_HOSTED_PRODUCTION: "" },
    ]) {
      const result = run({ ...environment(), ...change });
      assert.notEqual(result.status, 0);
      assert.doesNotMatch(
        result.stderr,
        /fictional-test-only|sb_secret_fixture/,
      );
    }
    await writeFile(target, JSON.stringify({ ...reviewed, approved: false }));
    assert.notEqual(run(environment()).status, 0);
  } finally {
    assert.equal(path.dirname(directory), path.resolve(tmpdir()));
    assert.ok(path.basename(directory).startsWith("docked-production-guard-"));
    await rm(directory, { recursive: true });
  }
});
