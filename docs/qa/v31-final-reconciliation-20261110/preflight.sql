-- READ ONLY. Run before a separately approved, exact-file Production change.
begin transaction read only;
set local statement_timeout='30s';
select version from supabase_migrations.schema_migrations where version in
 ('20261109231834','20261109232000','20261109232124','20261110005726','20261110010050'); -- expected zero
select environment,sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled from commercial_billing.control;
select 'definitions' category,count(*) rows from commercial_billing.definitions
union all select 'cards',count(*) from commercial_billing.cards
union all select 'packs',count(*) from commercial_billing.packs
union all select 'receipts',count(*) from commercial_billing.receipts; -- all zero at reviewed snapshot; stop on drift
select count(*) cap_mismatches from commercial_billing.definitions where lifetime_cap is distinct from
 case rarity when 'RARE' then 5000 when 'ELITE' then 2500 when 'ULTRA_RARE' then 400 when 'LEGENDARY' then 50 when 'ICON' then 1 end;
select count(*) counter_mismatches from commercial_billing.definitions d where issued<>legacy_issued+(select count(*)from commercial_billing.cards c where c.definition=d.id);
select count(*) duplicate_canonical_identities from (select sport,snapshot->>'provider',snapshot->>'providerId',rarity
 from commercial_billing.definitions where snapshot->>'provider' is not null and snapshot->>'providerId' is not null group by 1,2,3,4 having count(*)>1)s;
select count(*) canonical_verified_phone_conflicts from (select regexp_replace(phone,'^\+','') from auth.users
 where phone_confirmed_at is not null and phone~'^\+?[1-9][0-9]{7,14}$' group by 1 having count(*)>1)s; -- zero; no phone exposed
select count(*) public_rounds,count(*)filter(where r.enabled) enabled,
 count(*)filter(where r.fixture_kind<>'practice' or c.name not ilike '%Practice%' or c.rules->>'synthetic' is distinct from 'true'
 or c.awards<>'[]'::jsonb or c.rules->>'entry_fee_credits' is distinct from '0'
 or coalesce(c.rules->'round_reward_policy'->>'active','false')<>'false') unsafe
 from public_gameplay.rounds r join beta_fantasy.competitions c on c.id=r.competition_id; -- 6 / 0 / 0
select count(*) verified_auth_phone_unique_index from pg_indexes where schemaname='auth'and tablename='users'and indexdef like 'CREATE UNIQUE INDEX% (phone)';
select to_regprocedure('public_gameplay.identity()') is not null identity_dependency,
 to_regprocedure('commercial_billing.lock_control()') is not null commercial_dependency;
select rolname,rolcanlogin,rolsuper,rolbypassrls from pg_roles where rolname='docked_incident_retention'; -- absent before initial apply
select count(*) scheduled_jobs from cron.job; -- 9 at reviewed snapshot; compare definitions/fingerprints, not count alone
commit;
-- Also compare full schema/roles and 550 protected-table fingerprints with a fresh
-- consistent encrypted capture. Never dump Auth/customer rows to a public log.
