import {
  reviewedHostingIdentity,
  productionHostCommit,
} from "./hosting-identity.mjs";
/**
 * Shared by the plain-Node build guard and server runtime. This public manifest
 * contains identifiers only; approval is not a substitute for deployed-secret
 * verification or the separately reviewed legal, Auth and database policies.
 * @typedef {Record<string, string | undefined>} Environment
 * @typedef {{schemaVersion?: number, approved?: boolean, origin?: string,
 * projectName?: string, vercelProjectId?: string | null, vercelTeamId?: string | null,
 * supabaseProjectRef?: string | null, supabaseOrganizationId?: string,
 * supabaseRegion?: string, databaseRole?: string, hostingProvider?: string,
 * netlifySiteId?: string | null, netlifyAccountId?: string | null, stagingOrigin?: string | null}} ProductionManifest
 */

export const productionDisabledFlags = Object.freeze([
  "DEMO_MODE",
  "ODDS_POLLING_ENABLED",
  "MARKET_DATA_POLLING_ENABLED",
  "EDGE_SCANNER_ENABLED",
  "PUBLICATION_ENABLED",
  "FORWARD_PAPER_ENABLED",
  "AUTO_PUBLISH_DOCKED_EDGES",
  "SENDING_ENABLED",
  "ADS_ENABLED",
  "AFFILIATES_ENABLED",
  "PAID_PLANS_ENABLED",
  "PRO_ENTITLEMENTS_ENABLED",
  "COMPETITIONS_ENABLED",
  "PRIZES_ENABLED",
  "DEALS_ENABLED",
]);
const previewRef = "bckkllmndoxzpzdqrevb";
const unrelatedRef = "dwdjeecjdkkiidoutnme";
const productionOrigin = "https://docked.com.au";
const commitPattern = /^[a-f0-9]{40}$/i;
/** The exact Netlify site URL is reviewed before controlled staging; no wildcard origins.
 * @param {Environment} env @param {ProductionManifest} manifest */
export function productionOriginBound(env, manifest) {
  if (!env.DOCKED_PRODUCTION_STAGE || env.DOCKED_PRODUCTION_STAGE === "live")
    return env.SITE_URL === productionOrigin;
  return (
    env.DOCKED_PRODUCTION_STAGE === "staging" &&
    manifest.hostingProvider === "netlify" &&
    /^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.netlify\.app$/.test(
      manifest.stagingOrigin ?? "",
    ) &&
    env.SITE_URL === manifest.stagingOrigin &&
    env.URL === manifest.stagingOrigin
  );
}
const privilegedRoles = new Set([
  "postgres",
  "supabase_admin",
  "service_role",
  "authenticator",
  "anon",
  "authenticated",
  "supabase_auth_admin",
  "supabase_storage_admin",
  "supabase_realtime_admin",
  "supabase_replication_admin",
  "dashboard_user",
  "pgbouncer",
]);
/** This validates reviewed configuration; database grants must independently verify least privilege. @param {string | undefined} role */
function applicationRole(role) {
  return (
    typeof role === "string" &&
    /^[a-z][a-z0-9_]{2,62}$/.test(role) &&
    !privilegedRoles.has(role)
  );
}

/** @param {Environment} env @param {string} ref */
function referencesProject(env, ref) {
  try {
    if (
      new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname ===
      `${ref}.supabase.co`
    )
      return true;
  } catch {
    /* A malformed production URL is rejected below. */
  }
  try {
    const database = new URL(env.DATABASE_URL ?? "");
    return (
      database.hostname === `db.${ref}.supabase.co` ||
      decodeURIComponent(database.username).endsWith(`.${ref}`)
    );
  } catch {
    return false;
  }
}

/** @param {Environment} env @param {ProductionManifest} manifest */
export function productionDeploymentRequested(env, manifest) {
  let productionHost = false;
  try {
    productionHost = ["docked.com.au", "www.docked.com.au"].includes(
      new URL(env.SITE_URL ?? "").hostname,
    );
  } catch {
    /* Invalid production configuration cannot pass the guard. */
  }
  return (
    env.DOCKED_HOSTED_PRODUCTION === "true" ||
    env.APP_ENV === "production" ||
    env.SUPABASE_ENV === "production" ||
    env.VERCEL_ENV === "production" ||
    env.NETLIFY === "true" ||
    Boolean(env.SITE_ID) ||
    productionHost ||
    (typeof manifest.supabaseProjectRef === "string" &&
      referencesProject(env, manifest.supabaseProjectRef)) ||
    (typeof manifest.vercelProjectId === "string" &&
      env.VERCEL_PROJECT_ID === manifest.vercelProjectId)
  );
}

