import { invitationSetup } from "../core/invitation-setup";
import type { ConsentVersions } from "../core/auth-readiness";
import {
  persistInvitedProfile,
  type SignupTransaction,
} from "./signup-profile";

/** The caller supplies a read-only transaction on the ordinary restricted role.
 * Set only transaction-local claims; pooled connections must not leak identity.
 */
export async function readExistingMemberProfile(
  tx: SignupTransaction,
  actor: { userId: string; sessionId: string; aal: string },
  versions: ConsentVersions,
) {
  await tx.query(
    "select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",
    [
      actor.userId,
      JSON.stringify({
        sub: actor.userId,
        session_id: actor.sessionId,
        aal: actor.aal,
      }),
    ],
  );
  const [active] = await tx.query(
    "select s.id from private.runtime_auth_sessions s join private.runtime_auth_users u on u.id=s.user_id where s.id=$1 and s.user_id=$2 and (s.not_after is null or s.not_after>clock_timestamp()) and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=clock_timestamp())",
    [actor.sessionId, actor.userId],
  );
  if (!active) throw Error("Authentication required");
  const roles = await tx.query("select 1 from private.roles where user_id=$1", [
    actor.userId,
  ]);
  if (roles.length && actor.aal !== "aal2")
    throw Error("Privileged MFA required");
  const [profile] = await tx.query(
    "select p.*, (select granted and version=$2 from private.consent_events c where c.user_id=p.id and c.purpose='privacy' order by created_at desc,id desc limit 1) privacy_current from public.profiles p where p.id=$1",
    [actor.userId, versions.privacy],
  );
  return profile;
}

/** Only called with the server-verified session's own subject. This is not
 * signup: no Auth creation/password, beta-consent copying or privilege grant. */
export async function persistExistingMemberProfile(
  tx: SignupTransaction,
  actor: {
    userId: string;
    sessionId: string;
    aal: string;
    mfaRequired: boolean;
  },
  input: unknown,
  versions: ConsentVersions,
) {
  const v = invitationSetup.parse(input);
  if (v.country !== "AU")
    throw Error("Australian account eligibility required");
  if (actor.mfaRequired && actor.aal !== "aal2")
    throw Error("Privileged MFA required");
  const roles = await tx.query("select 1 from private.roles where user_id=$1", [
    actor.userId,
  ]);
  if (roles.length && actor.aal !== "aal2")
    throw Error("Privileged MFA required");
  // Select the latest applicable policy before checking approval: an older
  // approved row cannot defeat a newer restriction or expired review.
  const [policy] = await tx.query(
    "select approved,minimum_age,review_at>clock_timestamp() fresh,features,length(trim(evidence))>0 evidenced from private.region_policies where not preview_community_only and country=$1 and state=$2 and effective_from<=clock_timestamp() and effective_to>clock_timestamp() order by effective_from desc,id desc limit 1 for share",
    [v.country, v.state],
  );
  if (
    !policy?.approved ||
    Number(policy.minimum_age) !== 18 ||
    policy.fresh !== true ||
    policy.evidenced !== true ||
    !Array.isArray(policy.features) ||
    !policy.features.includes("community_social")
  )
    throw Error("Australian account policy configuration pending");
  // Reuses the own-session advisory lock, active verified Auth projection,
  // disabled-account denial, exact separate consents and retry-safe insert.
  return persistInvitedProfile(tx, actor.userId, actor.sessionId, v, versions);
}
