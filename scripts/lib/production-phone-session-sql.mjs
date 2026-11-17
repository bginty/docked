/** Offline only: one disabled Founder window, no provider calls or activation. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { validateProductionPhoneWindow } from "./production-phone-window-shutdown.mjs";
const q = (s) => "'" + String(s).replaceAll("'", "''") + "'";
export function phoneSessionSql(plan, founderId, tariffSha256) {
  validateProductionPhoneWindow(plan);
  assert.match(
    founderId,
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
  );
  assert.equal(
    createHash("sha256").update(founderId).digest("hex"),
    plan.founderIdentitySha256,
  );
  assert.match(tariffSha256, /^[a-f0-9]{64}$/);
  const u = q(founderId),
    w = q(plan.windowId),
    a = q(plan.approvalSha256);
  return `set local lock_timeout='3s';set local statement_timeout='30s';
select pg_advisory_xact_lock(hashtextextended('docked-production-phone-session',0));
do $guard$ begin
 if not exists(select 1 from launch_transition.accounts where user_id=${u}::uuid and kind='owner' and phase='retained')
 or not exists(select 1 from private.roles where user_id=${u}::uuid and role='owner')
 or not exists(select 1 from auth.users where id=${u}::uuid and deleted_at is null and email_confirmed_at is not null and (banned_until is null or banned_until<=clock_timestamp()))
 or not exists(select 1 from auth.mfa_factors where user_id=${u}::uuid and status='verified' and factor_type='totp')
 or not launch_transition.identity_allowed(${u}::uuid) then raise exception 'Exact retained MFA Owner required';end if;
 if clock_timestamp()<${q(plan.startsAt)}::timestamptz or clock_timestamp()>=${q(plan.until)}::timestamptz then raise exception 'Session time not current';end if;
 if exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled)
 or exists(select 1 from private.feature_flags where enabled)
 or exists(select 1 from public_gameplay.policy where enabled)
 or exists(select 1 from sms_delivery.windows where enabled)
 then raise exception 'Closed gates required';end if;
 if exists(select 1 from sms_delivery.windows where id=${w}) then raise exception 'Window already exists; never reset or replenish';end if;
end $guard$;
insert into sms_delivery.windows(id,enabled,starts_at,expires_at,budget_aud_cents,allowlist,authority_reference,price_evidence_reference)
 values(${w},false,${q(plan.startsAt)}::timestamptz,${q(plan.until)}::timestamptz,100,array[${u}::uuid],${a},${q(tariffSha256)});
insert into private.audit_events(actor,action,subject,details) values('approved-phone-operator','production_phone_window_prepared',${w},jsonb_build_object('approvalSha256',${a},'founderIdentitySha256',${q(plan.founderIdentitySha256)},'maximumAttempts',1,'budgetAudCents',100));`;
}
