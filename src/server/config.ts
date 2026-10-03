export function config(env: Record<string, string | undefined> = process.env) {
  const production = env.APP_ENV === "production";
  if (production) {
    if (env.DEMO_MODE === "true" || env.SUPABASE_ENV !== "production")
      throw new Error("Production rejects demo/preview configuration");
    for (const key of [
      "DATABASE_URL",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
      "SITE_URL",
    ])
      if (!env[key]) throw new Error(`Missing ${key}`);
    if (
      !env.SITE_URL?.startsWith("https://") ||
      env.LEGAL_ENTITY_VERIFIED !== "true"
    )
      throw new Error("Production legal/HTTPS gate pending");
  }
  if (
    env.ADS_ENABLED === "true" ||
    env.AFFILIATES_ENABLED === "true" ||
    env.PAID_PLANS_ENABLED === "true" ||
    env.PRO_ENTITLEMENTS_ENABLED === "true" ||
    env.COMPETITIONS_ENABLED === "true" ||
    env.PRIZES_ENABLED === "true" ||
    env.DEALS_ENABLED === "true"
  )
    throw new Error(
      "Monetisation requires a reviewed implementation and fresh opt-in",
    );
  return {
    production,
    environment: env.APP_ENV ?? "preview",
    siteUrl: env.SITE_URL ?? "http://localhost:3000",
    database: !!env.DATABASE_URL,
    auth:
      !!env.NEXT_PUBLIC_SUPABASE_URL &&
      !!env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    registration: env.REGISTRATION_ENABLED === "true",
    publication: env.PUBLICATION_ENABLED === "true",
    paper: env.FORWARD_PAPER_ENABLED === "true",
    sending: production && env.SENDING_ENABLED === "true",
  };
}
