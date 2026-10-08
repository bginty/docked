import { productionDisabledFlags } from "./hosted-production.mjs";

// A credential-free application review is not an approved production runtime.
// This target cannot authenticate, send mail, query either database or promote.
export const reviewBranch = "codex/vercel-beta-review";
export const reviewProject = "prj_l0rpVDPRuIRp9UcBUkudeyUK5yST";
export const reviewDisabledFlags = Object.freeze([
  ...productionDisabledFlags,
  "REGISTRATION_ENABLED",
  "AUTH_EMAIL_ENABLED",
  "DOCKED_AUTH_INVITES_READY",
  "FANTASY_FREE_PLAY_PRODUCTION",
  "FANTASY_CARDS_PREVIEW",
  "LEGAL_ENTITY_VERIFIED",
]);

/** @param {Record<string,string|undefined>} env */
export function reviewOrigin(env) {
  const host = env.VERCEL_URL ?? "";
  if (!/^docked-production-[a-z0-9-]+\.vercel\.app$/.test(host))
    throw Error("Review deployment hostname required");
  return `https://${host}`;
}

/** @param {Record<string,string|undefined>} env */
export function assertHostedReview(env) {
  if (!env.DOCKED_HOSTED_REVIEW || env.DOCKED_HOSTED_REVIEW === "false")
    return false;
  if (
    env.DOCKED_HOSTED_REVIEW !== "true" ||
    env.VERCEL !== "1" ||
    env.VERCEL_ENV !== "preview" ||
    (env.VERCEL_TARGET_ENV && env.VERCEL_TARGET_ENV !== "preview") ||
    env.VERCEL_PROJECT_ID !== reviewProject ||
    env.VERCEL_GIT_COMMIT_REF !== reviewBranch ||
    !/^[a-f0-9]{40}$/i.test(env.VERCEL_GIT_COMMIT_SHA ?? "") ||
    env.APP_ENV !== "preview" ||
    env.SUPABASE_ENV !== "unconfigured" ||
    env.DOCKED_HOSTED_PRODUCTION !== "false" ||
    env.DOCKED_HOSTED_PREVIEW !== "false" ||
    env.NETLIFY ||
    env.SITE_ID ||
    env.PREVIEW_AUTH_CAPTURE_MODE ||
    env.PREVIEW_AUTH_PROJECT_REF
  )
    throw Error("Unreviewed credential-free deployment");
  const origin = reviewOrigin(env);
  if (env.SITE_URL && env.SITE_URL !== origin)
    throw Error("Review origin mismatch");
  for (const flag of reviewDisabledFlags)
    if (env[flag] !== "false")
      throw Error("Review capability must be disabled");
  for (const [key, value] of Object.entries(env)) {
    if (
      value &&
      ((/^(DATABASE_|NEXT_PUBLIC_SUPABASE_|SUPABASE_|MICROSOFT_|GRAPH_|SMTP_|PREVIEW_AUTH_)/.test(
        key,
      ) &&
        key !== "SUPABASE_ENV") ||
        /^(THE_ODDS_API_KEY|ODDSPAPI_API_KEY|ODDS_API_KEY|RESEND_API_KEY|SENDGRID_API_KEY|DOCKED_AUTH_EMAIL_|EMAIL_|SCANNER_WORKER_TOKEN|PROVIDER_TRIAL_OPERATOR_TOKEN)/.test(
          key,
        ))
    )
      throw Error("Review deployment cannot contain service credentials");
  }
  return true;
}
