import { z } from "zod";
import { signupUsername } from "./preview-testers";
import { isEmailOwnershipVerified } from "./auth-policy";

export const invitationSetup = z.object({
  username: signupUsername,
  country: z.string().regex(/^[A-Z]{2}$/),
  state: z.string().trim().min(1).max(50),
  age: z.literal(true),
  terms: z.literal(true),
  privacy: z.literal(true),
  marketing: z.boolean().optional(),
});
// Use only a fresh Auth.getUser result, never a client body or user_metadata.
export function verifiedInvitedUser(
  user: {
    invited_at?: string;
    email_confirmed_at?: string;
    is_anonymous?: boolean;
    app_metadata?: Record<string, unknown>;
  } | null,
) {
  return (
    !!user?.invited_at && !user.is_anonymous && isEmailOwnershipVerified(user)
  );
}
