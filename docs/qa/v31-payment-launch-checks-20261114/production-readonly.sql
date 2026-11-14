begin isolation level repeatable read read only;
select jsonb_build_object('at',now(),'schema',(select to_jsonb(s) from (
with namespaces as (
 select oid,nspname,pg_get_userbyid(nspowner) owner,nspacl::text acl
 from pg_namespace where nspname not in ('pg_catalog','information_schema') and nspname !~ '^pg_'
), entries as (
 -- Cast the first UNION identity to text. PostgreSQL's name type otherwise
 -- truncates every subsequent qualified identity to 63 bytes, introducing ties
 -- and nondeterministic ordering for long constraint/function names.
 select 'namespace' kind,nspname::text identity,jsonb_build_array(owner,acl) definition from namespaces
 union all
 select 'relation',n.nspname||'.'||c.relname,jsonb_build_array(c.relkind,c.relpersistence,pg_get_userbyid(c.relowner),c.relacl::text,c.relrowsecurity,c.relforcerowsecurity,c.reloptions,
 case when c.relkind in ('v','m') then pg_get_viewdef(c.oid,true) end)
 from pg_class c join namespaces n on n.oid=c.relnamespace where c.relkind in ('r','p','v','m','S','f')
 union all
 select 'column',n.nspname||'.'||c.relname||'.'||a.attnum,jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attidentity,a.attgenerated,a.attacl::text,pg_get_expr(d.adbin,d.adrelid))
 from pg_attribute a join pg_class c on c.oid=a.attrelid join namespaces n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attnum>0 and not a.attisdropped and c.relkind in ('r','p','v','m','f')
 union all
 select 'constraint',n.nspname||'.'||c.relname||'.'||x.conname,to_jsonb(pg_get_constraintdef(x.oid,true)) from pg_constraint x join pg_class c on c.oid=x.conrelid join namespaces n on n.oid=c.relnamespace
 union all
 select 'index',n.nspname||'.'||c.relname,to_jsonb(pg_get_indexdef(c.oid)) from pg_class c join namespaces n on n.oid=c.relnamespace where c.relkind='i'
 union all
 select 'trigger',n.nspname||'.'||c.relname||'.'||t.tgname,jsonb_build_array(t.tgenabled,pg_get_triggerdef(t.oid,true)) from pg_trigger t join pg_class c on c.oid=t.tgrelid join namespaces n on n.oid=c.relnamespace where not t.tgisinternal
 union all
 select 'function',n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',jsonb_build_array(pg_get_userbyid(p.proowner),p.proacl::text,pg_get_functiondef(p.oid)) from pg_proc p join namespaces n on n.oid=p.pronamespace where p.prokind in ('f','p')
 union all
 select 'policy',schemaname||'.'||tablename||'.'||policyname,jsonb_build_array(permissive,roles,cmd,qual,with_check) from pg_policies where schemaname not in ('pg_catalog','information_schema') and schemaname !~ '^pg_'
 union all
 select 'default_acl',coalesce(n.nspname,'*')||'.'||pg_get_userbyid(d.defaclrole)||'.'||d.defaclobjtype::text,to_jsonb(d.defaclacl::text) from pg_default_acl d left join namespaces n on n.oid=d.defaclnamespace
)
select md5(coalesce(string_agg(jsonb_build_array(kind,identity,definition)::text,E'\n' order by kind,identity),'')) fingerprint,count(*)::int objects from entries) s),'permissions',(select jsonb_build_object(
 'indexesValid',(select count(*)=2 and bool_and(indisvalid) from pg_index where indexrelid in ('commercial_billing.commercial_market_request_identity'::regclass,'commercial_billing.commercial_market_listing_activity'::regclass)),
 'collectionRuntimeAllowed',has_function_privilege('docked_commercial_app','commercial_billing.preserved_collection_rows(uuid,text)','execute'),
 'marketRuntimeAllowed',has_function_privilege('docked_commercial_app','commercial_billing.market_party_allowed(uuid,uuid,text,text)','execute'),
 'memberRuntimeAllowed',has_function_privilege('docked_app','commercial_billing.member_record(text)','execute'),
 'unauthorisedExecute',exists(select 1 from unnest(array['anon','authenticated','service_role','docked_app','docked_beta_app']) r where has_function_privilege(r,'commercial_billing.preserved_collection_rows(uuid,text)','execute') or has_function_privilege(r,'commercial_billing.market_party_allowed(uuid,uuid,text,text)','execute')),
 'triggerCallable',exists(select 1 from unnest(array['anon','authenticated','service_role','docked_app','docked_beta_app','docked_commercial_app']) r where has_function_privilege(r,'commercial_billing.market_listing_guard()','execute')),
 'triggerPresent',exists(select 1 from pg_trigger where tgrelid='commercial_billing.listings'::regclass and tgname='commercial_listing_terms' and tgenabled='O'),
 'outboxExposed',exists(select 1 from unnest(array['anon','authenticated','service_role','docked_commercial_app']) r where has_table_privilege(r,'private.outbox','select,insert,update,delete')),
 'legacyMailOutboxBoundaryPreserved',
   has_table_privilege('docked_app','private.outbox','select')
   and has_table_privilege('docked_app','private.outbox','insert')
   and has_table_privilege('docked_app','private.outbox','update')
   and not has_table_privilege('docked_app','private.outbox','delete')
   and (select relrowsecurity from pg_class where oid='private.outbox'::regclass)
   and (select count(*)=4 and bool_and(permissive='RESTRICTIVE' and roles=array['public']::name[] and lower(cmd)=replace(policyname,'billing_ops_reserved_',''))
        from pg_policies where schemaname='private' and tablename='outbox'
        and policyname=any(array['billing_ops_reserved_select','billing_ops_reserved_insert','billing_ops_reserved_update','billing_ops_reserved_delete'])),
 'unclaimedViewerDenied',not commercial_billing.market_party_allowed(null,null,'','')) value),'custody_records',(select jsonb_array_length(value) from (with s as(select document d from credits_sandbox.state where id),
 copies as(
  select e.key id,e.value doc,'active' loc,1 priority from s,jsonb_each(s.d#>'{economy,instances}') e
  union all select e.key,e.value,'retired',2 from s,jsonb_each(coalesce(s.d#>'{economy,retiredTestInstances}','{}')) e
  union all select id::text,document,'registry_nfl',3 from credits_sandbox.card_instances
  union all select id::text,document,'registry_fixture',4 from credits_sandbox.nba_fixture_instances
 ), grouped as(select id,(array_agg(doc order by priority))[1] doc,jsonb_agg(loc order by priority) locations from copies group by id)
 select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'doc',g.doc,'locations',g.locations,
 'custody',s.d#>array['commerce','cards',g.id],'ownership',s.d#>array['cards',g.id]) order by g.id),'[]') value from grouped g cross join s) c),'counts',jsonb_build_object('definitions',(select count(*) from commercial_billing.definitions),'issued',(select sum(issued) from commercial_billing.definitions),'legacy_issued',(select sum(legacy_issued) from commercial_billing.definitions),'approved',(select count(*) from commercial_billing.definitions where approved),'cards',(select count(*) from commercial_billing.cards),'packs',(select count(*) from commercial_billing.packs),'accounts',(select count(*) from commercial_billing.accounts),'receipts',(select count(*) from commercial_billing.receipts),'enabled_competitions',(select count(*) from public_gameplay.rounds where enabled),'active_feature_flags',(select count(*) from private.feature_flags where enabled),'retention_enabled',(select count(*) from operations.retention_policy where enabled)),'gates',(select jsonb_build_object('environment',environment,'sales',sales_enabled,'issuance',issuance_enabled,'transfers',transfers_enabled,'gameplay',gameplay_enabled) from commercial_billing.control where id),'notifications',(select jsonb_agg(jsonb_build_object('state',state,'count',n)) from(select state,count(*) n from credits_sandbox.store_notifications group by state) x)) as evidence;
rollback;
