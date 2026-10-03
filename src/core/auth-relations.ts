/** Fixed SQL identifiers only. Preview's existing schema is deliberately unchanged. */
export function authUsersRelation(
  env: Record<string, string | undefined> = process.env,
) {
  return env.APP_ENV === "production"
    ? "private.runtime_auth_users"
    : "auth.users";
}
export function authSessionsRelation(
  env: Record<string, string | undefined> = process.env,
) {
  return env.APP_ENV === "production"
    ? "private.runtime_auth_sessions"
    : "auth.sessions";
}
