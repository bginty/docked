/** Only a definitive provider session rejection permits local cookie removal.
 * Network errors, rate limits and MFA failures must preserve the browser session. */
export function rejectedSessionCookies(
  error: unknown,
  names: readonly string[],
  supabaseUrl: string,
) {
  if (!error || typeof error !== "object") return [];
  const value = error as { code?: string; status?: number; name?: string };
  if (
    value.name === "AuthRetryableFetchError" ||
    ![400, 401, 403].includes(value.status ?? 0) ||
    !(
      value.name === "AuthSessionMissingError" ||
      [
        "refresh_token_not_found",
        "refresh_token_already_used",
        "session_not_found",
        "session_expired",
        "bad_jwt",
        "user_not_found",
      ].includes(value.code ?? "")
    )
  )
    return [];
  const project = new URL(supabaseUrl).hostname.split(".")[0];
  if (!/^[a-zA-Z0-9-]+$/.test(project)) return [];
  const key = `sb-${project}-auth-token`;
  return names.filter(
    (name) =>
      name === key ||
      (name.startsWith(key + ".") && /^\d+$/.test(name.slice(key.length + 1))),
  );
}
