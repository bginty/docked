import { localPreviewAuth } from "./preview-auth";
import { previewCommunityContext } from "./preview-community";
import { assertHostedBeta, betaPolicyVersions } from "./hosted-beta.mjs";

type Environment = Record<string, string | undefined>;
export type ConsentVersions = { terms: string; privacy: string };
const previewConsentVersion = "2026-10-draft";

function approvedVersion(value: string | undefined) {
  return (
    !!value &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$/.test(value) &&
    !/(draft|preview|fixture|pending|unapproved|placeholder)/i.test(value)
  );
}

/** Deployment values identify owner-approved documents; they do not establish legal review by themselves. */
export function currentConsentVersions(
  env: Environment = process.env,
): ConsentVersions {
  if (env.DOCKED_BETA_STAGING === "true") {
    if (!assertHostedBeta(env))
      throw Error("Verified beta environment required");
    const versions = betaPolicyVersions();
    if (!versions) throw Error("Approved beta policy versions are required");
    return { terms: versions.terms, privacy: versions.privacy };
  }
  if (env.APP_ENV !== "production")
    return { terms: previewConsentVersion, privacy: previewConsentVersion };
  if (
    env.LEGAL_ENTITY_VERIFIED !== "true" ||
    !approvedVersion(env.TERMS_VERSION) ||
    !approvedVersion(env.PRIVACY_POLICY_VERSION)
  )
    throw Error("Approved production Terms and Privacy versions are required");
  return { terms: env.TERMS_VERSION!, privacy: env.PRIVACY_POLICY_VERSION! };
}

export function productionAuthRequestDenial(
  action: string,
  invitationCode: string | undefined,
  env: Environment = process.env,
) {
  if (env.APP_ENV !== "production") return null;
  if (env.DOCKED_RELEASE_CHANNEL === "beta" && action === "signup")
    return "Docked Beta is invitation-only. Open your invitation email to create your account.";
  if (action === "signup" && invitationCode)
    return "Preview invitations cannot create production accounts.";
  if (
    ["signup", "recover", "resend"].includes(action) &&
    env.AUTH_EMAIL_ENABLED !== "true"
  )
    return "Account email is not enabled. No verification or recovery email has been sent.";
  return null;
}

/** Safe UI projection. The API still independently checks database registration authority. */
export function authUiReadiness(
  env: Environment,
  registrationApproved = false,
) {
  const production = env.APP_ENV === "production";
  const liveBeta = production && env.DOCKED_RELEASE_CHANNEL === "beta";
  let policyVersions: ConsentVersions | null = null;
  try {
    policyVersions = currentConsentVersions(env);
  } catch {
    /* Remain closed. */
  }
  let invitationAllowed = false;
  try {
    invitationAllowed = !!previewCommunityContext(env);
  } catch {
    /* Invalid preview binding never grants access. */
  }
  const emailAvailable = production
    ? env.AUTH_EMAIL_ENABLED === "true"
    : localPreviewAuth(env);
  const registrationAvailable =
    !liveBeta &&
    emailAvailable &&
    env.REGISTRATION_ENABLED === "true" &&
    registrationApproved &&
    !!policyVersions;
  return {
    production,
    liveBeta,
    registrationAvailable,
    emailAvailable,
    invitationAllowed,
    policyVersions,
    reason: registrationAvailable
      ? null
      : !policyVersions
        ? "Public registration awaits approved Terms and Privacy documents."
        : !emailAvailable
          ? "Account verification and recovery email are not enabled."
          : "Public registration is not open yet.",
  };
}

export function explicitSignupConsent(input: {
  age?: boolean;
  terms?: boolean;
  privacy?: boolean;
}) {
  return input.age === true && input.terms === true && input.privacy === true;
}

export function legalConsentRequired(
  input: {
    ageAttested: boolean;
    termsVersion?: string | null;
    privacyGranted: boolean;
    privacyVersion?: string | null;
  },
  versions: ConsentVersions,
  production: boolean,
) {
  return (
    !input.ageAttested ||
    !input.termsVersion ||
    !input.privacyGranted ||
    (production &&
      (input.termsVersion !== versions.terms ||
        input.privacyVersion !== versions.privacy))
  );
}

/** Only a claimed handle race is recoverable; unrelated integrity failures must roll back. */
export function signupHandleCollision(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const failure = error as {
    code?: string;
    constraint_name?: string;
    constraint?: string;
    message?: string;
  };
  return (
    (failure.code === "23505" &&
      (failure.constraint_name ?? failure.constraint) ===
        "social_profiles_handle_key") ||
    (failure.code === "P0001" && failure.message === "Handle is reserved")
  );
}
