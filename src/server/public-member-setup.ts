import "server-only";
import postgres, { type TransactionSql } from "postgres";
import { DateTime } from "luxon";
import { requireIdentity } from "./auth";
import { databaseConnectionOptions } from "./database-tls";
import { isEmailOwnershipVerified } from "../core/auth-policy";
import { publicMemberSetupConfiguration } from "../core/public-member-setup";
import { appOnboardingSchema } from "../core/preview-testers";
import { isPublicSport } from "../core/public-customer";
import {
  persistExistingMemberProfile,
  readExistingMemberProfile,
} from "./existing-member-onboarding";
import type { SignupTransaction } from "./signup-profile";

let connection: ReturnType<typeof postgres> | undefined;
async function setupDatabase() {
  const url = process.env.DOCKED_PUBLIC_MEMBER_SETUP_DATABASE_URL;
  if (!publicMemberSetupConfiguration() || !url)
    throw Error("Existing-member public setup configuration pending");
  // Never use db(): the preserved beta mapper and role deliberately cannot
  // access ordinary public records. This separate existing role has no Auth
  // administration, BYPASSRLS or beta-to-public privilege grant.
  connection ??= postgres(url, {
    ...databaseConnectionOptions(url),
    max: 1,
    prepare: false,
  });
  const [role] = await connection`select r.rolsuper,r.rolbypassrls,
    pg_has_role(current_user,'docked_app','member') allowed
    from pg_roles r where r.rolname=current_user`;
  if (!role?.allowed || role.rolsuper || role.rolbypassrls)
    throw Error("Restricted public account role required");
  return connection;
}
function transaction(sql: TransactionSql): SignupTransaction {
  return {
    query: async (q, args) => [...(await sql.unsafe(q, args))],
    savepoint: async (run) =>
      sql.savepoint((nested) => run(transaction(nested))),
  };
}
async function setupActor() {
  const configuration = publicMemberSetupConfiguration();
  if (!configuration) throw Error("Existing-member public setup unavailable");
  // Existing beta admission and owner MFA are retained. A caller cannot choose
  // this route to obtain weaker identity, a new account, or public permissions.
  const who = await requireIdentity();
  if (!isEmailOwnershipVerified(who.user))
    throw Error("Verified email required");
  const sql = await setupDatabase();
  const [active] = await sql`select s.id from private.runtime_auth_sessions s
    join private.runtime_auth_users u on u.id=s.user_id
    where s.id=${who.sessionId} and s.user_id=${who.user.id}
    and (s.not_after is null or s.not_after>clock_timestamp())
    and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
    and (u.banned_until is null or u.banned_until<=clock_timestamp())`;
  if (!active) throw Error("Authentication required");
  const roles =
    await sql`select 1 from private.roles where user_id=${who.user.id}`;
  if (roles.length && who.aal !== "aal2")
    throw Error("Privileged MFA required");
  return { configuration, who, sql };
}
export async function publicMemberSetupState() {
  const { configuration, who, sql } = await setupActor();
  const profile = await sql.begin("read only", async (tx) =>
    readExistingMemberProfile(
      transaction(tx),
      { userId: who.user.id, sessionId: who.sessionId, aal: who.aal },
      configuration.versions,
    ),
  );
  if (profile?.disabled_at) throw Error("Account unavailable");
  const completed =
    profile?.age_attested === true &&
    profile.accepted_version === configuration.versions.terms &&
    profile.privacy_current === true;
  const [policy] = await sql`select exists(select 1 from (
    select distinct on(country,state) * from private.region_policies where country='AU'
    and not preview_community_only and effective_from<=clock_timestamp() and effective_to>clock_timestamp()
    order by country,state,effective_from desc,id desc
  ) p where p.approved and p.minimum_age=18 and p.review_at>clock_timestamp()
    and length(trim(p.evidence))>0 and 'community_social'=any(p.features)) ready`;
  return {
    completed,
    configurationPending: policy?.ready !== true,
    existingPolicyRenewal: !!profile && !completed,
    termsHref: configuration.termsHref,
    preferences: {
      sports: [] as string[],
      interests: "both" as const,
      officialEdges: false,
      followedMembers: false,
      replies: false,
      timezone: "Australia/Sydney",
      country: "",
      state: "",
      username: "",
    },
  };
}
export async function savePublicMemberSetup(input: unknown) {
  const v = appOnboardingSchema.parse(input);
  if (!v.sports.every(isPublicSport)) throw Error("Sport unavailable");
  if (!DateTime.now().setZone(v.timezone).isValid)
    throw Error("Valid timezone required");
  const { configuration, who, sql } = await setupActor();
  await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.sub',${who.user.id},true),
      set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
    const result = await persistExistingMemberProfile(
      transaction(tx),
      {
        userId: who.user.id,
        sessionId: who.sessionId,
        aal: who.aal,
        mfaRequired: who.mfaRequired,
      },
      v,
      configuration.versions,
    );
    if (result.created) {
      await tx`update public.profiles set sports=${v.sports},timezone=${v.timezone},
        onboarding_completed_at=coalesce(onboarding_completed_at,clock_timestamp()) where id=${who.user.id}`;
      await tx`select private.community_assert_access(${who.user.id},'community_social')`;
      const [social] =
        await tx`select id from private.social_profiles where user_id=${who.user.id} and status='active'`;
      if (!social) throw Error("Active public username required");
      await tx`insert into private.social_notification_preferences(profile_id,official_edges,followed_members,social,in_app)
        values(${social.id},false,${v.followedMembers},${v.replies},${v.followedMembers || v.replies}) on conflict do nothing`;
      await tx`insert into private.app_onboarding(user_id,interests) values(${who.user.id},${v.interests}) on conflict do nothing`;
      await tx`insert into private.audit_events(actor,action,subject,details) values(${who.user.id},'existing_member_public_profile_completed',${who.user.id},${tx.json({ terms: configuration.versions.terms, privacy: configuration.versions.privacy, source: "explicit authenticated member form" })})`;
    }
    // An existing ordinary profile is never silently renewed or rewritten by
    // this missing-profile-only migration form or a duplicate request.
    const [profile] =
      await tx`select p.id from public.profiles p where p.id=${who.user.id}
      and p.disabled_at is null and p.age_attested and p.accepted_version=${configuration.versions.terms}
      and exists(select 1 from private.consent_events c where c.user_id=p.id and c.purpose='privacy'
        and c.id=(select id from private.consent_events where user_id=p.id and purpose='privacy' order by created_at desc,id desc limit 1)
        and c.granted and c.version=${configuration.versions.privacy})`;
    if (!profile)
      throw Error("Existing public account requires normal policy renewal");
  });
  return {
    ok: true,
    redirect: "/app/onboarding/public",
    message:
      "Your public account details are saved. Public registration and payments remain controlled separately.",
  };
}
