-- PREPARED ONLY. Execute solely under the separately authorised incident procedure.
-- Reversible admission closure; never deletes inventory, balances, receipts or audit.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
update commercial_billing.control set sales_enabled=false,issuance_enabled=false,transfers_enabled=false,gameplay_enabled=false where id;
update private.feature_flags set enabled=false where key in ('registration','publication','paid_plans');
update public_gameplay.policy set enabled=false where id;
update public_gameplay.sports set visible=false,play_enabled=false;
update public_gameplay.rounds set enabled=false;
do $optional_retention$
begin
 if to_regclass('operations.retention_policy') is not null then
  execute 'update operations.retention_policy set enabled=false';
 end if;
end $optional_retention$;
commit;
-- Keep operational alert admission and immutable audit available to the founder.
-- App/API environment additionally closes REGISTRATION_ENABLED,
-- DOCKED_PUBLIC_CUSTOMERS, DOCKED_COMMERCIAL_SERVICE, DOCKED_COMMERCIAL_SURFACES,
-- DOCKED_COMMERCIAL_CHECKOUT, DOCKED_PUBLIC_PHONE_OTP. Do not remove credentials.
