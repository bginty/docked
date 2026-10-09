import { dockedPreviewOrigin, previewDatabaseBound } from "./preview-auth";

type Environment = Record<string, string | undefined>;
export const hostedPreviewDisabledFlags = [
  "DEMO_MODE",
  "REGISTRATION_ENABLED",
  "PUBLICATION_ENABLED",
  "FORWARD_PAPER_ENABLED",
  "SENDING_ENABLED",
  "ADS_ENABLED",
  "AFFILIATES_ENABLED",
  "PAID_PLANS_ENABLED",
  "PRO_ENTITLEMENTS_ENABLED",
  "COMPETITIONS_ENABLED",
  "PRIZES_ENABLED",
  "DEALS_ENABLED",
  "ODDS_POLLING_ENABLED",
  "LEGAL_ENTITY_VERIFIED",
] as const;

/** Hosted preview is distinct from the deliberately loopback-only email-capture exception. */
export function assertHostedPreview(env: Environment) {
  if (
    env.DOCKED_HOSTED_PREVIEW &&
    !["true", "false"].includes(env.DOCKED_HOSTED_PREVIEW)
  )
    throw new Error("Unsupported hosted preview mode");
  if (env.DOCKED_HOSTED_PREVIEW !== "true") return;
  const fail = () => {
    throw new Error(
      "Hosted Docked Preview configuration must remain isolated and closed",
    );
  };
  if (env.AUTO_PUBLISH_DOCKED_EDGES === "true") fail();
  if (
    env.APP_ENV !== "preview" ||
    env.SUPABASE_ENV !== "preview" ||
    !previewDatabaseBound(env)
  )
    fail();
  let site: URL, auth: URL;
  try {
    site = new URL(env.SITE_URL ?? "");
    auth = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  } catch {
    return fail();
  }
  if (
    site.protocol !== "https:" ||
    site.origin !== env.SITE_URL ||
    [
      "localhost",
      "127.0.0.1",
      "[::1]",
      "docked.com.au",
      "www.docked.com.au",
    ].includes(site.hostname) ||
    site.hostname.endsWith(".localhost") ||
    site.hostname.endsWith(".local") ||
    site.port ||
    auth.origin !== dockedPreviewOrigin ||
    auth.pathname !== "/" ||
    auth.search ||
    auth.hash ||
    auth.username ||
    auth.password ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")
  )
    fail();
  for (const name of hostedPreviewDisabledFlags)
    if (env[name] !== "false") fail();
  if (
    env.MARKET_DATA_POLLING_ENABLED === "true" ||
    env.THE_ODDS_API_KEY?.trim() ||
    env.ODDSPAPI_API_KEY?.trim()
  )
    fail();
  for (const name of [
    "PREVIEW_AUTH_CAPTURE_MODE",
    "PREVIEW_AUTH_PROJECT_REF",
    "ODDS_API_KEY",
    "ODDS_RIGHTS_REFERENCE",
    "RESULTS_API_KEY",
    "RESULTS_RIGHTS_REFERENCE",
    "RESULTS_PROVIDER",
    "MARKET_REFERENCE_CONFIG_JSON",
    "EMAIL_API_KEY",
    "SMTP_PASSWORD",
    "PUSH_API_KEY",
    "STRIPE_SECRET_KEY",
  ])
    if (env[name]?.trim()) fail();
  for (const name of ["ODDS_PROVIDER_STATUS", "RESULTS_PROVIDER_STATUS"])
    if (env[name] && env[name] !== "NOT_CONFIGURED") fail();
  if (env.ODDS_MONTHLY_CREDIT_LIMIT && env.ODDS_MONTHLY_CREDIT_LIMIT !== "0")
    fail();
}
