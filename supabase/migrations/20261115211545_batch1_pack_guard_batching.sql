-- Batch 1: retain every identity, serial, supply, ownership and receipt check.
-- Batch immutable registry reads/writes instead of thousands of SQL statements.
-- Prerequisite: 20261115113306_batch_private_pack_issuance_validation.sql.
-- No table, grant, RLS, gate, customer record or permission changes.
set local lock_timeout='3s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(71820342);
do $migration$
declare body text; old_block text; new_block text;begin
 body:=replace(pg_get_functiondef('credits_sandbox.guard_economy_state()'::regprocedure),E'\r','');
 if encode(sha256(convert_to(body,'UTF8')),'hex')<>'f3c939fc2dc3fcefccea89c3ae521df8706d47d8881ca33bfbc419cb4adb4306'
 then raise exception 'Reviewed batched guard prerequisite changed';end if;
 body:=replace(body,'issuance_counts jsonb;','issuance_counts jsonb; fixture_players jsonb; members_to_check jsonb:=''{}''; member_check record;');
 body:=replace(body,$old$ for item in select key,value from jsonb_each(_subdoc_12) loop$old$,$new$
 select coalesce(jsonb_object_agg(key,(value->>'sport' in ('basketball','afl','nrl') and
  (value->'synthetic'='true'::jsonb or credits_sandbox.is_roster_beta_player(value)))),'{}')
 into fixture_players from jsonb_each(_subdoc_12);
 for item in select p.key,p.value,f.identity fixture_identity,n.identity permanent_identity
 from jsonb_each(_subdoc_12) p
 left join credits_sandbox.nba_fixture_players f on f.id=p.key
 left join credits_sandbox.permanent_players n on n.id=p.key loop$new$);
 body:=replace(body,$old$(item.value->>'sport' in ('basketball','afl','nrl') and (item.value->'synthetic'='true'::jsonb or credits_sandbox.is_roster_beta_player(item.value)))$old$,$new$coalesce((fixture_players->>item.key)::boolean,false)$new$);
 body:=replace(body,'select identity into registered from credits_sandbox.nba_fixture_players where id=item.key;','registered:=item.fixture_identity;');
 body:=replace(body,'select identity into registered from credits_sandbox.permanent_players where id=item.key;','registered:=item.permanent_identity;');
 body:=replace(body,$old$ for item in select key,value from jsonb_each(e->'products') loop$old$,$new$ for item in select p.key,p.value,c.document configuration
 from jsonb_each(e->'products') p left join credits_sandbox.pack_configuration c on c.version=p.value->>'version' loop$new$);
 body:=replace(body,$old$select document into registered from credits_sandbox.pack_configuration where version=item.value->>'version';$old$,$new$registered:=item.configuration;$new$);
 old_block:=$old$  if (_subdoc_12->(item.value->>'playerId')->>'sport' in ('basketball','afl','nrl') and (_subdoc_12->(item.value->>'playerId')->'synthetic'='true'::jsonb or credits_sandbox.is_roster_beta_player(_subdoc_12->(item.value->>'playerId')))) then
   if not exists(select 1 from credits_sandbox.nba_fixture_definitions where id=item.key) then insert into credits_sandbox.nba_fixture_definitions values(item.key,item.value->>'playerId',item.value->>'rarity',e->>'rarityVersion',(config->'rarities'->(item.value->>'rarity')->>'lifetimeCap')::int);end if;
  else
   insert into credits_sandbox.card_definitions values(item.key,item.value->>'playerId',item.value->>'rarity',e->>'rarityVersion',(config->'rarities'->(item.value->>'rarity')->>'lifetimeCap')::int) on conflict do nothing;
  end if;$old$;
 if position(old_block in body)=0 then raise exception 'Definition batching anchor changed';end if;
 body:=replace(body,old_block,'');
 old_block:=$old$ for item in select key,value from jsonb_each(_subdoc_13) order by (value->>'serial')::int loop$old$;
 new_block:=$new$
 -- Existing registry rows are immutable. Validate their complete binding before
 -- omitting conflict-only inserts; genuinely new rows still run all table guards.
 if exists(select 1 from jsonb_each(_subdoc_15) x join (
  select d.*,false fixture from credits_sandbox.card_definitions d
  union all select d.*,true fixture from credits_sandbox.nba_fixture_definitions d
 ) d on d.id=x.key and d.fixture=coalesce((fixture_players->>(x.value->>'playerId'))::boolean,false)
 where d.player_id is distinct from x.value->>'playerId' or d.rarity is distinct from x.value->>'rarity'
  or d.rarity_version is distinct from e->>'rarityVersion'
  or d.lifetime_cap is distinct from (config->'rarities'->(x.value->>'rarity')->>'lifetimeCap')::int)
 then raise exception 'Permanent definition binding mismatch';end if;
 insert into credits_sandbox.card_definitions(id,player_id,rarity,rarity_version,lifetime_cap)
 select x.key,x.value->>'playerId',x.value->>'rarity',e->>'rarityVersion',
  (config->'rarities'->(x.value->>'rarity')->>'lifetimeCap')::int
 from jsonb_each(_subdoc_15) x
 where not coalesce((fixture_players->>(x.value->>'playerId'))::boolean,false)
 and not exists(select 1 from credits_sandbox.card_definitions d where d.id=x.key)
 on conflict do nothing;
 insert into credits_sandbox.nba_fixture_definitions(id,player_id,rarity,rarity_version,lifetime_cap)
 select x.key,x.value->>'playerId',x.value->>'rarity',e->>'rarityVersion',
  (config->'rarities'->(x.value->>'rarity')->>'lifetimeCap')::int
 from jsonb_each(_subdoc_15) x
 where coalesce((fixture_players->>(x.value->>'playerId'))::boolean,false)
 and not exists(select 1 from credits_sandbox.nba_fixture_definitions d where d.id=x.key);
 for item in select x.key,x.value,f.document fixture_document,n.document permanent_document
 from jsonb_each(_subdoc_13) x
 left join credits_sandbox.nba_fixture_instances f on f.id=x.key::uuid
 left join credits_sandbox.card_instances n on n.id=x.key::uuid
 order by (x.value->>'serial')::int loop$new$;
 if position(old_block in body)=0 then raise exception 'Instance batching anchor changed';end if;
 body:=replace(body,old_block,new_block);
 body:=replace(body,$old$(_subdoc_12->(item.value->>'playerId')->>'sport' in ('basketball','afl','nrl') and (_subdoc_12->(item.value->>'playerId')->'synthetic'='true'::jsonb or credits_sandbox.is_roster_beta_player(_subdoc_12->(item.value->>'playerId'))))$old$,$new$coalesce((fixture_players->>(item.value->>'playerId'))::boolean,false)$new$);
 body:=replace(body,'select document into registered from credits_sandbox.nba_fixture_instances where id=item.key::uuid;','registered:=item.fixture_document;');
 body:=replace(body,'select document into registered from credits_sandbox.card_instances where id=item.key::uuid;','registered:=item.permanent_document;');
 body:=replace(body,$old$ for item in select key,value from jsonb_each(_subdoc_14) loop$old$,$new$ for item in select p.key,p.value,c.document configuration,r.document receipt
 from jsonb_each(_subdoc_14) p
 left join credits_sandbox.pack_configuration c on c.version=p.value->'product'->>'version'
 left join credits_sandbox.pack_receipts r on r.id=p.key loop$new$);
 body:=replace(body,$old$select document into registered from credits_sandbox.pack_configuration where version=item.value->'product'->>'version';$old$,'registered:=item.configuration;');
 body:=replace(body,'select document into registered from credits_sandbox.pack_receipts where id=item.key;','registered:=item.receipt;');
 -- Every historical card in every receipt uses the same immutable union. Do
 -- not reconstruct the complete allocation object for each card in each pack.
 body:=replace(body,$old$(coalesce(_subdoc_16,'{}') || (_subdoc_13))$old$,'(all_instances)');
 body:=replace(body,$old$_subdoc_16 jsonb:=e->'retiredTestInstances';begin$old$,$new$_subdoc_16 jsonb:=e->'retiredTestInstances'; all_instances jsonb:=coalesce(_subdoc_16,'{}')||_subdoc_13;begin$new$);
 -- Revalidate every distinct affected member/sport at the END of the statement.
 -- Checks use the current time and retain all identity/MFA/admission/expiry
 -- semantics. Any rejection rolls back every row written by this statement.
 -- Repeating the same admission query for each card adds no protection.
 body:=replace(body,$old$perform credits_sandbox.assert_sport_fixture_member(_subdoc_0->item.key->>'owner',fixture_sport);$old$,$new$members_to_check:=members_to_check||jsonb_build_object((_subdoc_0->item.key->>'owner')||':'||fixture_sport,jsonb_build_array(_subdoc_0->item.key->>'owner',fixture_sport));$new$);
 body:=replace(body,$old$perform credits_sandbox.assert_sport_fixture_member(_subdoc_1->item.key->>'owner',fixture_sport);$old$,$new$members_to_check:=members_to_check||jsonb_build_object((_subdoc_1->item.key->>'owner')||':'||fixture_sport,jsonb_build_array(_subdoc_1->item.key->>'owner',fixture_sport));$new$);
 body:=replace(body,$old$perform credits_sandbox.assert_sport_fixture_member(item.value->>'member',fixture_sport);$old$,$new$members_to_check:=members_to_check||jsonb_build_object((item.value->>'member')||':'||fixture_sport,jsonb_build_array(item.value->>'member',fixture_sport));$new$);
 body:=replace(body,$old$ return new;$old$,$new$ for member_check in select value from jsonb_each(members_to_check) loop
  perform credits_sandbox.assert_sport_fixture_member(member_check.value->>0,member_check.value->>1);
 end loop;
 return new;$new$);
 execute replace(body,E'\r','');
