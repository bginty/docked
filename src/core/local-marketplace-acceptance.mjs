/** Explicit, nondeployable loopback profile. This changes target validation only:
 * real Auth, admission, MFA, database roles and transaction guards still run. */
/** @param {Record<string,string|undefined>} [env] */
export function localMarketplaceAcceptance(env = process.env) {
  if (!env.DOCKED_LOCAL_MARKETPLACE_ACCEPTANCE) return false;
  const fail = () => {
    throw Error("Invalid local marketplace acceptance configuration");
  };
  if (
    env.DOCKED_LOCAL_MARKETPLACE_ACCEPTANCE !== "true" ||
    env.NODE_ENV !== "development" ||
    env.VERCEL ||
    env.VERCEL_ENV ||
    env.VERCEL_URL ||
    env.NETLIFY ||
    env.DOCKED_HOSTED_PREVIEW === "true" ||
    env.DOCKED_HOSTED_PRODUCTION === "true" ||
    env.DOCKED_HOSTED_REVIEW === "true" ||
    env.SITE_URL !== "http://127.0.0.1:3033" ||
    env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:55321" ||
    env.APP_ENV !== "production" ||
    env.SUPABASE_ENV !== "production" ||
    env.DOCKED_BETA_STAGING !== "true" ||
    env.DOCKED_FRIENDS_BETA !== "true" ||
    env.DOCKED_OWNER_GAMEPLAY !== "true" ||
    env.BETA_ACCESS_ENABLED !== "true"
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
    db.protocol !== "postgresql:" ||
    db.hostname !== "127.0.0.1" ||
    db.port !== "55322" ||
    db.pathname !== "/postgres" ||
    db.username !== "docked_beta_app" ||
    !db.password ||
    db.search ||
    db.hash
  )
    fail();
  for (const key of [
    "REGISTRATION_ENABLED",
    "SENDING_ENABLED",
    "AUTH_EMAIL_ENABLED",
    "PAID_PLANS_ENABLED",
    "PRIZES_ENABLED",
    "COMPETITIONS_ENABLED",
    "ADS_ENABLED",
    "AFFILIATES_ENABLED",
    "DEALS_ENABLED",
    "DEMO_MODE",
  ])
    if (env[key] !== "false") fail();
  for (const key of Object.keys(env))
    if (
      /^(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|MICROSOFT_|GRAPH_|SMTP_)/.test(
        key,
      ) &&
      env[key]
    )
      fail();
  return true;
}
