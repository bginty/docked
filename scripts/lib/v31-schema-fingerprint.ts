/** Read-only deterministic catalogue fingerprint. OIDs, timestamps and row data
 * are excluded; function/trigger/view definitions, ACLs and RLS are covered.
 * Use on the same hosted database before an approved change; a --no-owner local
 * restore intentionally has different object owners and is a separate proof. */
export const v31SchemaFingerprintSql = `
with namespaces as (
 select oid,nspname,pg_get_userbyid(nspowner) owner,nspacl::text acl
 from pg_namespace where nspname not in ('pg_catalog','information_schema') and nspname !~ '^pg_'
), entries as (
 select 'namespace' kind,nspname identity,jsonb_build_array(owner,acl) definition from namespaces
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
select md5(coalesce(string_agg(jsonb_build_array(kind,identity,definition)::text,E'\\n' order by kind,identity),'')) fingerprint,count(*)::int objects from entries`;
