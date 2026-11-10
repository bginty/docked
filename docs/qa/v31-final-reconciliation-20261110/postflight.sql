-- READ ONLY. Run on restored rehearsal or after separately approved application.
begin transaction read only;
set local statement_timeout='30s';
select routine_days,enabled,version from operations.retention_policy; --90,false,founder-routine-incidents-20261110-v1
select count(*) incidents from operations.incidents;
select count(*) events from operations.events;
select count(*) preservation from operations.preservation;
select count(*) deletion_receipts from operations.retention_receipts; --four zero counts on initial dormant application
select count(*) tables_without_rls from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='operations'and c.relkind='r'and not c.relrowsecurity; --0
select has_table_privilege('anon','operations.events','select')
 or has_table_privilege('authenticated','operations.events','select')
 or has_table_privilege('docked_app','operations.events','select')
 or has_table_privilege('service_role','operations.events','select') unexpected_direct_review_access; --false
select has_function_privilege('docked_app','operations.review(text,jsonb)','execute') owner_wrapper_enabled,
 has_function_privilege('docked_app','operations.retention_review(text,jsonb)','execute') preservation_wrapper_enabled,
 has_function_privilege('docked_app','operations.prune_routine(integer)','execute') app_can_delete,
 has_function_privilege('service_role','operations.prune_routine(integer)','execute') service_can_delete; --true,true,false,false
select rolcanlogin,rolsuper,rolbypassrls,(select count(*)from pg_auth_members m where m.roleid=r.oid)members
 from pg_roles r where rolname='docked_incident_retention'; --false,false,false,0
select count(*) expired_routine_candidates from operations.incidents i where operations.routine_expired(i.code); --0
select indexdef from pg_indexes where schemaname='auth'and indexname='docked_verified_phone_canonical';
select count(*) invalid_unique_indexes from pg_index where indexrelid='auth.docked_verified_phone_canonical'::regclass and(not indisvalid or not indisunique); --0
select count(*) missing_au_guard from pg_proc where oid='private.public_phone_verified(uuid)'::regprocedure and position('614'in prosrc)=0; --0
select sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled from commercial_billing.control; --allfalse
select count(*) from commercial_billing.cards; --0
select count(*) from commercial_billing.definitions; --0
select count(*) from public_gameplay.rounds where enabled or fixture_kind<>'practice'; --0
select count(*) from cron.job; --9, definitions unchanged
commit;
-- Follow with the same full fingerprint comparison, actual owner MFA denial/allow
-- tests and closed-route acceptance. Do not enable retention, SMS or any launch flag.
