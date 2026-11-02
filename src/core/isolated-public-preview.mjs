// Existing free Preview only. This does not authorise public Production signup.
const ref = "bckkllmndoxzpzdqrevb";
/** @param {Record<string,string|undefined>} env */
export function assertIsolatedPublicPreview(env) {
  if (!env.DOCKED_ISOLATED_PUBLIC || env.DOCKED_ISOLATED_PUBLIC === "false")
    return false;
  const fail = () => {
    throw Error("Isolated public acceptance target mismatch");
  };
  if (
    env.DOCKED_ISOLATED_PUBLIC !== "true" ||
    env.VERCEL !== "1" ||
    env.VERCEL_ENV !== "preview" ||
    (env.VERCEL_TARGET_ENV && env.VERCEL_TARGET_ENV !== "preview") ||
    env.VERCEL_PROJECT_ID !== "prj_C3thcg7PjP1Bnn4kR3rk4oRFegYR" ||
    env.VERCEL_ORG_ID !== "team_tf6xweKKyVCj9bTppUKttJ4l" ||
    env.APP_ENV !== "preview" ||
    env.SUPABASE_ENV !== "preview" ||
    env.DOCKED_PUBLIC_CUSTOMERS !== "true" ||
    env.REGISTRATION_ENABLED !== "true" ||
    env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co` ||
    !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")
  )
    fail();
  if (
    !/^https:\/\/docked-preview-[a-z0-9-]+\.vercel\.app$/.test(
      env.SITE_URL ?? "",
    ) ||
    !/^docked-preview-[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL ?? "")
  )
    fail();
  for (const flag of [
    "DOCKED_BETA_STAGING",
    "DOCKED_PRIVATE_PREVIEW",
    "DOCKED_HOSTED_PRODUCTION",
    "DOCKED_HOSTED_REVIEW",
    "DOCKED_HOSTED_PREVIEW",
    "DOCKED_FRIENDS_BETA",
    "DOCKED_COMMERCIAL_CHECKOUT",
    "DOCKED_RETENTION_APPLY",
    "PRIZES_ENABLED",
    "COMPETITIONS_ENABLED",
    "PAID_PLANS_ENABLED",
    "SENDING_ENABLED",
    "PRO_ENTITLEMENTS_ENABLED",
    "DOCKED_OWNER_GAMEPLAY",
  ])
    if (env[flag] !== "false") fail();
  for (const name of [
    "DATABASE_URL",
    "DOCKED_COMMERCIAL_DATABASE_URL",
    "DOCKED_RETENTION_DATABASE_URL",
  ]) {
    if (!env[name] && name !== "DATABASE_URL") continue;
    let u;
    try {
      u = new URL(env[name] ?? "");
    } catch {
      return fail();
    }
    const user = decodeURIComponent(u.username);
    if (
      !u.password ||
      u.pathname !== "/postgres" ||
      u.port !== "5432" ||
      u.search ||
      u.hash ||
      !["postgres:", "postgresql:"].includes(u.protocol) ||
      !/^aws-[0-9]+-ap-southeast-2\.pooler\.supabase\.com$/.test(u.hostname) ||
      ![
        "docked_app",
        "docked_public_acceptance",
        "docked_isolated_commercial",
        "docked_isolated_retention",
      ].some((role) => user === `${role}.${ref}`)
    )
      fail();
    if (
      name === "DATABASE_URL" &&
      ![`docked_app.${ref}`, `docked_public_acceptance.${ref}`].includes(user)
    )
      fail();
  }
  // No privileged Auth key, mail-provider credential or live Google verifier in this web deployment.
  for (const name of Object.keys(env))
    if (
      env[name] &&
      /^(SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|DOCKED_GOOGLE_COMMERCIAL_PRIVATE_KEY|SMTP_PASSWORD|MICROSOFT_|GRAPH_)/.test(
        name,
      )
    )
      fail();
  return true;
}