end $migration$;

-- PostgreSQL may switch to a generic plan after repeated executions. Cache the
-- ownership inputs before that query so it cannot decompress/extract the full
-- financial aggregate once for each existing card. Reserved-team protection
-- and its global lock are unchanged.
do $migration$
declare body text;begin
 body:=replace(pg_get_functiondef('sports_feed.rarity_transfer_guard()'::regprocedure),E'\r','');
 if encode(sha256(convert_to(body,'UTF8')),'hex')<>'a4f4fa4f13397fbbd63e4b87ae56ae68bc9a882e7e4b68bef61b39129a54454f'
 then raise exception 'Reviewed reserved-card guard prerequisite changed';end if;
 body:=replace(body,'begin', $new$declare previous_cards jsonb:=old.document#>'{commerce,cards}';
 current_cards jsonb:=new.document#>'{commerce,cards}';begin$new$);
 body:=replace(body,$old$old.document->'commerce'->'cards'$old$,'previous_cards');
 body:=replace(body,$old$new.document->'commerce'->'cards'$old$,'current_cards');
 execute body;
end $migration$;

-- Evaluate the full-repair predicate once, not once per owned card when the
-- statement uses a generic cached plan. No-op repair behavior stays intact.
do $migration$
declare body text;begin
 body:=replace(pg_get_functiondef('credits_sandbox.project_fixture_inventory()'::regprocedure),E'\r','');
 if encode(sha256(convert_to(body,'UTF8')),'hex')<>'2e2bdcf78ce4ded4fa24e190d0f5fb343e046cd49810b340414c56b05c9a19a4'
 then raise exception 'Reviewed projection prerequisite changed';end if;
 body:=replace(body,'target record;', 'target record; full_repair boolean:=_cached_old_document is not distinct from _cached_new_document;');
 body:=replace(body,$old$where _cached_old_document is not distinct from _cached_new_document$old$,'where full_repair');
 if position('where full_repair' in body)=0 then raise exception 'Full repair predicate rewrite did not apply';end if;
 execute body;
end $migration$;

-- This guard also protects direct inventory writes. Cache the two immutable
-- input subdocuments once, retaining every existing ledger/admission check.
do $migration$
declare body text;begin
 body:=replace(pg_get_functiondef('commercial_billing.prevent_parallel_inventory()'::regprocedure),E'\r','');
 if encode(sha256(convert_to(body,'UTF8')),'hex')<>'7478624b18760c2aa5b2aeb0617f4611fd6f8bae26c3bc3aa1ee5c82455aa56a'
 then raise exception 'Reviewed parallel inventory guard prerequisite changed';end if;
 body:=replace(body,'declare state jsonb;', 'declare state_players jsonb; state_instances jsonb;');
 body:=replace(body,'select document::text::jsonb into state from credits_sandbox.state limit 1;',
  $new$select document#>'{economy,players}',document#>'{economy,instances}'
   into state_players,state_instances from credits_sandbox.state limit 1;
  state_instances:=coalesce(state_instances,'{}');$new$);
 body:=replace(body,$old$state->'economy'->'players'->pid$old$,'state_players->pid');
 body:=replace(body,$old$coalesce(state->'economy'->'instances','{}'::jsonb)$old$,'state_instances');
 -- The original predicate can reject only the five permanent rarities. Filter
 -- that set before loading the financial aggregate; Core/display-only rows
 -- previously did all the same work before reaching an always-false predicate.
 body:=replace(body,$old$select document#>'{economy,players}',document#>'{economy,instances}'
   into state_players,state_instances from credits_sandbox.state limit 1;
  state_instances:=coalesce(state_instances,'{}');$old$,'');
 body:=replace(body,$old$ for item in select value from jsonb_array_elements(items) loop$old$,$new$
 if not exists(select 1 from jsonb_array_elements(items) x where x->>'rarity' in('RARE','ELITE','ULTRA_RARE','LEGENDARY','ICON')) then return new;end if;
 select document#>'{economy,players}',document#>'{economy,instances}'
  into state_players,state_instances from credits_sandbox.state limit 1;
 state_instances:=coalesce(state_instances,'{}');
 for item in select value from jsonb_array_elements(items) where value->>'rarity' in('RARE','ELITE','ULTRA_RARE','LEGENDARY','ICON') loop$new$);
 if position('into state_players,state_instances' in body)=0 or position('state->' in body)>0
 then raise exception 'Inventory subdocument caching rewrite did not apply';end if;
 execute body;
end $migration$;

