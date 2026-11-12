// Existing free Preview only. This does not authorise public Production signup.
const ref = "bckkllmndoxzpzdqrevb";
/** Existing-account SMS acceptance only; never a signup or production bypass. */
export function isolatedPhoneTestIdentity(env, userId, now = Date.now()) {
  if (env.DOCKED_ISOLATED_PHONE_TEST !== "true") return false;
  if (!assertIsolatedPublicPreview(env, now)) return false;
  return env.DOCKED_ISOLATED_PHONE_MEMBERS.split(",").includes(userId);
}
/** Exact, expiring operator-authorised external recipient; never public signup. */
export function isolatedExternalEmailRecipient(env, email, now = Date.now()) {
  if (!assertIsolatedPublicPreview(env) || env.AUTH_EMAIL_ENABLED !== "true")
    return false;
  const until = Date.parse(env.DOCKED_ISOLATED_EMAIL_UNTIL ?? "");
  const allowed = env.DOCKED_ISOLATED_EMAIL_RECIPIENT ?? "";
  return (
    Number.isFinite(until) &&
    until > now &&
    until <= now + 86400000 &&
    /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(allowed) &&
    allowed.length <= 254 &&
    typeof email === "string" &&
    email.toLowerCase() === allowed.toLowerCase()
  );
}

export function isolatedCustomerEmailEnabled(env) {
  return isolatedExternalEmailRecipient(
    env,
    env.DOCKED_ISOLATED_EMAIL_RECIPIENT,
  );
}
/** Read projections only; this never permits a receipt, purchase or opening. */
export function isolatedPreviewReadOnlyIdentity(env, email) {
  return (
    assertIsolatedPublicPreview(env) &&
    (/^docked-preview-public-(member|deletion)-[a-f0-9]+@example\.invalid$/.test(
      email ?? "",
    ) ||
      isolatedExternalEmailRecipient(env, email))
  );
}
/** @param {Record<string,string|undefined>} env */
export function assertIsolatedPublicPreview(env, now = Date.now()) {
  if (!env.DOCKED_ISOLATED_PUBLIC || env.DOCKED_ISOLATED_PUBLIC === "false")
    return false;
  const fail = () => {
    throw Error("Isolated public acceptance target mismatch");
  };
  const phoneTest = env.DOCKED_ISOLATED_PHONE_TEST === "true";
  const billingTest = env.DOCKED_ISOLATED_GOOGLE_TEST === "true";
  if (
    env.DOCKED_ISOLATED_PHONE_TEST &&
    !["true", "false"].includes(env.DOCKED_ISOLATED_PHONE_TEST)
  )
    fail();
  if (phoneTest) {
    const until = Date.parse(env.DOCKED_ISOLATED_PHONE_UNTIL ?? "");
    const members = (env.DOCKED_ISOLATED_PHONE_MEMBERS ?? "").split(",");
    if (
      !Number.isFinite(until) ||
      until <= now ||
      until > now + 6 * 3600000 ||
      members.length !== 2 ||
      new Set(members).size !== 2 ||
      members.some(
        (id) =>
          !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
            id,
          ),
      ) ||
      env.DOCKED_PUBLIC_PHONE_OTP !== "true" ||
      (env.DOCKED_PUBLIC_PHONE_POLICY_REFERENCE?.trim().length ?? 0) < 16 ||
      env.DOCKED_ISOLATED_GOOGLE_TEST !== "false"
    )
      fail();
  }
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
    !["true", "false"].includes(env.REGISTRATION_ENABLED ?? "") ||
    ((phoneTest || billingTest) && env.REGISTRATION_ENABLED !== "false") ||
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
