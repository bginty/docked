import type { SupabaseClient } from "@supabase/supabase-js";
import { mfaDestination, resolveTotpFactor } from "./mfa-flow";

export async function mfaFlow(
  auth: SupabaseClient["auth"],
  action: string,
  code?: string,
  next?: string,
) {
  const {
    data: { user },
    error: userError,
  } = await auth.getUser();
  if (userError || !user) return { error: "Sign in first" };
  const { data, error } = await auth.mfa.listFactors();
  if (error)
    return { error: "Unable to check your authenticator. Please try again." };
  const factor = resolveTotpFactor(data.all);
  const { data: assurance, error: assuranceError } =
    await auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) return { error: "Unable to verify this session." };
  if (assurance.currentLevel === "aal2")
    return { ok: true, mode: "verified", redirect: mfaDestination(next) };
  if (action === "mfa_status")
    return { ok: true, mode: factor ? "challenge" : "enroll" };
  if (action === "mfa_enroll") {
    // Existing verified enrolment is never replaced, removed or exposed.
    if (factor) return { ok: true, mode: "challenge" };
    const result = await auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Docked authenticator",
    });
    if (result.error || !result.data)
      return {
        error:
          "Authenticator setup could not be started. Contact support if this continues.",
      };
    const qr = result.data.totp.qr_code;
    const qrCode = qr.startsWith("data:image/svg+xml;")
      ? qr
      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`;
    return {
      ok: true,
      mode: "enroll-code",
      qrCode,
      setupKey: result.data.totp.secret,
    };
  }
  if (!factor || !code || !/^\d{6}$/.test(code))
    return { error: "Enter the six-digit code from your authenticator." };
  const verified = await auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code,
  });
  if (verified.error)
    return {
      error:
        "That code could not be verified. Use the current code from your authenticator and try again.",
    };
  return { ok: true, mode: "verified", redirect: mfaDestination(next) };
}
