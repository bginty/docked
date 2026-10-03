export const dockedPreviewProjectRef = "bckkllmndoxzpzdqrevb";
export const dockedPreviewOrigin = `https://${dockedPreviewProjectRef}.supabase.co`;
export const previewCaptureSite = "http://localhost:3000";
const day = 86400000;
type Environment = Record<string, string | undefined>;
const reservedEmail =
  /^docked-preview-[a-z0-9][a-z0-9-]{0,63}@example[.]invalid$/;
export function previewRecipient(email: string | undefined) {
  return !!email && email === email.toLowerCase() && reservedEmail.test(email);
}
export function previewDatabaseBound(env: Environment) {
  try {
    const database = new URL(env.DATABASE_URL ?? "");
    if (
      !["postgres:", "postgresql:"].includes(database.protocol) ||
      database.pathname !== "/postgres" ||
      !database.password ||
      database.hash ||
      database.port !== "5432"
    )
      return false;
    for (const [name, value] of database.searchParams)
      if (name !== "sslmode" || !["require", "verify-full"].includes(value))
        return false;
    const user = decodeURIComponent(database.username);
    return (
      (env.DATABASE_CONNECTION_MODE === "direct" &&
        database.hostname === `db.${dockedPreviewProjectRef}.supabase.co` &&
        user === "postgres") ||
      (env.DATABASE_CONNECTION_MODE === "session" &&
        /^aws-[0-9]+-ap-southeast-2[.]pooler[.]supabase[.]com$/.test(
          database.hostname,
        ) &&
        user === `postgres.${dockedPreviewProjectRef}`)
    );
  } catch {
    return false;
  }
}
export function referencesDockedPreviewProject(env: Environment) {
  try {
    if (
      new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname ===
      `${dockedPreviewProjectRef}.supabase.co`
    )
      return true;
  } catch {
    /* Missing/malformed URL is handled by configuration validation. */
  }
  try {
    const url = new URL(env.DATABASE_URL ?? "");
    return (
      url.hostname === `db.${dockedPreviewProjectRef}.supabase.co` ||
      decodeURIComponent(url.username) === `postgres.${dockedPreviewProjectRef}`
    );
  } catch {
    return false;
  }
}
export function hostedPreviewEnvironmentBound(env: Environment) {
  if (
    env.APP_ENV !== "preview" ||
    env.SUPABASE_ENV !== "preview" ||
    env.PREVIEW_AUTH_CAPTURE_MODE !== "verified_db_hook" ||
    env.PREVIEW_AUTH_PROJECT_REF !== dockedPreviewProjectRef ||
    env.SITE_URL !== previewCaptureSite ||
    !previewDatabaseBound(env)
  )
    return false;
  try {
    const auth = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return (
      auth.origin === dockedPreviewOrigin &&
      auth.pathname === "/" &&
      !auth.search &&
      !auth.hash &&
      !auth.username &&
      !auth.password
    );
  } catch {
    return false;
  }
}
export function localPreviewAuth(env: Environment) {
  if (env.APP_ENV === "production") return false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return (
      ["http:", "https:"].includes(url.protocol) &&
      ["localhost", "127.0.0.1"].includes(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
/** No token hash or authentication secret is included in this readiness projection. */
export type PreviewCaptureReadiness = {
  databaseNow: string;
  enabled: boolean;
  projectRef: string;
  siteUrl: string;
  configuredAt: string;
  configurationExpiresAt: string;
  hookVerifiedAt: string | null;
  hookVerifiedEventId: string | null;
  hookFunctionSha256: string | null;
  actualFunctionSha256: string | null;
  recipientEmail: string;
  recipientApprovedAt: string;
  recipientExpiresAt: string;
  recipientRevokedAt: string | null;
  proofId: string;
  proofEmail: string;
  proofAction: string;
  proofRedirect: string;
  proofReceivedAt: string;
  proofExpiresAt: string;
  proofRecipientApprovedAt: string;
  proofRecipientExpiresAt: string;
  proofRecipientRevokedAt: string | null;
  signupRedirectAllowed: boolean;
  recoveryRedirectAllowed: boolean;
};
const time = (value: string | null) =>
  value && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
export function hostedPreviewCaptureReady(
  email: string | undefined,
  env: Environment,
  proof: PreviewCaptureReadiness | null,
) {
  if (
    !hostedPreviewEnvironmentBound(env) ||
    !previewRecipient(email) ||
    !proof ||
    !proof.enabled ||
    proof.projectRef !== dockedPreviewProjectRef ||
    proof.siteUrl !== previewCaptureSite ||
    proof.recipientEmail !== email ||
    proof.recipientRevokedAt !== null ||
    proof.proofRecipientRevokedAt !== null ||
    !proof.signupRedirectAllowed ||
    !proof.recoveryRedirectAllowed
  )
    return false;
  const now = time(proof.databaseNow),
    configured = time(proof.configuredAt),
    expires = time(proof.configurationExpiresAt),
    verified = time(proof.hookVerifiedAt),
    approved = time(proof.recipientApprovedAt),
    recipientExpires = time(proof.recipientExpiresAt),
    received = time(proof.proofReceivedAt),
    proofExpires = time(proof.proofExpiresAt),
    proofApproved = time(proof.proofRecipientApprovedAt),
    proofRecipientExpires = time(proof.proofRecipientExpiresAt);
  if (
    ![
      now,
      configured,
      expires,
      verified,
      approved,
      recipientExpires,
      received,
      proofExpires,
      proofApproved,
      proofRecipientExpires,
    ].every(Number.isFinite)
  )
    return false;
  if (
    configured > now ||
    expires <= now ||
    expires > configured + day ||
    verified < configured ||
    verified > now ||
    approved > now ||
    recipientExpires <= now ||
    recipientExpires > approved + day ||
    proofApproved > received ||
    proofRecipientExpires <= now ||
    proofRecipientExpires > proofApproved + day
  )
    return false;
  if (
    received < configured ||
    received > verified ||
    proofExpires <= now ||
    proofExpires > received + 1800000 ||
    proofExpires > expires ||
    proofExpires > proofRecipientExpires
  )
    return false;
  return (
    /^[a-f0-9]{64}$/.test(proof.hookFunctionSha256 ?? "") &&
    proof.hookFunctionSha256 === proof.actualFunctionSha256 &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      proof.proofId,
    ) &&
    proof.hookVerifiedEventId === proof.proofId &&
    previewRecipient(proof.proofEmail) &&
    ["signup", "recovery"].includes(proof.proofAction) &&
    proof.proofRedirect ===
      `${previewCaptureSite}/auth/callback${proof.proofAction === "recovery" ? "?next=/reset-password" : ""}`
  );
}
