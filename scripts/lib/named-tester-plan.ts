import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  namedTesterNotice,
  namedTesterNoticeVersion,
} from "../../src/core/named-private-tester";
export const namedTesterId = "d6ab4838-7108-4c50-8ab8-c5947ab55bd8";
export const namedTesterEmailDigest =
  "35028c3635dc2b3702297a43502eb4cc432d715052c9da83d0e4857b2ceb2c00";
export const namedTesterNoticeSha256 = createHash("sha256")
  .update(JSON.stringify(namedTesterNotice))
  .digest("hex");
export const namedTesterGrantRequest = "c0956ff1-44ca-4af3-a8ca-468b697a9b67";
export const namedTesterMigration =
  "supabase/migrations/20261115092124_named_private_tester_exception.sql";
export const namedTesterDirectory = "docs/qa/brenton-private-tester-20261115/";
const literal = (value: string) => "'" + value.replaceAll("'", "''") + "'";

/** Execute inside the reviewed operator's transaction. No Auth or ledger mutation. */
export function namedTesterActivationSql(authority: string) {
  assert(authority.length >= 40 && authority.length <= 400);
  const u = literal(namedTesterId),
    ref = literal(authority);
  return `
select pg_advisory_xact_lock(71820342);
select 1 from beta_private.admission_control where id for update;
do $guard$ begin
 if not exists(select 1 from auth.users u join beta_private.admissions a on a.user_id=u.id
  join beta_private.friends_roster r on r.user_id=u.id and r.enabled
  where u.id=${u}::uuid and encode(sha256(convert_to(lower(u.email),'UTF8')),'hex')='${namedTesterEmailDigest}'
   and lower(u.email)=a.email and a.email=r.email and a.status='reserved' and not a.administrator
   and a.country is null and not a.age_attested and not coalesce(u.is_anonymous,false)
   and (to_jsonb(u)->>'deleted_at') is null and coalesce(u.banned_until,'-infinity')<=clock_timestamp())
 or exists(select 1 from beta_private.roles where user_id=${u}::uuid)
 or exists(select 1 from beta_public.profiles where id=${u}::uuid)
 or exists(select 1 from beta_private.consent_events where user_id=${u}::uuid)
 then raise exception 'Named account changed; review before activation';end if;
 if not exists(select 1 from beta_private.admission_control where enabled and testers_enabled)
 or not exists(select 1 from beta_private.friends_control where enabled)
 or not exists(select 1 from beta_packs.control where enabled and grants_enabled)
 or exists(select 1 from beta_private.feature_flags where key='registration' and enabled)
 or exists(select 1 from private.feature_flags where key='registration' and enabled)
 or not exists(select 1 from commercial_billing.control where id and not sales_enabled and not issuance_enabled and not transfers_enabled and not gameplay_enabled)
 then raise exception 'Existing closed-gate private test configuration required';end if;
 if exists(select 1 from beta_private.named_tester_exception where user_id=${u}::uuid)
 or exists(select 1 from credits_sandbox.access where user_id=${u}::uuid)
 or exists(select 1 from beta_packs.members where member_id=${u}::uuid)
 then raise exception 'Account preparation already exists; inspect receipt instead of repeating';end if;
end $guard$;
insert into beta_private.named_tester_exception(user_id,country,state,email_digest,notice_version,notice_sha256,enabled,authority_reference,created_at,onboarding_expires_at)
 select ${u}::uuid,'US','CA','${namedTesterEmailDigest}','${namedTesterNoticeVersion}','${namedTesterNoticeSha256}',true,${ref},t,t+interval '7 days' from (select clock_timestamp() t) s;
insert into credits_sandbox.access(user_id,kind,label,enabled,authority_note)
 values(${u}::uuid,'tester','Brenton',true,${ref});
insert into beta_packs.members(member_id,authority_reference) values(${u}::uuid,${ref});
set constraints all immediate;
do $guard$ begin
 if beta_private.admitted(${u}::uuid) or beta_packs.member_allowed(${u}::uuid)
 or exists(select 1 from beta_public.profiles where id=${u}::uuid)
 or exists(select 1 from beta_private.consent_events where user_id=${u}::uuid)
 then raise exception 'Preparation must not substitute for member consent';end if;
end $guard$;
`;
}
