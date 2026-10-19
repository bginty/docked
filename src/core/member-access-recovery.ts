/** Presentation/routing only. Identity and MFA must still pass server checks. */
export function memberReturnPath(value?: string | null): string | null {
  if (!value || value.length > 1500 || /[\\\x00-\x20]/.test(value)) return null;
  try {
    const url = new URL(value, "https://docked.invalid");
    if (
      !value.startsWith("/") ||
      value.startsWith("//") ||
      url.origin !== "https://docked.invalid"
    )
      return null;
    if (
      !/^\/fantasy\/(play|cards|market|social|profile|results|prizes|test-wallet)\/?$/.test(
        url.pathname,
      )
    )
      return null;
    return url.pathname + url.search + url.hash;
  } catch {
    return null;
  }
}
export type MemberAccessFailure =
  "authentication" | "mfa" | "permission" | "service";
export function memberAccessFailure(error: unknown): MemberAccessFailure {
  const message = error instanceof Error ? error.message : "";
  if (message === "Authentication required") return "authentication";
  if (message === "Privileged MFA required") return "mfa";
  if (["Role denied", "Permission denied", "Access denied"].includes(message))
    return "permission";
  return "service";
}