/** @param {Environment} env @param {ProductionManifest} manifest */
export function productionDatabaseBound(env, manifest) {
  try {
    const ref = manifest.supabaseProjectRef;
    if (
      !ref ||
      !/^[a-z]{20}$/.test(ref) ||
      [previewRef, unrelatedRef].includes(ref) ||
      manifest.supabaseRegion !== "ap-southeast-2" ||
      !applicationRole(manifest.databaseRole)
    )
      return false;
    const database = new URL(env.DATABASE_URL ?? "");
    if (
      !["postgres:", "postgresql:"].includes(database.protocol) ||
      database.pathname !== "/postgres" ||
      !database.password ||
      database.hash ||
      database.port !== "5432"
    )
      return false;
    if ([...database.searchParams].length > 1) return false;
    for (const [key, value] of database.searchParams)
      if (key !== "sslmode" || !["require", "verify-full"].includes(value))
        return false;
    const user = decodeURIComponent(database.username);
    return (
      (env.DATABASE_CONNECTION_MODE === "direct" &&
        database.hostname === `db.${ref}.supabase.co` &&
        user === manifest.databaseRole) ||
      (env.DATABASE_CONNECTION_MODE === "session" &&
        /^aws-[0-9]+-ap-southeast-2[.]pooler[.]supabase[.]com$/.test(
          database.hostname,
        ) &&
        user === `${manifest.databaseRole}.${ref}`)
    );
  } catch {
    return false;
  }
}

/**
 * Community-only production authority. Stored provider credentials are inert:
 * no provider, scanner, publication, marketing or commercial activation is
 * permitted by this release. Transactional Auth readiness is gated separately.
 * @param {Environment} env
 * @param {ProductionManifest} manifest
 * @param {Record<string, any> | undefined} [build]
 */
export function assertHostedProduction(env, manifest, build) {
  if (
    env.DOCKED_HOSTED_PRODUCTION &&
    !["true", "false"].includes(env.DOCKED_HOSTED_PRODUCTION)
  )
    throw new Error("Unsupported hosted production mode");
  if (!productionDeploymentRequested(env, manifest)) return;
  if (env.PREVIEW_AUTH_CAPTURE_MODE || env.PREVIEW_AUTH_PROJECT_REF)
    throw new Error("Hosted preview capture cannot run in production");
  if (referencesProject(env, previewRef))
    throw new Error("Docked Preview cannot run in production mode");
  const fail = () => {
    throw new Error(
      "Docked production requires its reviewed isolated community-only deployment configuration",
    );
  };
  if (
    manifest.schemaVersion !== 1 ||
    manifest.approved !== true ||
    manifest.origin !== productionOrigin ||
    manifest.projectName !== "docked-production" ||
    !reviewedHostingIdentity(manifest) ||
    !/^[a-z]{20}$/.test(manifest.supabaseProjectRef ?? "") ||
    [previewRef, unrelatedRef].includes(manifest.supabaseProjectRef ?? "") ||
    manifest.supabaseOrganizationId !== "otldyeunbqabbcjydjpe" ||
    manifest.supabaseRegion !== "ap-southeast-2" ||
    !applicationRole(manifest.databaseRole)
  )
    fail();
  if (
    env.DOCKED_HOSTED_PRODUCTION !== "true" ||
    env.DOCKED_HOSTED_PREVIEW !== "false" ||
    env.APP_ENV !== "production" ||
    env.SUPABASE_ENV !== "production" ||
    !productionOriginBound(env, manifest) ||
    env.LEGAL_ENTITY_VERIFIED !== "true" ||
    env.NEXT_PUBLIC_SUPABASE_URL !==
      `https://${manifest.supabaseProjectRef}.supabase.co` ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_") ||
    !env.SUPABASE_SECRET_KEY?.startsWith("sb_secret_") ||
    !productionDatabaseBound(env, manifest)
  )
    fail();
  const deployedCommit = productionHostCommit(env, manifest, build);
  if (
    !deployedCommit ||
    (env.DOCKED_CODE_COMMIT &&
      (!commitPattern.test(env.DOCKED_CODE_COMMIT) ||
        env.DOCKED_CODE_COMMIT.toLowerCase() !== deployedCommit))
  )
    fail();
  for (const key of productionDisabledFlags) if (env[key] !== "false") fail();
  if (!["true", "false"].includes(env.REGISTRATION_ENABLED ?? "")) fail();
}
