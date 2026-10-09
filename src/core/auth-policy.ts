export const staffRoles = [
  "owner",
  "admin",
  "analyst",
  "editor",
  "auditor",
] as const;

/** Provider errors are not interchangeable: MFA does not invalidate recovery. */
export function passwordResetFailure(error: { code?: string; name?: string }) {
  if (error.code === "insufficient_aal")
    return "Verify your existing authenticator at /mfa in this browser, then return to this password page. You do not need another recovery email.";
  if (error.code === "same_password")
    return "Choose a password different from your current password.";
  if (error.code === "weak_password")
    return "Choose a stronger password with at least 12 characters.";
  if (error.name === "AuthSessionMissingError" ||
      ["session_not_found", "refresh_token_not_found", "bad_jwt"].includes(error.code ?? ""))
    return "Your recovery session is unavailable. Use the same browser where you requested the email, or contact support.";
  return "The password update was not confirmed. Contact support before requesting another recovery email.";
}
export type StaffRole = (typeof staffRoles)[number];
export const operationRoles = {
  read_operations: [...staffRoles],
  publish: ["owner", "admin", "analyst"],
  edit_article: ["owner", "admin", "editor"],
  strategy_transition: ["owner", "admin"],
  correct_settlement: ["owner", "admin"],
} as const;
export function staffAllowed(
  role: string,
  aal: string,
  operation: keyof typeof operationRoles,
) {
  return (
    aal === "aal2" &&
    (operationRoles[operation] as readonly string[]).includes(role)
  );
}
/** Parse only after the exact token has been verified with Auth.getUser(token). */
export function verifiedSessionClaims(token: string, userId: string) {
  try {
    const claims = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );
    if (
      claims.sub !== userId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        claims.session_id ?? "",
      ) ||
      !["aal1", "aal2"].includes(claims.aal)
    )
      return null;
    return {
      sessionId: claims.session_id as string,
      aal: claims.aal as string,
    };
  } catch {
    return null;
  }
}
/** An administrator/invitation confirmation is access provisioning, not proof of email ownership. */
export function isEmailOwnershipVerified(
  user:
    | {
        email_confirmed_at?: string | null;
        app_metadata?: Record<string, unknown>;
      }
    | null
    | undefined,
) {
  return (
    !!user?.email_confirmed_at &&
    user.app_metadata?.email_ownership_verified !== false &&
    user.app_metadata?.preview_invitation_confirmed !== true
  );
}

/** Only an explicit authentication rejection means signed out; outages are unknown. */
export function conclusiveAuthFailure(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const failure = error as { name?: string; status?: number; code?: string };
  if (
    failure.name === "AuthRetryableFetchError" ||
    !failure.status ||
    failure.status >= 500 ||
    failure.status === 429
  )
    return false;
  if (failure.name === "AuthSessionMissingError") return true;
  if (failure.status === 401 || failure.status === 403) return true;
  return (
    failure.status === 400 &&
    [
      "refresh_token_not_found",
      "refresh_token_already_used",
      "session_not_found",
      "bad_jwt",
      "user_not_found",
    ].includes(failure.code ?? "")
  );
}
