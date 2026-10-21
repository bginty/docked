/** Setup identity comes from verified operator configuration, never user metadata. */
export function previewOwnerMatches(
  user: {
    id: string;
    email?: string;
    email_confirmed_at?: string;
    is_anonymous?: boolean;
  } | null,
  env: Record<string, string | undefined>,
) {
  return (
    !!user &&
    env.DOCKED_PREVIEW_OWNER_EMAIL === "support@docked.com.au" &&
    !!user.email_confirmed_at &&
    !user.is_anonymous &&
    user.id === env.DOCKED_PREVIEW_OWNER_ID &&
    user.email?.toLowerCase() === env.DOCKED_PREVIEW_OWNER_EMAIL
  );
}

/** An explicitly configured Preview tester can authenticate for the isolated
 * laboratory only. This does not grant member admission or an administrator role. */
export function previewParticipantMatches(
  user: Parameters<typeof previewOwnerMatches>[0],
  env: Record<string, string | undefined>,
) {
  return (
    previewOwnerMatches(user, env) ||
    (!!user &&
      env.DOCKED_PRIVATE_PREVIEW === "true" &&
      env.DOCKED_MULTI_SPORT_SANDBOX === "true" &&
      !!env.DOCKED_PREVIEW_TESTER_ID &&
      !!env.DOCKED_PREVIEW_TESTER_EMAIL &&
      !!user.email_confirmed_at &&
      !user.is_anonymous &&
      user.id === env.DOCKED_PREVIEW_TESTER_ID &&
      user.email?.toLowerCase() === env.DOCKED_PREVIEW_TESTER_EMAIL)
  );
}
