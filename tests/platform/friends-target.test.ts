import { test } from "node:test";
import assert from "node:assert/strict";
import receipt from "../../config/friends-release.json";
import packet from "../../config/friends-policy-content.json";
import { betaPolicyPacket } from "../../src/core/beta-policy-packet.mjs";
import {
  assertFriendsReadiness,
  assertFriendsTarget,
} from "../../src/core/friends-release.mjs";
import { assertHostedBeta } from "../../src/core/hosted-beta.mjs";
import { friendsReleaseIdentity } from "../../src/core/beta-release-identity.mjs";
import { packExperienceEnabled } from "../../src/core/pack-experience";

const fixture = () => ({
  ...receipt,
  externalReadinessVerified: true,
  policyApproval: {
    approvedBy: "Owner fixture only",
    approvedAt: "2026-10-11T01:00:00Z",
    digest: packet.packetDigest,
    versions: Object.fromEntries(
      [
        "terms",
        "privacy",
        "beta",
        "community",
        "fantasy",
        "competition",
        "responsible_gambling",
      ].map((key) => [key, packet.version]),
    ),
  },
  readiness: {
    sourceCommit: "b".repeat(40),
    verifiedAt: "2026-10-11T01:00:00Z",
    evidencePath: "fixture-only",
    checks: {
      mailbox: true,
      privacy: true,
      admission: true,
      security: true,
      nflCollection: true,
      inventory: true,
      memberGameplay: true,
    },
  },
});
test("complete friends guard retains exact project, role, commercial and secret boundaries", () => {
  const env = {
    ...target(),
    VERCEL: "1",
    VERCEL_PROJECT_ID: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
    VERCEL_ORG_ID: "team_tf6xweKKyVCj9bTppUKttJ4l",
    VERCEL_GIT_COMMIT_REF: "codex/vercel-beta-review",
    VERCEL_GIT_COMMIT_SHA: "a".repeat(40),
    VERCEL_URL: "docked-production-fixture.vercel.app",
    VERCEL_DEPLOYMENT_ID: "dpl_FriendsFixture1234567890",
    APP_ENV: "production",
    SUPABASE_ENV: "production",
    DOCKED_RELEASE_CHANNEL: "beta",
    DATABASE_RUNTIME: "serverless",
    DATABASE_CONNECTION_MODE: "direct",
    DATABASE_URL:
      "postgres://docked_beta_app:fixture@db.pojoymtniryarxxunyvz.supabase.co:5432/postgres",
    NEXT_PUBLIC_SUPABASE_URL: "https://pojoymtniryarxxunyvz.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
    ...Object.fromEntries(
      [
        "DOCKED_HOSTED_REVIEW",
        "DOCKED_HOSTED_PREVIEW",
        "DOCKED_HOSTED_PRODUCTION",
        "REGISTRATION_ENABLED",
        "PUBLICATION_ENABLED",
        "AUTO_PUBLISH_DOCKED_EDGES",
        "ODDS_POLLING_ENABLED",
        "MARKET_DATA_POLLING_ENABLED",
        "EDGE_SCANNER_ENABLED",
        "FORWARD_PAPER_ENABLED",
        "SENDING_ENABLED",
        "ADS_ENABLED",
        "AFFILIATES_ENABLED",
        "PAID_PLANS_ENABLED",
        "PRO_ENTITLEMENTS_ENABLED",
        "COMPETITIONS_ENABLED",
        "PRIZES_ENABLED",
        "DEALS_ENABLED",
        "DEMO_MODE",
        "FANTASY_CARDS_PREVIEW",
      ].map((key) => [key, "false"]),
    ),
  };
  assert.equal(assertHostedBeta(env, fixture()), true);
  assert.equal(packExperienceEnabled(env), false);
  assert.equal(
    packExperienceEnabled({
      ...env,
      NEXT_PUBLIC_DOCKED_FRIENDS_PACK_REVEAL: "true",
    }),
    false,
  );
  assert.equal(
    packExperienceEnabled({ ...env, DOCKED_FRIENDS_PACK_REVEAL: "true" }),
    true,
  );
  assert.equal(
    packExperienceEnabled({
      ...env,
      DOCKED_FRIENDS_PACK_REVEAL: "true",
      DOCKED_FRIENDS_BETA: "false",
    }),
    false,
  );
  for (const change of [
    { VERCEL_PROJECT_ID: "other" },
    { DATABASE_URL: env.DATABASE_URL.replace("docked_beta_app", "docked_app") },
    { PAID_PLANS_ENABLED: "true" },
    { SITE_URL: "https://other.example" },
  ])
    assert.throws(() =>
      packExperienceEnabled({
        ...env,
        DOCKED_FRIENDS_PACK_REVEAL: "true",
        ...change,
      }),
    );
  assert.deepEqual(friendsReleaseIdentity(env, fixture()), {
    hostingProvider: "vercel",
    siteId: env.VERCEL_PROJECT_ID,
    hostingAccountId: env.VERCEL_ORG_ID,
    deploymentId: env.VERCEL_DEPLOYMENT_ID,
    commit: env.VERCEL_GIT_COMMIT_SHA,
    projectRef: "pojoymtniryarxxunyvz",
  });
  assert.throws(() =>
    friendsReleaseIdentity(
      { ...env, VERCEL_DEPLOYMENT_ID: undefined },
      fixture(),
    ),
  );
  assert.throws(() =>
    friendsReleaseIdentity(env, {
      ...fixture(),
      externalReadinessVerified: false,
    }),
  );
  for (const change of [
    { VERCEL_PROJECT_ID: "other" },
    { VERCEL_ORG_ID: "other" },
    { DATABASE_URL: env.DATABASE_URL.replace("docked_beta_app", "docked_app") },
    { REGISTRATION_ENABLED: "true" },
    { PAID_PLANS_ENABLED: "true" },
    { PRIZES_ENABLED: "true" },
    { SUPABASE_SECRET_KEY: "fixture" },
    { GRAPH_PRIVATE_KEY_PEM: "fixture" },
    { DOCKED_FRIENDS_BETA: "false" },
  ]) {
    assert.throws(() => assertHostedBeta({ ...env, ...change }, fixture()));
    assert.throws(() =>
      friendsReleaseIdentity({ ...env, ...change }, fixture()),
    );
  }
});
const target = () => ({
  DOCKED_FRIENDS_BETA: "true",
  DOCKED_BETA_STAGING: "true",
  VERCEL_ENV: "production",
  VERCEL_TARGET_ENV: "production",
  SITE_URL: "https://docked.com.au",
  BETA_TESTERS_ENABLED: "true",
  BETA_ACCESS_ENABLED: "true",
  AUTH_EMAIL_ENABLED: "true",
  DOCKED_AUTH_INVITES_READY: "true",
  DOCKED_OWNER_GAMEPLAY: "true",
  FANTASY_FREE_PLAY_PRODUCTION: "true",
  DOCKED_TWO_PERSON_BETA: "true",
});
test("release authority alone cannot enable friends or impersonate readiness", () => {
  const unverified = { ...fixture(), externalReadinessVerified: false };
  assert.throws(() => assertFriendsReadiness(unverified), /incomplete/);
  assert.throws(() => assertHostedBeta(target(), unverified), /incomplete/);
  assert.equal(assertFriendsTarget({}), false);
  assert.throws(() => assertHostedBeta({ DOCKED_FRIENDS_BETA: "yes" }));
});
test("friends target binds the authorised domain and retains server identity gate", () => {
  assert.equal(assertFriendsTarget(target(), fixture()), true);
  for (const change of [
    { SITE_URL: "https://other.example" },
    { VERCEL_ENV: "preview" },
    { VERCEL_TARGET_ENV: "preview" },
    { DOCKED_BETA_STAGING: "false" },
    { DOCKED_OWNER_GAMEPLAY: "false" },
    { AUTH_EMAIL_ENABLED: "false" },
    { BETA_TESTERS_ENABLED: "false" },
  ])
    assert.throws(() =>
      assertFriendsTarget({ ...target(), ...change }, fixture()),
    );
});
test("each free-beta evidence gate and scope restriction is mandatory", () => {
  for (const key of Object.keys(fixture().readiness.checks)) {
    if (key === "nflCollection") continue;
    const r = fixture();
    (r.readiness.checks as Record<string, boolean>)[key] = false;
    assert.throws(() => assertFriendsReadiness(r));
  }
  for (const change of [
    { maximumLifetimeInvitedTesters: 11 },
    { ordinaryMemberMfaMandatory: true },
    { ownerAdminMfaMandatory: false },
    { realPayments: true },
    { cashTrading: true },
    { prizesActivated: true },
    { realWithdrawals: true },
    { kycCollection: true },
    { publicRegistration: true },
    { sport: "epl" },
    { scoringMode: "live" },
    { country: "US" },
    { minimumAge: 17 },
  ])
    assert.throws(() => assertFriendsReadiness({ ...fixture(), ...change }));
});

