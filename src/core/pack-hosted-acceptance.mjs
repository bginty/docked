/** Dedicated synthetic acceptance target. Never relaxes a Production target. */
export const packAcceptanceTarget = Object.freeze({
  projectId: "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR",
  teamId: "team_tf6xweKKyVCj9bTppUKttJ4l",
  projectRef: "bckkllmndoxzpzdqrevb",
  branch: "codex/batch1-pack-phone-20261116",
  databaseRole: "docked_pack_acceptance",
});
export const packAcceptanceDisabledFlags = Object.freeze([
  "DOCKED_FRIENDS_BETA",
  "DOCKED_PRIVATE_PREVIEW",
  "DOCKED_ISOLATED_PUBLIC",
  "DOCKED_HOSTED_PRODUCTION",
  "DOCKED_HOSTED_REVIEW",
  "DOCKED_HOSTED_PREVIEW",
  "DOCKED_LOCAL_MARKETPLACE_ACCEPTANCE",
  "DOCKED_PUBLIC_CUSTOMERS",
  "REGISTRATION_ENABLED",
  "AUTH_EMAIL_ENABLED",
  "SENDING_ENABLED",
  "PUBLICATION_ENABLED",
  "DOCKED_PUBLIC_PHONE_OTP",
  "DOCKED_ISOLATED_PHONE_TEST",
  "DOCKED_ISOLATED_GOOGLE_TEST",
  "DOCKED_COMMERCIAL_CHECKOUT",
  "DOCKED_COMMERCIAL_SERVICE",
  "DOCKED_COMMERCIAL_SURFACES",
  "DOCKED_COMMERCIAL_MARKETPLACE",
  "DOCKED_MEMBER_GOOGLE_TEST",
  "DOCKED_GOOGLE_RECONCILIATION_ENABLED",
  "DOCKED_V30_TRANSPORT",
  "DOCKED_RETENTION_SERVICE",
  "DOCKED_OPERATIONAL_ALERT_EMAIL",
  "DOCKED_NBA_PRIVATE_BETA",
  "DOCKED_MULTI_SPORT_SANDBOX",
  "DOCKED_CUSTOMER_ONBOARDING",
  "DOCKED_AUTH_INVITES_READY",
  "PROVIDER_TRIAL_ENABLED",
  "DOCKED_RETENTION_APPLY",
  "PRIZES_ENABLED",
  "COMPETITIONS_ENABLED",
  "PAID_PLANS_ENABLED",
  "PRO_ENTITLEMENTS_ENABLED",
  "DOCKED_BETA_TRADING",
  "DOCKED_PRIVATE_OFFERS_LOCAL",
  "DOCKED_REDEMPTION_LOCAL",
  "AUTO_PUBLISH_DOCKED_EDGES",
  "ODDS_POLLING_ENABLED",
  "MARKET_DATA_POLLING_ENABLED",
  "EDGE_SCANNER_ENABLED",
  "RESEARCH_AUTOMATION_ENABLED",
  "FORWARD_PAPER_ENABLED",
  "ADS_ENABLED",
  "AFFILIATES_ENABLED",
  "DEALS_ENABLED",
  "DEMO_MODE",
  "FANTASY_CARDS_PREVIEW",
]);
const uuid =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
/** @param {Record<string,string|undefined>} env */
export function assertPackHostedAcceptance(env, now = Date.now()) {
  if (!env.DOCKED_PACK_ACCEPTANCE || env.DOCKED_PACK_ACCEPTANCE === "false")
    return false;
  const fail = () => {
    throw Error("Isolated pack acceptance target denied");
  };
  const start = Date.parse(env.DOCKED_PACK_ACCEPTANCE_FROM ?? "");
  const until = Date.parse(env.DOCKED_PACK_ACCEPTANCE_UNTIL ?? "");
  const ids = (env.DOCKED_PACK_ACCEPTANCE_MEMBERS ?? "").split(",");
  const target = packAcceptanceTarget;
  if (
    env.DOCKED_PACK_ACCEPTANCE !== "true" ||
    env.VERCEL !== "1" ||
    env.VERCEL_ENV !== "preview" ||
    (env.VERCEL_TARGET_ENV && env.VERCEL_TARGET_ENV !== "preview") ||
    env.VERCEL_PROJECT_ID !== target.projectId ||
    env.VERCEL_ORG_ID !== target.teamId ||
    env.VERCEL_GIT_COMMIT_REF !== target.branch ||
    !/^[a-f0-9]{40}$/.test(env.VERCEL_GIT_COMMIT_SHA ?? "") ||
    !/^docked-preview-[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? "") ||
    (env.SITE_URL && env.SITE_URL !== `https://${env.VERCEL_URL}`) ||
    env.APP_ENV !== "preview" ||
    env.SUPABASE_ENV !== "preview" ||
    env.DOCKED_RELEASE_CHANNEL !== "beta" ||
    env.DOCKED_BETA_STAGING !== "true" ||
    env.BETA_ACCESS_ENABLED !== "true" ||
    env.DOCKED_OWNER_GAMEPLAY !== "true" ||
    env.DOCKED_TEST_MARKET_READ_ONLY !== "true" ||
    env.DOCKED_SPORTS_TEST_COMMERCE !== "true" ||
    env.DOCKED_SPORTS_PRIVATE_BETA !== "true" ||
    env.DATABASE_RUNTIME !== "serverless" ||
    env.DATABASE_CONNECTION_MODE !== "session" ||
    env.NEXT_PUBLIC_SUPABASE_URL !==
      `https://${target.projectRef}.supabase.co` ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_") ||
    !Number.isFinite(start) ||
    !Number.isFinite(until) ||
    start > now ||
    until <= now ||
    until - start > 86400000 ||
    ids.length !== 2 ||
    new Set(ids).size !== 2 ||
    ids.some((id) => !uuid.test(id)) ||
    env.NETLIFY ||
    env.PREVIEW_AUTH_CAPTURE_MODE ||
    env.PREVIEW_AUTH_PROJECT_REF
  )
    fail();
  for (const flag of packAcceptanceDisabledFlags)
    if (env[flag] !== "false") fail();
  let db;
  try {
    db = new URL(env.DATABASE_URL ?? "");
  } catch {
    fail();
  }
  if (
    !db ||
    !["postgres:", "postgresql:"].includes(db.protocol) ||
    !db.password ||
    db.pathname !== "/postgres" ||
    db.port !== "5432" ||
    db.hash ||
    db.search ||
    !/^aws-\d+-ap-southeast-2\.pooler\.supabase\.com$/.test(db.hostname) ||
    decodeURIComponent(db.username) !==
      `${target.databaseRole}.${target.projectRef}`
  )
    fail();
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    if (
      key !== "DATABASE_URL" &&
      /(DATABASE_URL|DATABASE_PASSWORD|DATABASE_KEY)$/.test(key)
    )
      fail();
    if (
      /^(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|TWILIO_|MICROSOFT_|GRAPH_|SMTP_|DOCKED_GOOGLE_.*(?:KEY|SECRET|CREDENTIAL))/.test(
        key,
      )
    )
      fail();
    if (value.includes("pojoymtniryarxxunyvz")) fail();
  }
  return true;
}
/** Both the UUID allowlist and server-controlled metadata must match. */
export function packAcceptanceIdentity(env, user, now = Date.now()) {
  return (
    assertPackHostedAcceptance(env, now) &&
    !user.is_anonymous &&
    !!user.email_confirmed_at &&
    /^docked-batch1-[a-f0-9]{16}@example\.invalid$/.test(user.email ?? "") &&
    user.app_metadata?.docked_acceptance === "batch1-hosted-20261116" &&
    env.DOCKED_PACK_ACCEPTANCE_MEMBERS.split(",").includes(user.id)
  );
}
/** Only existing pack/collection surfaces and their static assets are exposed. */
export function packAcceptancePathAllowed(path, method) {
  if (
    ["GET", "HEAD"].includes(method) &&
    (/^\/(?:_next|brand|images|fonts|cards)\//.test(path) ||
      [
        "/favicon.ico",
        "/app/login",
        "/app/mfa",
        "/fantasy/cards",
        "/fantasy/test-wallet",
        "/api/fantasy/collection",
      ].includes(path))
  )
    return true;
  return (
    ["GET", "POST"].includes(method) &&
    ["/api/test-wallet", "/api/weekly-core"].includes(path)
  );
}
