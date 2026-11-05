import { currentConsentVersions } from "./auth-readiness";

/** A closed-registration existing-member form, not public registration or a
 * shortcut to gameplay/payments. Its approved public documents are independent
 * of the preserved beta namespace/consent configuration. */
export function publicMemberSetupConfiguration(
  env: Record<string, string | undefined> = process.env,
) {
  if (
    env.DOCKED_PUBLIC_MEMBER_SETUP !== "true" ||
    env.DOCKED_PUBLIC_MEMBER_SETUP_POLICY_APPROVED !== "true" ||
    env.LEGAL_ENTITY_VERIFIED !== "true"
  )
    return null;
  try {
    const versions = currentConsentVersions({
      ...env,
      APP_ENV: "production",
      DOCKED_BETA_STAGING: "false",
      TERMS_VERSION: env.DOCKED_PUBLIC_TERMS_VERSION,
      PRIVACY_POLICY_VERSION: env.DOCKED_PUBLIC_PRIVACY_VERSION,
    });
    return {
      versions,
      termsHref: "/commercial-policy" as const,
      privacyHref: "/privacy" as const,
    };
  } catch {
    return null;
  }
}
