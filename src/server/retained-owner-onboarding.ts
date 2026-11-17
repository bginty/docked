import { invitationSetup } from "../core/invitation-setup";
import type { ConsentVersions } from "../core/auth-readiness";
import type { SignupTransaction } from "./signup-profile";

/** Explicit Owner form only. Existing copied profile required; no new Auth,
 * profile, role, wallet, card or inherited social relationships are created. */
export async function renewRetainedOwnerProfile(
  tx: SignupTransaction,
  actor: { userId: string; sessionId: string; aal: string },
  input: unknown,
  versions: ConsentVersions,
) {
  const v = invitationSetup.parse(input);
  if (v.country !== "AU" || actor.aal !== "aal2")
    throw Error("Australian eligibility and Owner MFA required");
  await tx.query("select pg_advisory_xact_lock(hashtextextended($1,761))", [
    actor.userId,
  ]);
  const [profile] = await tx.query(
    "select p.* from public.profiles p join private.roles r on r.user_id=p.id and r.role='owner' join private.runtime_auth_users u on u.id=p.id join private.runtime_auth_sessions s on s.user_id=u.id where p.id=$1 and s.id=$2 and p.disabled_at is null and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and(u.banned_until is null or u.banned_until<=clock_timestamp())and(s.not_after is null or s.not_after>clock_timestamp())and(private.commercial_transition_status(p.id)->>'allowed')::boolean and(private.commercial_transition_status(p.id)->>'betaEnded')::boolean for update of p",
    [actor.userId, actor.sessionId],
  );
  if (!profile)
    throw Error("Retained Owner profile and active session required");
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
  const [privacy] = await tx.query(
    "select granted,version from private.consent_events where user_id=$1 and purpose='privacy'order by created_at desc,id desc limit 1",
    [actor.userId],
  );
  if (
    profile.accepted_version === versions.terms &&
    privacy?.granted === true &&
    privacy.version === versions.privacy
  )
    return { renewed: false };
  await tx.query(
    "update public.profiles set country=$2,state=$3,age_attested=true,accepted_version=$4 where id=$1",
    [actor.userId, v.country, v.state, versions.terms],
  );
  for (const [purpose, version] of [
    ["terms", versions.terms],
    ["privacy", versions.privacy],
    ["age_attestation", versions.terms],
  ])
    await tx.query(
      "insert into private.consent_events(user_id,purpose,granted,version,actor)values($1::uuid,$2,true,$3,($1::uuid)::text)",
      [actor.userId, purpose, version],
    );
  const social = await tx.query(
    "select user_id from private.social_profiles where user_id=$1",
    [actor.userId],
  );
  if (!social.length)
    await tx.query(
      "insert into private.social_profiles(user_id,handle,display_name)values($1,$2,$2)",
      [actor.userId, v.username],
    );
  return { renewed: true };
}
