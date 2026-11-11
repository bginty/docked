/** Exact historical-baseline import mechanics. Callers own approval, target,
 * backup/drift checks and transaction. This module never opens a connection. */
import assert from "node:assert/strict";
import { digest } from "../../src/core/scoring-engine";
import { validateDormantCommercialPool } from "../../src/core/commercial-pool-plan";
import { reconcileLifetimePool } from "../../src/core/lifetime-reconciliation";
import { v31SchemaFingerprintSql } from "./v31-schema-fingerprint";

export function validateReviewedInventory(plan: any) {
  assert.equal(plan.version, "v31-complete-preservation-only-inventory-proposal-v1");
  assert.equal(plan.projectRef, "pojoymtniryarxxunyvz");
  assert.equal(plan.productionApproved, false);
  validateDormantCommercialPool(plan.sourceRows);
  assert.equal(plan.sourceRows.length, 6540);
  assert.equal(plan.registrations.length, 23);
  assert.equal(plan.priorIssuance.length, 735);
  assert.equal(digest(plan.sourceRows), plan.sourceRowsDigest);
  assert.equal(digest(plan.registrations), plan.registrationDigest);
  const result = reconcileLifetimePool(plan.sourceRows, plan.priorIssuance);
  assert(result.importReady);
  assert.equal(result.legacyIssued, 888);
  assert.equal(result.digest, plan.reconciliationDigest);
  assert.equal(digest(result.rows), plan.expectedRowsDigest);
  assert.equal(digest(plan.rows), plan.expectedRowsDigest);
  return result.rows;
}

const literal = (value: unknown) => `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
export function reviewedInventorySql(plan: any) {
  const rows = validateReviewedInventory(plan);
  // Table locks coordinate with the existing mint/ownership paths while the
  // preservation baseline is bound. Timeouts abort rather than waiting forever.
  return `
set local lock_timeout='3s';
set local statement_timeout='60s';
lock table credits_sandbox.state, credits_sandbox.card_instances,
 credits_sandbox.nba_fixture_instances, credits_sandbox.permanent_players,
 sports_feed.sport_sandbox_inventory in share row exclusive mode;
lock table commercial_billing.definitions in share row exclusive mode;
select id from commercial_billing.control where id for update;
do $guard$ begin
 if not exists(select 1 from commercial_billing.control where id and environment in ('commercial','acceptance')
  and not sales_enabled and not issuance_enabled and not transfers_enabled and not gameplay_enabled)
 then raise exception 'Closed commercial controls required'; end if;
 if exists(select 1 from commercial_billing.products where approved)
 then raise exception 'Products must remain unapproved'; end if;
 if exists(select 1 from commercial_billing.cards) or exists(select 1 from commercial_billing.packs)
  or exists(select 1 from commercial_billing.receipts) or exists(select 1 from commercial_billing.accounts)
 then raise exception 'Empty initial commercial baseline required'; end if;
 if to_regclass('commercial_billing.commercial_provider_lifetime_identity') is null
  or to_regprocedure('commercial_billing.prevent_parallel_mint()') is null
  or to_regprocedure('commercial_billing.prevent_parallel_inventory()') is null
 then raise exception 'Reviewed lifetime/parallel-issuance migration required'; end if;
 if not exists(select 1 from pg_trigger where tgrelid='credits_sandbox.state'::regclass
  and tgname='commercial_no_parallel_mint' and tgenabled='O')
 then raise exception 'Parallel mint guard missing/disabled'; end if;
 if (select count(*) from commercial_billing.definitions) not in (0,6540)
 then raise exception 'Partial/unreviewed inventory cannot be repaired implicitly'; end if;
end $guard$;
create temporary table docked_reviewed_inventory_source on commit drop as
 select * from jsonb_to_recordset(${literal(rows)}) r(id uuid,player_id uuid,sport text,rarity text,lifetime_cap int,
 issued int,legacy_issued int,approved bool,rights_reference text,snapshot jsonb);
do $guard$ begin
 if exists(select 1 from commercial_billing.definitions d full join docked_reviewed_inventory_source s using(id)
  where d.id is not null and (s.id is null or to_jsonb(d) is distinct from to_jsonb(s)))
 then raise exception 'Existing immutable definition conflicts with exact reviewed manifest'; end if;
 if (select count(*) from docked_reviewed_inventory_source)<>6540
  or (select sum(legacy_issued) from docked_reviewed_inventory_source)<>888
  or exists(select 1 from docked_reviewed_inventory_source where approved or issued<>legacy_issued)
 then raise exception 'Exact complete lifetime proposal required'; end if;
end $guard$;
insert into commercial_billing.definitions(id,player_id,sport,rarity,lifetime_cap,issued,legacy_issued,approved,rights_reference,snapshot)
 select id,player_id,sport,rarity,lifetime_cap,issued,legacy_issued,approved,rights_reference,snapshot
 from docked_reviewed_inventory_source order by id on conflict(sport,player_id,rarity) do nothing;
set constraints all immediate;
do $guard$ begin
 if exists(select 1 from commercial_billing.definitions d full join docked_reviewed_inventory_source s using(id)
  where d.id is null or s.id is null or to_jsonb(d) is distinct from to_jsonb(s))
 then raise exception 'Post-import exact manifest mismatch'; end if;
 if exists(select 1 from commercial_billing.cards) or exists(select 1 from commercial_billing.packs)
  or exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled)
 then raise exception 'Import must never mint cards or activate commercial controls'; end if;
end $guard$;
`;
}

// The same immutable ID/document/custody/location binding used by the pinned
// census. Full values stay in process memory; only the digest is exported.
export const custodyQuery = `with s as(select document d from credits_sandbox.state where id),
 copies as(
  select e.key id,e.value doc,'active' loc,1 priority from s,jsonb_each(s.d#>'{economy,instances}') e
  union all select e.key,e.value,'retired',2 from s,jsonb_each(coalesce(s.d#>'{economy,retiredTestInstances}','{}')) e
  union all select id::text,document,'registry_nfl',3 from credits_sandbox.card_instances
  union all select id::text,document,'registry_fixture',4 from credits_sandbox.nba_fixture_instances
 ), grouped as(select id,(array_agg(doc order by priority))[1] doc,jsonb_agg(loc order by priority) locations from copies group by id)
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'doc',g.doc,'locations',g.locations,
 'custody',s.d#>array['commerce','cards',g.id],'ownership',s.d#>array['cards',g.id]) order by g.id),'[]') value from grouped g cross join s`;

export const schemaQuery = `select to_jsonb(c) value from (${v31SchemaFingerprintSql}) c`;

export const tableListQuery = `select coalesce(jsonb_agg(format('%I.%I',schemaname,tablename) order by schemaname,tablename),'[]') value from pg_tables where schemaname not like 'pg_%' and schemaname <> 'information_schema' and not(schemaname='net' and tablename in ('_http_response','http_request_queue'))`;
export function checksumQuery(table: string) {
  assert.match(table, /^(?:"[A-Za-z0-9_]+"|[A-Za-z0-9_]+)\.(?:"[A-Za-z0-9_]+"|[A-Za-z0-9_]+)$/);
  return `select jsonb_build_object('table','${table}','count',count(*),'hash',md5(coalesce(string_agg(h,'' order by h),''))) value from(select md5(to_jsonb(t)::text) h from ${table} t)q`;
}
