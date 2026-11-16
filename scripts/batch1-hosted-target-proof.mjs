/** Pure validation of approved source guards. Synthetic values; no network or credentials. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  assertPrivatePreview,
  privatePreviewDisabledFlags,
} from "../src/core/private-preview.mjs";
import { assertHostedBeta } from "../src/core/hosted-beta.mjs";
import { assertFriendsTarget } from "../src/core/friends-release.mjs";
import { localMarketplaceAcceptance } from "../src/core/local-marketplace-acceptance.mjs";
const sourceCommit = "084f0e3e86fdc64aec9a9a043ffc3a1c524706eb";
const preview = {
  ...Object.fromEntries(privatePreviewDisabledFlags.map((k) => [k, "false"])),
  DOCKED_PRIVATE_PREVIEW: "true",
  DOCKED_BETA_STAGING: "true",
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_PROJECT_ID: "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR",
  VERCEL_ORG_ID: "team_tf6xweKKyVCj9bTppUKttJ4l",
  VERCEL_GIT_COMMIT_REF: "pivot/fantasy-cards-preview-v1",
  VERCEL_GIT_COMMIT_SHA: sourceCommit,
  VERCEL_URL: "docked-preview-fixture.vercel.app",
  SITE_URL: "https://docked-preview-s24-briant-ginty.vercel.app",
  APP_ENV: "preview",
  SUPABASE_ENV: "preview",
  DOCKED_RELEASE_CHANNEL: "beta",
  DATABASE_RUNTIME: "serverless",
  DOCKED_PREVIEW_OWNER_EMAIL: "support@docked.com.au",
  DOCKED_PREVIEW_OWNER_ID: "00000000-0000-4000-8000-000000000001",
  NEXT_PUBLIC_SUPABASE_URL: "https://bckkllmndoxzpzdqrevb.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  DATABASE_CONNECTION_MODE: "direct",
  DATABASE_URL:
    "postgresql://docked_beta_app:synthetic-not-a-credential@db.bckkllmndoxzpzdqrevb.supabase.co:5432/postgres",
  BETA_ACCESS_ENABLED: "false",
  BETA_TESTERS_ENABLED: "false",
  AUTH_EMAIL_ENABLED: "false",
  DOCKED_AUTH_INVITES_READY: "false",
  FANTASY_FREE_PLAY_PRODUCTION: "false",
};
const checks = [];
assert.equal(assertPrivatePreview(preview), true);
checks.push(
  "Existing closed private Preview guard accepts its exact synthetic target",
);
assert.throws(
  () => assertPrivatePreview({ ...preview, DOCKED_FRIENDS_BETA: "true" }),
  /Unreviewed/,
);
checks.push(
  "Private Preview rejects the friends flag required by the purchase handler",
);
assert.throws(
  () => assertPrivatePreview({ ...preview, BETA_ACCESS_ENABLED: "true" }),
  /Unreviewed/,
);
checks.push(
  "Ordinary closed private Preview does not authorise member admission",
);
const production = {
  ...preview,
  DOCKED_PRIVATE_PREVIEW: "false",
  DOCKED_FRIENDS_BETA: "true",
  VERCEL_ENV: "production",
  VERCEL_PROJECT_ID: "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST",
  VERCEL_GIT_COMMIT_REF: "codex/vercel-beta-review",
  VERCEL_URL: "docked-production-fixture.vercel.app",
  SITE_URL: "https://docked.com.au",
  APP_ENV: "production",
  SUPABASE_ENV: "production",
  NEXT_PUBLIC_SUPABASE_URL: "https://pojoymtniryarxxunyvz.supabase.co",
  DATABASE_URL:
    "postgresql://docked_beta_app:synthetic-not-a-credential@db.pojoymtniryarxxunyvz.supabase.co:5432/postgres",
  BETA_TESTERS_ENABLED: "true",
  BETA_ACCESS_ENABLED: "true",
  AUTH_EMAIL_ENABLED: "true",
  DOCKED_AUTH_INVITES_READY: "true",
  DOCKED_OWNER_GAMEPLAY: "true",
  FANTASY_FREE_PLAY_PRODUCTION: "true",
  DOCKED_TWO_PERSON_BETA: "true",
};
assert.equal(assertHostedBeta(production), true);
checks.push(
  "Friends guard accepts only its existing exact Production-bound synthetic target",
);
assert.throws(
  () => assertFriendsTarget({ ...production, VERCEL_ENV: "preview" }),
  /Unreviewed/,
);
checks.push("Friends mode rejects a genuine Preview environment");
assert.throws(
  () =>
    assertHostedBeta({
      ...production,
      NEXT_PUBLIC_SUPABASE_URL: preview.NEXT_PUBLIC_SUPABASE_URL,
      DATABASE_URL: preview.DATABASE_URL,
    }),
  /Unreviewed/,
);
checks.push(
  "Friends mode rejects isolated Preview Auth/database even in a Production-target build",
);
assert.throws(
  () =>
    localMarketplaceAcceptance({
      ...production,
      DOCKED_LOCAL_MARKETPLACE_ACCEPTANCE: "true",
    }),
  /Invalid local/,
);
checks.push("Local acceptance profile cannot be deployed to Vercel");
const wallet = readFileSync("src/server/member-test-wallet.ts", "utf8");
assert.match(
  wallet,
  /process\.env\.DOCKED_FRIENDS_BETA !== "true" \|\|\s*process\.env\.DOCKED_BETA_STAGING !== "true"/,
);
assert.match(wallet, /throw Error\("Test wallet unavailable"\)/);
const publicPreview = readFileSync(
  "src/core/isolated-public-preview.mjs",
  "utf8",
);
assert.match(publicPreview, /"DOCKED_FRIENDS_BETA"/);
checks.push(
  "The exact pack handler requires friends mode; isolated public Preview explicitly forbids that flag",
);
const report = {
  at: new Date().toISOString(),
  sourceCommit,
  guardProofPassed: true,
  hostedPackPrerequisiteSatisfied: false,
  checks,
  networkRequests: 0,
  productionWrites: 0,
  realCredentialsUsed: false,
  conclusion:
    "The exact application lacks an isolated hosted target for its private-beta pack route. A scoped target/admission correction and separately reviewed source are required; no host spoofing, Production-key reuse or guard bypass is acceptable.",
};
mkdirSync("docs/qa/batch1-controlled-20261116", { recursive: true });
writeFileSync(
  "docs/qa/batch1-controlled-20261116/hosted-target-proof.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
