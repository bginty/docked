/** App UI context only: never grants identity, region, or tester permissions. */
export function isPendingEmailChange(params: URLSearchParams) {
  // Supabase's PKCE first-confirmation response has no session/code. This
  // untrusted query can select instructions only; it never proves verification.
  return (
    !params.has("code") &&
    !params.has("error") &&
    !params.has("error_code") &&
    params.get("message") ===
      "Confirmation link accepted. Please proceed to confirm link sent to the other email"
  );
}

export function appAuthCallbackDestination(next: string | null) {
  if (next === "/app/reset-password") return next;
  if (next === "/app/verified") return next;
  if (next === "/reset-password") return next;
  return "/dashboard";
}

export const appSports = [
  ["football", "Football"],
  ["nfl", "NFL"],
  ["basketball", "NBA / basketball"],
  ["afl", "AFL"],
  ["tennis", "Tennis"],
  ["cricket", "Cricket"],
  ["horse-racing", "Racing"],
] as const;
