export type PrivateAccountSummary = {
  maskedEmail: string | null;
  emailVerified: boolean | null;
  avatarUrl?: string | null;
  displayName?: string;
  staffRole?: string;
};
/** Only call with the authenticated owner's server-verified identity, never a public profile. */
export function privateAccountSummary(user: {
  email?: string;
  email_confirmed_at?: string | null;
}): PrivateAccountSummary {
  const email = user.email?.trim();
  const valid = email && /^[^\s@]+@[^\s@]+$/.test(email);
  return {
    maskedEmail: valid
      ? `${email[0]}••••@${email.slice(email.lastIndexOf("@") + 1)}`
      : null,
    emailVerified: !valid
      ? null
      : user.email_confirmed_at === undefined
        ? null
        : !!user.email_confirmed_at,
  };
}
