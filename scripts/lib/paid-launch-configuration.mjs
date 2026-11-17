/** Offline SQL construction only. No connection, deployment or activation. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
export const eligibleDigest =
  "1956d1715dcd2ef494dad469f8b272951853d5d76773fe9ae39f5537996e6830";
const q = (s) => "'" + String(s).replaceAll("'", "''") + "'";
export function validateLaunchPlan(p, ids) {
  assert.equal(p.version, 1);
  assert.equal(p.projectRef, "pojoymtniryarxxunyvz");
  for (const k of [
    "approvalSha256",
    "smsEvidenceSha256",
    "googleEvidenceSha256",
  ])
    assert.match(p[k], /^[a-f0-9]{64}$/);
  assert.equal(p.terms, "2026-11-17-commercial-paid-launch-v2");
  assert.equal(p.privacy, "2026-11-17-privacy-clean-launch-v5");
  assert.match(p.windowId, /^[a-z0-9-]{8,80}$/);
  assert.equal(p.publicBudgetAudCents, 5000);
  assert.equal(p.reservationAudCents, 100);
  const start = Date.parse(p.startsAt),
    end = Date.parse(p.until);
  assert(Number.isFinite(start) && end > start && end - start <= 604800000);
  assert.equal(ids.length, 6065);
  assert.equal(new Set(ids).size, 6065);
  ids.forEach((id) => assert.match(id, /^[a-f0-9-]{36}$/));
  assert.equal(
    createHash("sha256")
      .update(JSON.stringify([...ids].sort()))
      .digest("hex"),
    eligibleDigest,
  );
  return p;
}
export function paidLaunchSql(phase, p, ids) {
  validateLaunchPlan(p, ids);
  assert(
    ["prepare", "phone", "commerce", "registration", "close"].includes(phase),
  );
  const a = q(p.approvalSha256),
    w = q(p.windowId),
    start = q(p.startsAt),
    end = q(p.until);
  const event = "coordinated_paid_launch_" + phase;
  const pre = `set local lock_timeout='3s';set local statement_timeout='45s';
select pg_advisory_xact_lock(hashtextextended('docked-coordinated-paid-launch',0));
select id from commercial_billing.control where id for update;
do $guard$ begin
 if not exists(select 1 from commercial_billing.control where id and environment='commercial') then raise exception 'Wrong commercial environment';end if;
 if exists(select 1 from private.audit_events where action=${q(event)} and subject=${a}) then raise exception 'Phase already recorded: inspect checkpoint, never replay blindly';end if;
end $guard$;
`;
  const audit = `insert into private.audit_events(actor,action,subject,details) values('approved-release-operator',${q(event)},${a},jsonb_build_object('approvalSha256',${a},'eligibleDefinitionDigest',${q(eligibleDigest)},'noMinting',true,'window',${w}));`;
  if (phase === "close")
    return (
      pre +
      `
update commercial_billing.control set sales_enabled=false,issuance_enabled=false,transfers_enabled=false,gameplay_enabled=false,updated_at=clock_timestamp() where id;
update private.feature_flags set enabled=false,reason='Approved launch emergency closure',updated_at=clock_timestamp() where key='registration';
update public_gameplay.policy set enabled=false where id;
update sms_delivery.windows set enabled=false where id=${w};
${audit}`
    );
  const gates = `do $guard$ begin
 if clock_timestamp()<${start}::timestamptz or clock_timestamp()>=${end}::timestamptz then raise exception 'Launch operating window not current';end if;
 if exists(select 1 from commercial_billing.control where transfers_enabled or gameplay_enabled) then raise exception 'Optional commerce must remain closed';end if;
 if exists(select 1 from private.feature_flags where enabled and key<>'registration') then raise exception 'Unreviewed public feature enabled';end if;
 if (select count(*) from public_gameplay.rounds)<>6 or exists(select 1 from public_gameplay.rounds r join beta_fantasy.competitions c on c.id=r.competition_id where r.enabled or r.fixture_kind<>'practice' or c.scored_at is not null or c.awards<>'[]'::jsonb or c.prize<>'No cash prize') then raise exception 'Competitions must remain disabled Practice';end if;
 if (select count(*) from launch_transition.accounts where kind='owner' and phase='retained')<>2 or
 (select count(*) from launch_transition.accounts where kind='customer' and phase='auth_retired')<>3 or
 exists(select 1 from launch_transition.batches where state<>'complete') then raise exception 'Completed clean transition required';end if;
 if exists(select 1 from commercial_billing.definitions d where issued<>legacy_issued+(select count(*) from beta_packs.issued b where b.definition=d.id)+(select count(*) from commercial_billing.cards c where c.definition=d.id)) then raise exception 'Lifetime supply mismatch';end if;
 if (select count(*) from commercial_billing.definitions)<>6540 then raise exception 'Unexpected inventory definitions';end if;
end $guard$;
`;
  if (phase === "prepare")
    return (
      pre +
      gates +
      `
lock table commercial_billing.definitions in share row exclusive mode;
do $guard$ begin
 if exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled)
 or exists(select 1 from commercial_billing.products where approved)
 or exists(select 1 from commercial_billing.definitions where approved)
 or exists(select 1 from private.feature_flags where key='registration' and enabled)
 or exists(select 1 from public_gameplay.policy where enabled)
 or exists(select 1 from sms_delivery.windows where enabled)
 then raise exception 'Initial closed configuration required';end if;
 if (select count(*) from commercial_billing.products where (id,credits,aud_cents,version) in
 (('docked_credits_4900_v1',4900,4900,'owner-credit-packages-2026-10-31-v1'),('docked_credits_9900_v1',9900,9900,'owner-credit-packages-2026-10-31-v1')))<>2
 or (select count(*) from commercial_billing.products)<>2 then raise exception 'Product price drift';end if;
end $guard$;
create temp table launch_eligible(id uuid primary key) on commit drop;
insert into launch_eligible select value::uuid from jsonb_array_elements_text(${q(JSON.stringify(ids))}::jsonb);
do $guard$ begin
 if (select count(*) from commercial_billing.definitions d join launch_eligible e using(id))<>6065 then raise exception 'Missing approved definition';end if;
end $guard$;
-- Preserve original immutable provenance. Paid scope binds via control + audit.
update commercial_billing.definitions d set approved=true from launch_eligible e where d.id=e.id;
update commercial_billing.products set approved=true;
-- Retirement already denies beta identities. Close dormant legacy toggles too;
-- existing cross-ledger guard correctly rejects commerce while they remain set.
update beta_packs.control set enabled=false,grants_enabled=false where id;
update credits_sandbox.trading_control set sale=false,swap=false,combined=false,paused=true,revision=revision+1 where id;
update commercial_billing.control set policy_version='commercial-closed-loop-2026-11-01-v1',updated_at=clock_timestamp(),
 approvals=approvals||jsonb_build_object('validUntil',${end},'owner',${a},'legal','Founder approved AU adult paid-pack scope; '||${a},
 'googlePlay',${q(p.googleEvidenceSha256)},'privacy',${q(p.privacy)},'retention','Approved incident-only 90 days; cleanup OFF',
 'refundRecovery','cb1ee482 accepted provider refund/recovery evidence','playerRights','Founder legal-advice names/colours/cities/original art attestation; '||${a},
 'supplyReconciliation',${q(eligibleDigest)},'withdrawals',false,'prizes',false,'paidEntry',false,'nba',false) where id;
update public_gameplay.policy set terms_version=${q(p.terms)},privacy_version=${q(p.privacy)},valid_until=${end}::timestamptz,
 authority='Founder-approved AU paid-pack customer access; no competitions/trading; '||${a} where id;
insert into sms_delivery.windows(id,enabled,starts_at,expires_at,budget_aud_cents,allowlist,authority_reference,price_evidence_reference)
 values(${w},false,${start}::timestamptz,${end}::timestamptz,5000,null,${a},${q(p.smsEvidenceSha256)});
set constraints all immediate;
do $guard$ begin
 if (select count(*) from commercial_billing.definitions where approved)<>6065 or (select count(*) from commercial_billing.definitions where not approved)<>475 then raise exception 'Eligibility partition differs';end if;
end $guard$;
${audit}`
    );
  const prepared = `do $guard$ begin
 if not exists(select 1 from private.audit_events where action='coordinated_paid_launch_prepare' and subject=${a})
 or not exists(select 1 from commercial_billing.control where approvals->>'owner'=${a} and approvals->>'validUntil'=${end})
 or (select count(*) from commercial_billing.products where approved)<>2
 or (select count(*) from commercial_billing.definitions where approved)<>6065
 then raise exception 'Exact prepared launch checkpoint required';end if;
 if not exists(select 1 from sms_delivery.windows where id=${w} and authority_reference=${a} and starts_at<=clock_timestamp() and expires_at>clock_timestamp() and budget_aud_cents=5000 and reserved_aud_cents<5000 and allowlist is null) then raise exception 'Exact funded budget window required';end if;
end $guard$;
`;
  if (phase === "phone")
    return (
      pre +
      gates +
      prepared +
      `
do $guard$ begin
 if exists(select 1 from sms_delivery.windows where enabled) then raise exception 'Another SMS window is enabled';end if;
end $guard$;
update sms_delivery.windows set enabled=true where id=${w};
${audit}`
    );
  if (phase === "commerce")
    return (
      pre +
      gates +
      prepared +
      `
do $guard$ begin
 if exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled)
 or exists(select 1 from private.feature_flags where key='registration' and enabled) then raise exception 'Commerce starts before signup';end if;
end $guard$;
update commercial_billing.control set sales_enabled=true,issuance_enabled=true,updated_at=clock_timestamp() where id;
${audit}`
    );
  return (
    pre +
    gates +
    prepared +
    `
do $guard$ begin
 if not exists(select 1 from commercial_billing.control where sales_enabled and issuance_enabled)
 or not exists(select 1 from private.audit_events where action='coordinated_paid_launch_commerce' and subject=${a})
 or not exists(select 1 from sms_delivery.windows where id=${w} and enabled)
 then raise exception 'Paid fulfilment and funded SMS must precede registration';end if;
 if exists(select 1 from private.feature_flags where key='registration' and enabled) then raise exception 'Registration already open';end if;
end $guard$;
update public_gameplay.policy set enabled=true where id;
-- These are sport display/read capabilities, not competition activation.
-- round_allowed still rejects all six disabled rounds; no free cards are issued.
update public_gameplay.sports set visible=true,play_enabled=true where sport in('nfl','afl','nrl');
update private.feature_flags set enabled=true,reason='Exact coordinated paid-launch approval '||${a},updated_at=clock_timestamp() where key='registration';
${audit}`
  );
}
