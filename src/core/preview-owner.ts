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
