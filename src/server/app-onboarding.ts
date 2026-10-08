import "server-only";
import { fantasyPlatformEnabled as fantasyEnabled } from "@/core/fantasy-production";
import { DateTime } from "luxon";
import { db } from "./db";
import { requireIdentity } from "./auth";
import { setCommunityClaims } from "./community-social";
import { previewCommunityContext } from "@/core/preview-community";
import { appOnboardingSchema } from "@/core/preview-testers";
import {
  currentConsentVersions,
  legalConsentRequired,
} from "@/core/auth-readiness";
export type AppOnboardingState = {
  completed: boolean;
  legalRequired: boolean;
  usernameRequired: boolean;
  minimumAge: number | null;
  preferences: {
    sports: string[];
    interests: "edges" | "community" | "both";
    officialEdges: boolean;
    followedMembers: boolean;
    replies: boolean;
    timezone: string;
    country: string;
    state: string;
    username: string;
  };
};
/** Called only with a verified session's own ID. No public endpoint accepts a caller-selected user ID. */
export async function appOnboardingState(
  userId: string,
): Promise<AppOnboardingState> {
  const who = await requireIdentity();
  if (who.user.id !== userId) throw Error("Own account required");
  const sql = db();
  const versions = currentConsentVersions();
  const [row] = await sql`select p.*,o.interests,o.completed_at,s.handle,
    n.official_edges,n.followed_members,n.social,
    coalesce((select granted from private.consent_events where user_id=p.id and purpose='privacy' order by created_at desc,id desc limit 1),false) privacy,
    (select version from private.consent_events where user_id=p.id and purpose='privacy' order by created_at desc,id desc limit 1) privacy_version,
    case when ${!!previewCommunityContext(process.env)} and exists(select 1 from private.preview_tester_access g join private.region_policies r on r.id=g.policy_id where g.user_id=p.id and g.revoked_at is null and g.expires_at>clock_timestamp() and r.preview_community_only and r.approved and r.effective_from<=clock_timestamp() and r.effective_to>clock_timestamp() and r.review_at>clock_timestamp()) then 18
    else (select minimum_age from private.region_policies where not preview_community_only and country=p.country and state=p.state and approved and effective_from<=clock_timestamp() and effective_to>clock_timestamp() and review_at>clock_timestamp() order by effective_from desc,id desc limit 1) end minimum_age
    from public.profiles p left join private.app_onboarding o on o.user_id=p.id left join private.social_profiles s on s.user_id=p.id
    left join private.social_notification_preferences n on n.profile_id=s.id where p.id=${userId} and p.disabled_at is null`;
  if (!row) throw Error("Own account unavailable");
  const legalRequired = legalConsentRequired(
    {
      ageAttested: row.age_attested,
      termsVersion: row.accepted_version,
      privacyGranted: row.privacy,
      privacyVersion: row.privacy_version,
    },
    versions,
    process.env.APP_ENV === "production",
  );
  return {
    completed: !!row.completed_at && !legalRequired,
    legalRequired,
    usernameRequired: !row.handle,
    minimumAge: row.minimum_age == null ? null : Number(row.minimum_age),
    preferences: {
      sports: row.sports as string[],
      interests: (row.interests ?? "both") as "edges" | "community" | "both",
      officialEdges: row.official_edges === true,
      followedMembers: row.followed_members === true,
      replies: row.social === true,
      timezone: String(row.timezone),
      country: String(row.country),
      state: String(row.state),
      username: String(row.handle ?? ""),
    },
  };
}
export async function saveAppOnboarding(input: unknown) {
  const v = appOnboardingSchema.parse(input),
    who = await requireIdentity();
  if (!DateTime.now().setZone(v.timezone).isValid)
    throw Error("Valid timezone required");
  const versions = currentConsentVersions();
  await db().begin(async (tx) => {
    await setCommunityClaims(tx, who);
    const [p] =
      await tx`select * from public.profiles where id=${who.user.id} and disabled_at is null for update`;
    const [active] = await tx`select private.active_member_session() active`;
    if (!p || !active.active) throw Error("Active account required");
    const [consent] =
      await tx`select granted,version from private.consent_events where user_id=${who.user.id} and purpose='privacy' order by created_at desc,id desc limit 1`;
    const legalRequired = legalConsentRequired(
      {
        ageAttested: p.age_attested,
        termsVersion: p.accepted_version,
        privacyGranted: consent?.granted === true,
        privacyVersion: consent?.version,
      },
      versions,
      process.env.APP_ENV === "production",
    );
    if (
      legalRequired &&
      (v.age !== true ||
        v.terms !== true ||
        v.privacy !== true ||
        !v.country ||
        !v.state)
    )
      throw Error(
        "Applicable legal-age, country/state, terms and privacy acceptance required",
      );
    const [existingSocial] =
      await tx`select id from private.social_profiles where user_id=${who.user.id}`;
    if (!existingSocial && !v.username) throw Error("Public username required");
    // Existing accepted jurisdiction changes use the dedicated, alert-pausing endpoint.
    await tx`update public.profiles set sports=${v.sports},timezone=${v.timezone},country=${legalRequired ? v.country! : p.country},state=${legalRequired ? v.state! : p.state},
      age_attested=case when ${legalRequired} then true else age_attested end,
      accepted_version=case when ${legalRequired} then ${versions.terms} else accepted_version end,
      onboarding_completed_at=coalesce(onboarding_completed_at,clock_timestamp()) where id=${who.user.id}`;
    // Locks and wall-clock checks inside this gate reject expired/revoked preview grants and age>18 policies.
    await tx`select private.community_assert_access(${who.user.id},'community_social')`;
    if (legalRequired)
      for (const purpose of ["age_attestation", "terms", "privacy"])
        await tx`insert into private.consent_events(user_id,purpose,granted,version,actor) values(${who.user.id},${purpose},true,${purpose === "privacy" ? versions.privacy : versions.terms},${who.user.id})`;
    if (!existingSocial)
      await tx`insert into private.social_profiles(user_id,handle,display_name) values(${who.user.id},${v.username!},${v.username!})`;
    const [social] =
      await tx`select id from private.social_profiles where user_id=${who.user.id} and status='active'`;
    if (!social) throw Error("Active social profile required");
    await tx`insert into private.social_notification_preferences(profile_id,official_edges,followed_members,social,in_app) values(${social.id},${v.officialEdges},${v.followedMembers},${v.replies},${v.officialEdges || v.followedMembers || v.replies})
      on conflict(profile_id) do update set official_edges=excluded.official_edges,followed_members=excluded.followed_members,social=excluded.social,in_app=excluded.in_app,updated_at=clock_timestamp()`;
    if (previewCommunityContext(process.env))
      await tx`update public.notification_preferences set paused=${!(v.officialEdges || v.followedMembers || v.replies)},edge_alerts=false,digest='off',education=false,updated_at=clock_timestamp() where user_id=${who.user.id}`;
    await tx`insert into private.app_onboarding(user_id,interests) values(${who.user.id},${v.interests}) on conflict(user_id) do update set interests=excluded.interests`;
    await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'app_onboarding_completed',${who.user.id},${tx.json({ version: "app-beta-2026-10", notifications: "in-app only", interests: v.interests })})`;
  });
  return {
    ok: true,
    redirect: fantasyEnabled() ? "/fantasy/play" : "/edges",
    message:
      process.env.APP_ENV === "production"
        ? "Preferences saved."
        : "Preferences saved. External notifications remain disabled in preview.",
  };
}
