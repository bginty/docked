-- REVIEW TEMPLATE ONLY. Run on bckkllmndoxzpzdqrevb after verifying its identity.
-- Default NOLOGIN: secure credential provisioning is a separate host step.
begin;
create role docked_multi_delivery nologin nobypassrls;
grant usage on schema sports_feed to docked_multi_delivery;
grant select,insert,update on sports_feed.delivery_checkpoints,
 sports_feed.delivery_records to docked_multi_delivery;
grant select,insert on sports_feed.delivery_recalculations,
 sports_feed.delivery_receipts to docked_multi_delivery;
create policy delivery_checkpoint on sports_feed.delivery_checkpoints
 to docked_multi_delivery using(true) with check(true);
create policy delivery_record on sports_feed.delivery_records
 to docked_multi_delivery using(true) with check(true);
create policy delivery_outbox on sports_feed.delivery_recalculations
 to docked_multi_delivery using(true) with check(true);
create policy delivery_receipt on sports_feed.delivery_receipts
 to docked_multi_delivery using(true) with check(true);
commit;
-- No grants to ownership, wallets, raw scoring revisions, scoring journal,
-- approval registry or member schemas. No browser role membership.
