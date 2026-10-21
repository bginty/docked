import type { SupabaseClient } from "@supabase/supabase-js";
import { previewParticipantMatches } from "./preview-owner";
import { mfaFlow } from "./mfa-service";
import { passwordResetFailure } from "./auth-policy";

/** Closed Preview bootstrap. This proves owner identity/MFA but grants no role,
 * consent, admission, inventory or access to application data. */
export async function previewOwnerAuth(
  auth: SupabaseClient["auth"],
  input: {
    action: string;
    email?: string;
    password?: string;
    code?: string;
    next?: string;
  },
  env: Record<string, string | undefined>,
): Promise<{
  error?: string;
  ok?: boolean;
  mode?: string;
  redirect?: string;
  qrCode?: string;
  setupKey?: string;
}> {
  const denied = {
    error: "Private Preview setup is unavailable for this account.",
  };
  if (
    ![
      "login",
      "logout",
      "reset",
      "mfa_status",
      "mfa_enroll",
      "mfa_verify",
    ].includes(input.action)
  )
    return denied;
  if (input.action === "logout") {
    const { error } = await auth.signOut({ scope: "local" });
    return error
      ? { error: "Sign-out could not be confirmed. Please retry." }
      : { ok: true, redirect: "/app/login" };
  }
  if (input.action === "login") {
    if (
      !input.email ||
      ![
        "support@docked.com.au",
        ...(env.DOCKED_MULTI_SPORT_SANDBOX === "true" &&
        env.DOCKED_PREVIEW_TESTER_ID &&
        env.DOCKED_PREVIEW_TESTER_EMAIL
          ? [env.DOCKED_PREVIEW_TESTER_EMAIL]
          : []),
      ].includes(input.email.toLowerCase()) ||
      !input.password ||
      env.DOCKED_PREVIEW_OWNER_EMAIL !== "support@docked.com.au"
    )
      return denied;
    const { data, error } = await auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (error || !previewParticipantMatches(data.user, env)) {
      await auth.signOut({ scope: "local" });
      return {
        error: "Sign-in failed. Check credentials and email verification.",
      };
    }
    return { ok: true, redirect: "/mfa" };
  }
  const { data, error } = await auth.getUser();
  if (error || !previewParticipantMatches(data.user, env)) return denied;
  if (input.action === "reset") {
    if (!input.password) return { error: "Password required" };
    // Existing owners with an enrolled factor must satisfy MFA before changing
    // their password. Initial invitation setup has no factor yet.
    const assurance = await auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || !assurance.data) return denied;
    if (
      assurance.data.nextLevel === "aal2" &&
      assurance.data.currentLevel !== "aal2"
    )
      return { ok: true, redirect: "/mfa?next=/app/reset-password" };
    const changed = await auth.updateUser({ password: input.password });
    return changed.error
      ? { error: passwordResetFailure(changed.error) }
      : { ok: true, redirect: "/mfa" };
  }
  const result = await mfaFlow(auth, input.action, input.code, input.next);
  return "mode" in result && result.mode === "verified"
    ? {
        ...result,
        redirect:
          input.next === "/app/reset-password"
            ? input.next
            : env.DOCKED_MULTI_SPORT_SANDBOX === "true" &&
                data.user.id === env.DOCKED_PREVIEW_TESTER_ID
              ? "/app/sports-preview"
              : "/app/preview-owner",
      }
    : result;
}
