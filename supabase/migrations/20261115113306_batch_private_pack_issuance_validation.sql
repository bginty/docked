-- Preserve all issuance, source and ownership guards.
-- Count allocations once and rebuild only affected fixture inventory.
-- Explicit no-op state updates retain the full projection repair behavior.
-- Install inside one transaction, serialised with existing wallet mutations.
set local lock_timeout='3s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(71820342);
do $migration$
declare body text;begin
 body:=pg_get_functiondef('credits_sandbox.guard_economy_state()'::regprocedure);
 body:=replace(body,E'\r','');
 if encode(sha256(convert_to(body,'UTF8')),'hex')<>'05d8b643f33d6103791775897981590a059648f0f84bda601713517024467da4' then raise exception 'Reviewed guard_economy_state baseline changed';end if;
 body:=replace(body,$change$cnt int;$change$,$change$cnt int; issuance_counts jsonb;$change$);
 body:=replace(body,$change$ for item in select key,value from jsonb_each(e->'definitions') loop$change$,$change$ select coalesce(jsonb_object_agg(definition,n),'{}') into issuance_counts
 from (select value->>'definition' definition,count(*) n
  from jsonb_each(coalesce(e->'retiredTestInstances','{}') || (e->'instances'))
  where value->>'definition' is not null group by value->>'definition') counted;
 for item in select key,value from jsonb_each(e->'definitions') loop$change$);
 body:=replace(body,$change$  select count(*) into cnt from jsonb_each(coalesce(e->'retiredTestInstances','{}') || (e->'instances')) x where x.value->>'definition'=item.key;$change$,$change$  cnt := coalesce((issuance_counts->>item.key)::int,0);$change$);
 body:=replace(body,$change$_cached_new_document->'commerce'->'cards'$change$,$change$_subdoc_0$change$);
 body:=replace(body,$change$_cached_old_document->'commerce'->'cards'$change$,$change$_subdoc_1$change$);
 body:=replace(body,$change$_cached_new_document->'cards'$change$,$change$_subdoc_2$change$);
 body:=replace(body,$change$_cached_old_document->'cards'$change$,$change$_subdoc_3$change$);
 body:=replace(body,$change$_cached_new_document->'listings'$change$,$change$_subdoc_4$change$);
 body:=replace(body,$change$_cached_old_document->'listings'$change$,$change$_subdoc_5$change$);
 body:=replace(body,$change$_cached_old_document->'economy'->'instances'$change$,$change$_subdoc_6$change$);
 body:=replace(body,$change$_cached_old_document->'economy'->'players'$change$,$change$_subdoc_7$change$);
 body:=replace(body,$change$_cached_old_document->'economy'->'packs'$change$,$change$_subdoc_8$change$);
 body:=replace(body,$change$previous->'instances'$change$,$change$_subdoc_9$change$);
 body:=replace(body,$change$previous->'packs'$change$,$change$_subdoc_10$change$);
 body:=replace(body,$change$previous->'retiredTestInstances'$change$,$change$_subdoc_11$change$);
 body:=replace(body,$change$e->'players'$change$,$change$_subdoc_12$change$);
 body:=replace(body,$change$e->'instances'$change$,$change$_subdoc_13$change$);
 body:=replace(body,$change$e->'packs'$change$,$change$_subdoc_14$change$);
 body:=replace(body,$change$e->'definitions'$change$,$change$_subdoc_15$change$);
 body:=replace(body,$change$e->'retiredTestInstances'$change$,$change$_subdoc_16$change$);
 body:=overlay(body placing $change$ _subdoc_0 jsonb:=_cached_new_document->'commerce'->'cards'; _subdoc_1 jsonb:=_cached_old_document->'commerce'->'cards'; _subdoc_2 jsonb:=_cached_new_document->'cards'; _subdoc_3 jsonb:=_cached_old_document->'cards'; _subdoc_4 jsonb:=_cached_new_document->'listings'; _subdoc_5 jsonb:=_cached_old_document->'listings'; _subdoc_6 jsonb:=_cached_old_document->'economy'->'instances'; _subdoc_7 jsonb:=_cached_old_document->'economy'->'players'; _subdoc_8 jsonb:=_cached_old_document->'economy'->'packs'; _subdoc_9 jsonb:=previous->'instances'; _subdoc_10 jsonb:=previous->'packs'; _subdoc_11 jsonb:=previous->'retiredTestInstances'; _subdoc_12 jsonb:=e->'players'; _subdoc_13 jsonb:=e->'instances'; _subdoc_14 jsonb:=e->'packs'; _subdoc_15 jsonb:=e->'definitions'; _subdoc_16 jsonb:=e->'retiredTestInstances';begin$change$ from position('begin' in body) for 5);
 execute body;
