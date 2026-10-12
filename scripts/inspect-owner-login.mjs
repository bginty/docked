import { ownerDatabase } from "./owner-gameplay-db.mjs";
const db = ownerDatabase();
try {
  const rows = await db`select u.id,u.email_confirmed_at is not null verified,
  beta_private.admitted(u.id) admitted,beta_private.pending_beta_consent(u.id) renewal,
  beta_private.customer_signup_identity(u.id) customer,beta_private.beta_gameplay_identity(u.id) gameplay,
  beta_private.gameplay_mfa_required(u.id) mfa_required,
  (select count(*)::int from auth.mfa_factors f where f.user_id=u.id and f.status='verified') verified_factors,
  (select count(*)::int from auth.sessions s where s.user_id=u.id and (not_after is null or not_after>clock_timestamp())) active_sessions,
  (select row_to_json(x) from (select a.status,a.policy_versions,a.policy_digest,a.country,a.state from beta_private.admissions a where a.user_id=u.id) x) admission,
  (select row_to_json(x) from (select p.disabled_at,p.accepted_version,p.onboarding_completed_at from beta_public.profiles p where p.id=u.id) x) profile,
  (select completed_at from beta_private.app_onboarding where user_id=u.id) onboarding
 from auth.users u where lower(u.email)='support@docked.com.au'`;
  console.log(JSON.stringify(rows));
  console.log(
    JSON.stringify(
      await db`select enabled,policy_versions,policy_digest from beta_private.admission_control`,
    ),
  );
} finally {
  await db.end();
}
