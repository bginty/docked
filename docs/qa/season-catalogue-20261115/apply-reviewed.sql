-- PROPOSED ONLY: psql script; NOT authorised by preparation or prior approvals.
-- Working directory: this exact repository. Requires fresh package approval,
-- authenticated encrypted backup/recovery, fresh drift and environment checks.
\set ON_ERROR_STOP on
begin;
set local lock_timeout='3s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(71820342);
\ir preflight.sql
\ir ../../../supabase/migrations/20261115011415_approved_season_catalogue.sql
\ir ../../../supabase/migrations/20261115011418_season_catalogue_pack_eligibility.sql
\ir adopt-catalogue.sql
insert into supabase_migrations.schema_migrations(version,name) values
 ('20261115011415','approved_season_catalogue'),
 ('20261115011418','season_catalogue_pack_eligibility');
set constraints all immediate;
commit;
-- Follow with read-only verification and all-table/custody comparison. Never
-- open an actual member pack as an operator acceptance test.