end $migration$;
do $migration$
declare body text;begin
 body:=pg_get_functiondef('credits_sandbox.project_fixture_inventory()'::regprocedure);
 body:=replace(body,E'\r','');
 if encode(sha256(convert_to(body,'UTF8')),'hex')<>'197f45fa18685fdb244c7fd97807ca5748ad5615ef78d1b4db2da1d1d0fc338c' then raise exception 'Reviewed project_fixture_inventory baseline changed';end if;
 body:=replace(body,$change$ for target in
  select distinct c.value->>'owner' member,p.identity->>'sport' sport
  from jsonb_each(coalesce(_cached_old_document->'commerce'->'cards','{}')||coalesce(_cached_new_document->'commerce'->'cards','{}')) c
  join credits_sandbox.nba_fixture_instances i on i.id::text=c.key
  join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId'
  union
  select distinct c.value->>'owner',p.identity->>'sport'
  from jsonb_each(coalesce(_cached_old_document->'commerce'->'cards','{}')) c
  join credits_sandbox.nba_fixture_instances i on i.id::text=c.key
  join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId'$change$,$change$ for target in
  with listing_changes as (
   select distinct l.value->>'card' card
   from (select key,value from jsonb_each(coalesce(_cached_old_document->'listings','{}'))
         union all select key,value from jsonb_each(coalesce(_cached_new_document->'listings','{}'))) l
   where _cached_old_document->'listings'->l.key is distinct from _cached_new_document->'listings'->l.key
  ), owners as (
   select key,value from jsonb_each(coalesce(_cached_old_document->'commerce'->'cards','{}'))
   union all select key,value from jsonb_each(coalesce(_cached_new_document->'commerce'->'cards','{}'))
  )
  select distinct c.value->>'owner' member,p.identity->>'sport' sport
  from owners c
  join credits_sandbox.nba_fixture_instances i on i.id::text=c.key
  join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId'
  where _cached_old_document is not distinct from _cached_new_document
   or _cached_old_document->'commerce'->'cards'->c.key is distinct from _cached_new_document->'commerce'->'cards'->c.key
   or _cached_old_document->'economy'->'instances'->c.key is distinct from e->'instances'->c.key
   or _cached_old_document->'economy'->'players'->p.id is distinct from e->'players'->p.id
   or _cached_old_document->'economy'->'packs'->(i.document->>'source')->'openedAt' is distinct from e->'packs'->(i.document->>'source')->'openedAt'
   or exists(select 1 from listing_changes l where l.card=c.key)
   or not exists(select 1 from sports_feed.sport_sandbox_inventory inv where inv.user_id=(c.value->>'owner')::uuid and inv.sport=p.identity->>'sport')$change$);
 body:=replace(body,$change$_cached_new_document->'commerce'->'cards'$change$,$change$_subdoc_0$change$);
 body:=replace(body,$change$_cached_old_document->'commerce'->'cards'$change$,$change$_subdoc_1$change$);
 body:=replace(body,$change$_cached_new_document->'cards'$change$,$change$_subdoc_2$change$);
 body:=replace(body,$change$_cached_old_document->'cards'$change$,$change$_subdoc_3$change$);
 body:=replace(body,$change$_cached_new_document->'listings'$change$,$change$_subdoc_4$change$);
 body:=replace(body,$change$_cached_old_document->'listings'$change$,$change$_subdoc_5$change$);
 body:=replace(body,$change$_cached_old_document->'economy'->'instances'$change$,$change$_subdoc_6$change$);
 body:=replace(body,$change$_cached_old_document->'economy'->'players'$change$,$change$_subdoc_7$change$);
 body:=replace(body,$change$_cached_old_document->'economy'->'packs'$change$,$change$_subdoc_8$change$);
 body:=replace(body,$change$e->'players'$change$,$change$_subdoc_9$change$);
 body:=replace(body,$change$e->'instances'$change$,$change$_subdoc_10$change$);
 body:=replace(body,$change$e->'packs'$change$,$change$_subdoc_11$change$);
 body:=replace(body,$change$e->'definitions'$change$,$change$_subdoc_12$change$);
 body:=replace(body,$change$e->'retiredTestInstances'$change$,$change$_subdoc_13$change$);
 body:=overlay(body placing $change$ _subdoc_0 jsonb:=_cached_new_document->'commerce'->'cards'; _subdoc_1 jsonb:=_cached_old_document->'commerce'->'cards'; _subdoc_2 jsonb:=_cached_new_document->'cards'; _subdoc_3 jsonb:=_cached_old_document->'cards'; _subdoc_4 jsonb:=_cached_new_document->'listings'; _subdoc_5 jsonb:=_cached_old_document->'listings'; _subdoc_6 jsonb:=_cached_old_document->'economy'->'instances'; _subdoc_7 jsonb:=_cached_old_document->'economy'->'players'; _subdoc_8 jsonb:=_cached_old_document->'economy'->'packs'; _subdoc_9 jsonb:=e->'players'; _subdoc_10 jsonb:=e->'instances'; _subdoc_11 jsonb:=e->'packs'; _subdoc_12 jsonb:=e->'definitions'; _subdoc_13 jsonb:=e->'retiredTestInstances';begin$change$ from position('begin' in body) for 5);
 execute body;
end $migration$;