test("staged gameplay permits explicitly pending collection without waiving other evidence", () => {
  const pending = fixture();
  pending.readiness.checks.nflCollection = false;
  assert.equal(assertFriendsReadiness(pending), pending);
  for (const change of [
    { releaseStage: "full-scoring" },
    { scoringAcceptance: null },
    { scoringAcceptance: { ...pending.scoringAcceptance, notice: "" } },
    { scoringAcceptance: { ...pending.scoringAcceptance, authority: "" } },
    {
      scoringAcceptance: {
        ...pending.scoringAcceptance,
        freshUnattendedCollection: true,
      },
    },
  ])
    assert.throws(() => assertFriendsReadiness({ ...pending, ...change }));
});

test("friends consent binds the actual packet and cannot relabel historical copy", () => {
  assert.equal(
    betaPolicyPacket(target(), fixture()).packet.packetDigest,
    packet.packetDigest,
  );
  assert.equal(betaPolicyPacket({}).friends, false);
  assert.notEqual(betaPolicyPacket({}).packet.version, packet.version);
  assert.throws(() =>
    betaPolicyPacket(target(), {
      ...fixture(),
      externalReadinessVerified: false,
    }),
  );
  const changed = fixture();
  changed.policyApproval.digest = "c".repeat(64);
  assert.throws(() => assertFriendsReadiness(changed));
  const stale = fixture();
  stale.policyApproval.versions.privacy = "2026-10-09-beta-rc2";
  assert.throws(() => assertFriendsReadiness(stale));
});
