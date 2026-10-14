import manifest from "../../config/hosted-beta.json" with { type: "json" };
import friendsRelease from "../../config/friends-release.json" with { type: "json" };
import { localMarketplaceAcceptance } from "./local-marketplace-acceptance.mjs";
import {
  assertFriendsTarget,
  assertFriendsReadiness,
} from "./friends-release.mjs";
/** @param {Record<string,string|undefined>} env */
export function betaOrigin(env) {
  if (localMarketplaceAcceptance(env)) return "http://127.0.0.1:3033";
  if (env.DOCKED_FRIENDS_BETA === "true") {
    assertFriendsTarget(env);
    return "https://docked.com.au";
  }
  if (!/^docked-production-[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? ""))
    throw Error("Exact beta deployment origin required");
  return `https://${env.VERCEL_URL}`;
}
/** @param {Record<string,string|undefined>} [env] @param {Record<string,any>} [release] */
export function betaPolicyVersions(
  env = process.env,
  release = friendsRelease,
) {
  const approval =
    env.DOCKED_FRIENDS_BETA === "true"
      ? assertFriendsReadiness(release).policyApproval
      : manifest.policyApproval;
  if (
    !approval ||
    !/^[a-f0-9]{64}$/.test(approval.digest ?? "") ||
    !approval.approvedBy ||
    !approval.approvedAt
  )
    return null;
  const keys = [
    "terms",
    "privacy",
    "beta",
    "community",
    "fantasy",
    "competition",
    "responsible_gambling",
  ];
  if (
    keys.some(
      (k) =>
        typeof approval.versions?.[k] !== "string" || !approval.versions[k],
    )
  )
    return null;
  return approval.versions;
}
/** Authentication-only staging is a setup flow, not community authorization. */
export function betaOwnerAuthenticationOnly(env) {
  return (
    env.DOCKED_BETA_STAGING === "true" &&
    assertHostedBeta(env) &&
    env.BETA_ACCESS_ENABLED === "true" &&
    env.FANTASY_FREE_PLAY_PRODUCTION !== "true"
  );
}
/** Exact isolated beta target: protected Preview by default, or the explicitly
 * evidenced friends production target. It never uses the commercial DB role or
 * changes config/hosted-production.json. Credentials alone cannot enable access.
 * @param {Record<string,string|undefined>} env @param {Record<string,any>} [release] */
export function assertHostedBeta(env, release = friendsRelease) {
  if (localMarketplaceAcceptance(env)) return true;
  if (
    env.DOCKED_FRIENDS_BETA &&
    !["true", "false"].includes(env.DOCKED_FRIENDS_BETA)
  )
    throw Error("Invalid friends mode");
  const friends = assertFriendsTarget(env, release);
  if (!env.DOCKED_BETA_STAGING || env.DOCKED_BETA_STAGING === "false")
    return false;
  const fail = () => {
    throw Error("Unreviewed isolated beta staging configuration");
  };
  if (
    env.DOCKED_BETA_STAGING !== "true" ||
    env.VERCEL !== "1" ||
    (!friends && env.VERCEL_ENV !== "preview") ||
    (!friends &&
      env.VERCEL_TARGET_ENV &&
      env.VERCEL_TARGET_ENV !== "preview") ||
    env.VERCEL_PROJECT_ID !== manifest.projectId ||
    env.VERCEL_ORG_ID !== manifest.teamId ||
    env.VERCEL_GIT_COMMIT_REF !== manifest.branch ||
    !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? "") ||
    !/^docked-production-[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? "") ||
    (env.SITE_URL &&
      env.SITE_URL !== (friends ? "https://docked.com.au" : betaOrigin(env))) ||
    env.DOCKED_HOSTED_REVIEW !== "false" ||
    env.DOCKED_HOSTED_PREVIEW !== "false" ||
    env.DOCKED_HOSTED_PRODUCTION !== "false" ||
    env.APP_ENV !== "production" ||
    env.SUPABASE_ENV !== "production" ||
    env.DATABASE_RUNTIME !== "serverless" ||
    env.DOCKED_RELEASE_CHANNEL !== "beta" ||
    env.NEXT_PUBLIC_SUPABASE_URL !==
      `https://${manifest.supabaseProjectRef}.supabase.co` ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_") ||
    env.NETLIFY ||
    env.PREVIEW_AUTH_CAPTURE_MODE ||
    env.PREVIEW_AUTH_PROJECT_REF
  )
    fail();
  let database;
  try {
    database = new URL(env.DATABASE_URL ?? "");
  } catch {
    fail();
  }
  if (
    !database ||
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    database.pathname !== "/postgres" ||
    !database.password ||
    database.port !== "5432" ||
    database.hash ||
    database.search ||
    !(
      (env.DATABASE_CONNECTION_MODE === "direct" &&
        database.hostname === `db.${manifest.supabaseProjectRef}.supabase.co` &&
        database.username === manifest.databaseRole) ||
      (env.DATABASE_CONNECTION_MODE === "session" &&
        /^aws-[0-9]+-ap-southeast-2\.pooler\.supabase\.com$/.test(
          database.hostname,
        ) &&
        database.username ===
          `${manifest.databaseRole}.${manifest.supabaseProjectRef}`)
    )
  )
    fail();
  for (const flag of [
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
  ])
    if (env[flag] !== "false") fail();
  // No privileged Auth, Graph or provider credential belongs in this web app.
  if (
    env.SUPABASE_SECRET_KEY ||
    env.SUPABASE_SERVICE_ROLE_KEY ||
    Object.keys(env).some((k) => /^(MICROSOFT_|GRAPH_|SMTP_)/.test(k) && env[k])
  )
    fail();
  if (
    manifest.ownerAcceptanceApproved !== true ||
    !betaPolicyVersions(env, release)
  ) {
    for (const flag of [
      "BETA_ACCESS_ENABLED",
      "AUTH_EMAIL_ENABLED",
      "DOCKED_AUTH_INVITES_READY",
      "FANTASY_FREE_PLAY_PRODUCTION",
    ])
      if (env[flag] !== "false") fail();
  }
  if (
    !friends &&
    (manifest.externalActivationApproved !== true || !manifest.hostedAcceptance)
  ) {
    if (env.BETA_TESTERS_ENABLED !== "false") fail();
  }
  if (
    env.FANTASY_FREE_PLAY_PRODUCTION !== "false" &&
    (manifest.ownerGameplayApproved !== true ||
      env.FANTASY_FREE_PLAY_PRODUCTION !== "true" ||
      env.DOCKED_OWNER_GAMEPLAY !== "true" ||
      env.BETA_ACCESS_ENABLED !== "true" ||
      env.BETA_TESTERS_ENABLED !== (friends ? "true" : "false"))
  )
    fail();
  return true;
}
