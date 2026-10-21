import target from "../../config/hosted-preview.json" with { type: "json" };
import { requireNflHostedTarget } from "./nfl-hosted-target.mjs";

export const privatePreviewDisabledFlags = Object.freeze([
  "DOCKED_FRIENDS_BETA",
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
  "DOCKED_PRIVATE_OFFERS_LOCAL",
  "DOCKED_REDEMPTION_LOCAL",
]);

/** Separate exact-target guard. Never changes the existing Production contract. */
export function assertPrivatePreview(env) {
  if (!env.DOCKED_PRIVATE_PREVIEW || env.DOCKED_PRIVATE_PREVIEW === "false")
    return false;
  const fail = () => {
    throw Error("Unreviewed private Preview configuration");
  };
  const nfl =
    env.DOCKED_NFL_HOSTED_TESTING === "true" ? requireNflHostedTarget() : null;
  const sourceBranch =
    env.DOCKED_MULTI_SPORT_SANDBOX === "true"
      ? "codex/member-platform-updates"
      : "pivot/fantasy-cards-preview-v1";
  if (
    env.DOCKED_PRIVATE_PREVIEW !== "true" ||
    env.DOCKED_BETA_STAGING !== "true" ||
    env.VERCEL !== "1" ||
    env.VERCEL_ENV !== "preview" ||
    (env.VERCEL_TARGET_ENV && env.VERCEL_TARGET_ENV !== "preview") ||
    env.VERCEL_PROJECT_ID !== target.projectId ||
    env.VERCEL_ORG_ID !== target.teamId ||
    env.VERCEL_GIT_COMMIT_REF !==
      (nfl ? "nfl-hosted-testing" : sourceBranch) ||
    !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? "") ||
    !/^docked-preview-[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? "") ||
    env.SITE_URL !== target.origin ||
    env.APP_ENV !== "preview" ||
    env.SUPABASE_ENV !== "preview" ||
    env.DOCKED_RELEASE_CHANNEL !== "beta" ||
    env.DOCKED_PREVIEW_OWNER_EMAIL !== "support@docked.com.au" ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(
      env.DOCKED_PREVIEW_OWNER_ID ?? "",
    ) ||
    env.DATABASE_RUNTIME !== "serverless" ||
    env.NEXT_PUBLIC_SUPABASE_URL !==
      `https://${target.supabaseProjectRef}.supabase.co` ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_") ||
    env.NETLIFY ||
    env.PREVIEW_AUTH_CAPTURE_MODE ||
    env.PREVIEW_AUTH_PROJECT_REF
  )
    fail();
  let db;
  try {
    db = new URL(env.DATABASE_URL ?? "");
  } catch {
    fail();
  }
  if (
    !db ||
    !["postgres:", "postgresql:"].includes(db.protocol) ||
    db.pathname !== "/postgres" ||
    !db.password ||
    db.port !== "5432" ||
    db.hash ||
    db.search ||
    !(
      (env.DATABASE_CONNECTION_MODE === "direct" &&
        db.hostname === `db.${target.supabaseProjectRef}.supabase.co` &&
        db.username === "docked_beta_app") ||
      (env.DATABASE_CONNECTION_MODE === "session" &&
        /^aws-[0-9]+-ap-southeast-2\.pooler\.supabase\.com$/.test(
          db.hostname,
        ) &&
        db.username === `docked_beta_app.${target.supabaseProjectRef}`)
    )
  )
    fail();
  for (const flag of privatePreviewDisabledFlags)
    if (env[flag] !== "false") fail();
  for (const [key, value] of Object.entries(env))
    if (
      value &&
      /^(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|MICROSOFT_|GRAPH_|SMTP_)/.test(
        key,
      )
    )
      fail();
  if (
    nfl &&
    (nfl.projectRef !== target.supabaseProjectRef ||
      nfl.vercelProjectId !== target.projectId)
  )
    fail();
  // This first target supports closed deployment verification. Admission remains
  // closed until the separate invitation delivery and identity setup is verified.
  for (const flag of [
    "BETA_ACCESS_ENABLED",
    "BETA_TESTERS_ENABLED",
    "AUTH_EMAIL_ENABLED",
    "DOCKED_AUTH_INVITES_READY",
    "FANTASY_FREE_PLAY_PRODUCTION",
  ])
    if (
      env[flag] !== (nfl && flag === "BETA_ACCESS_ENABLED" ? "true" : "false")
    )
      fail();
  return true;
}

export function privatePreviewOrigin(env) {
  if (!assertPrivatePreview(env)) throw Error("Private Preview required");
  return target.origin;
}
