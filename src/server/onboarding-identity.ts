import "server-only";
import { cache } from "react";
import { authClient, identity } from "./auth";
import { db } from "./db";
import { publicCustomersEnabled } from "../core/public-customer";
import {
  authSessionsRelation,
  authUsersRelation,
} from "../core/auth-relations";
import {
  conclusiveAuthFailure,
  isEmailOwnershipVerified,
  onboardingMfaRequired,
  verifiedSessionClaims,
} from "../core/auth-policy";

/** Account setup alone can authenticate before its public profile exists.
 * Normal gameplay, wallets and staff APIs still require profile-backed identity().
 * This never creates an Auth identity or changes account/security privileges. */
export const onboardingIdentity = cache(async function onboardingIdentity() {
  if (!publicCustomersEnabled()) return identity();
  const client = await authClient();
  if (!client) return null;
  const { data, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    if (conclusiveAuthFailure(sessionError)) return null;
    throw Error("Authentication service temporarily unavailable");
  }
  const token = data.session?.access_token;
  if (!token) return null;
  const { data: verified, error } = await client.auth.getUser(token);
  if (error) {
    if (conclusiveAuthFailure(error)) return null;
    throw Error("Authentication service temporarily unavailable");
  }
  const user = verified.user;
  if (!user || user.is_anonymous || !isEmailOwnershipVerified(user))
    return null;
  const claims = verifiedSessionClaims(token, user.id);
  if (!claims) return null;
  const sql = db();
  const [active] =
    await sql`select s.id from ${sql.unsafe(authSessionsRelation())} s
    join ${sql.unsafe(authUsersRelation())} u on u.id=s.user_id
    where s.id=${claims.sessionId} and s.user_id=${user.id}
    and (s.not_after is null or s.not_after>clock_timestamp())
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
    and (u.banned_until is null or u.banned_until<=clock_timestamp())`;
  if (!active) return null;
  const [profile] =
    await sql`select * from public.profiles where id=${user.id}`;
  if (profile?.disabled_at) return null;
  const roles = await sql`select 1 from private.roles where user_id=${user.id}`;
  // Existing verified authenticators retain their challenge even if a legacy
  // account has not yet created an ordinary public profile/role projection.
  const mfaRequired = onboardingMfaRequired(roles.length > 0, user.factors);
  return {
    user,
    profile: profile ?? null,
    mfaRequired,
    aal: claims.aal,
    sessionId: claims.sessionId,
    authenticatedAt: claims.authenticatedAt,
  };
});

export async function requireOnboardingIdentity() {
  const who = await onboardingIdentity();
  if (!who) throw Error("Authentication required");
  if (who.mfaRequired && who.aal !== "aal2")
    throw Error("Privileged MFA required");
  return who;
}
