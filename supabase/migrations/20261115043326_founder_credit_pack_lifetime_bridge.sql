-- Default-off private free-credit packs. No admission, grants, mint, checkout,
-- source adoption or activation occurs in this schema migration.
create schema beta_packs;
revoke all on schema beta_packs from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
alter table season_catalogue.rights drop constraint rights_scope_check;
alter table season_catalogue.rights add constraint rights_scope_check check(scope in('free_weekly','commercial','free_beta_packs'));
create table beta_packs.control(
 id boolean primary key default true check(id), enabled boolean not null default false,
 grants_enabled boolean not null default false, authority_reference text not null default 'Prepared only; no activation authority installed'
);
insert into beta_packs.control(id) values(true);
create table beta_packs.members(member_id uuid primary key,authority_reference text not null check(length(authority_reference)>20));
create table beta_packs.definitions(
 definition uuid primary key references commercial_billing.definitions,
 legacy_player text not null,player_id uuid not null,sport text not null check(sport in('nfl','afl','nrl')),
 rarity text not null,season text not null,rights_id text not null references season_catalogue.rights,
 evidence_sha256 text not null check(evidence_sha256~'^[a-f0-9]{64}$'),
 unique(legacy_player,rarity)
);
create table beta_packs.products(id text primary key,document jsonb not null,
 check(document->>'cataloguePolicy'='founder-credit-season-v1'),
 check(document->>'id'=id),check(document->>'sport' in('nfl','afl','nrl')));
create table beta_packs.issued(
 card uuid primary key,definition uuid not null references beta_packs.definitions,
 serial int not null check(serial>0),pack text not null,member_id uuid not null,
 allocation jsonb not null,rights_id text not null references season_catalogue.rights,
 created_at timestamptz not null default clock_timestamp(),unique(definition,serial)
);
create index beta_pack_member on beta_packs.issued(member_id,pack);
create table beta_packs.events(id bigint generated always as identity primary key,
 action text not null,actor uuid,details jsonb not null,created_at timestamptz not null default clock_timestamp());
create function beta_packs.serialize_control() returns trigger language plpgsql set search_path='' as $$begin
 perform pg_advisory_xact_lock(71820342);return null;end$$;
create trigger beta_control_lock before update on beta_packs.control for each statement execute function beta_packs.serialize_control();
create trigger commercial_beta_control_lock before update on commercial_billing.control for each statement execute function beta_packs.serialize_control();
create function beta_packs.control_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if tg_table_schema='beta_packs' then
  if (new.enabled or new.grants_enabled) and (length(new.authority_reference)<21 or exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled))
  then raise exception 'Reviewed private free-credit authority and closed commercial controls required';end if;
 else
  if (new.sales_enabled or new.issuance_enabled or new.transfers_enabled or new.gameplay_enabled) and exists(select 1 from beta_packs.control where enabled or grants_enabled)
  then raise exception 'Close founder-credit issuance before commercial activation';end if;
 end if;
 insert into beta_packs.events(action,actor,details) values('control-change',auth.uid(),jsonb_build_object('schema',tg_table_schema,'before',to_jsonb(old),'after',to_jsonb(new)));
 return new;end$$;
create trigger beta_control_guard before update on beta_packs.control for each row execute function beta_packs.control_guard();
create trigger commercial_beta_control_guard before update on commercial_billing.control for each row execute function beta_packs.control_guard();
create function beta_packs.member_allowed(u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from beta_packs.members m join credits_sandbox.access a on a.user_id=m.member_id where m.member_id=u and a.enabled and beta_private.admitted(u))
$$;
create function beta_packs.catalogue() returns jsonb language sql stable security definer set search_path='' as $$
 -- Evaluate retained-source rights once as sets. Calling the scalar helper for
 -- every rarity repeatedly scans the same memberships on a newly adopted pool.
 -- These are the same time/global/player restrictions as can_issue; capture()
 -- independently rechecks that helper under the settlement lock at issuance.
 with decisions as materialized(
  select distinct on(rights_id,player_id) rights_id,player_id,blocked
  from season_catalogue.decisions order by rights_id,player_id,id desc
 ), eligible as materialized(
  select m.sport,m.season,m.player_id,m.scope,m.rights_id,m.snapshot->>'team' team
  from season_catalogue.members m join season_catalogue.rights r on r.id=m.rights_id
  left join decisions g on g.rights_id=r.id and g.player_id is null
  left join decisions p on p.rights_id=r.id and p.player_id=m.player_id
  where r.valid_from<=statement_timestamp() and(r.valid_until is null or r.valid_until>statement_timestamp())
   and not coalesce(g.blocked,false) and not coalesce(p.blocked,false)
 )
 select jsonb_build_object('enabled',c.enabled and not exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled),
 'players',coalesce((select jsonb_agg(p order by p->>'legacyPlayer') from(
 select jsonb_build_object('legacyPlayer',b.legacy_player,'canonicalPlayer',b.player_id,'team',m.team,
 'definitions',jsonb_agg(jsonb_build_object('rarity',b.rarity,'issued',d.issued)order by b.rarity)) p
 from beta_packs.definitions b join commercial_billing.definitions d on d.id=b.definition
 join eligible m on m.player_id=b.player_id and m.sport=b.sport and m.season=b.season and m.scope='free_beta_packs' and m.rights_id=b.rights_id
 join eligible w on w.player_id=b.player_id and w.sport=b.sport and w.season=b.season and w.scope='free_weekly'
 group by b.legacy_player,b.player_id,m.team having count(*)=5) q),'[]'::jsonb))
 from beta_packs.control c where id
$$;
create function beta_packs.owner_members() returns jsonb language plpgsql security definer set search_path='' as $$begin
 perform operations.owner_actor();
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.user_id,'label',a.label) order by a.label,a.user_id) from credits_sandbox.access a join beta_packs.members m on m.member_id=a.user_id where beta_packs.member_allowed(a.user_id)),'[]'::jsonb);
end$$;
create function beta_packs.assert_grant(u uuid) returns void language plpgsql security definer set search_path='' as $$declare c beta_packs.control;begin
 perform operations.owner_actor();
 select * into strict c from beta_packs.control where id for share;
 if not c.grants_enabled or not beta_packs.member_allowed(u) then raise exception 'Founder free-credit grant unavailable for this member';end if;
 if exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled)then raise exception 'Commercial controls must remain closed';end if;
end$$;
create function beta_packs.registered(card_id uuid,legacy_definition text,serial_id int) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from beta_packs.issued i where i.card=card_id and i.serial=serial_id and i.allocation->>'definition'=legacy_definition)
$$;
create function beta_packs.capture(before_document jsonb,after_document jsonb) returns void
 language plpgsql security definer set search_path='' as $$
declare previous jsonb:=(before_document->'economy')::text::jsonb; e jsonb:=(after_document->'economy')::text::jsonb;
 c beta_packs.control; u uuid:=auth.uid(); item record; pack_record record; p jsonb; product jsonb;
 b beta_packs.definitions; d commercial_billing.definitions; new_count int; pack_count int; registered_count int:=0;
begin
 select count(*) into new_count from jsonb_each(coalesce(e->'instances','{}')) x where not coalesce(previous->'instances','{}')?x.key;
 if new_count=0 then return;end if;
 if not exists(select 1 from pg_locks where pid=pg_backend_pid() and locktype='advisory' and classid=0 and objid=71820342 and objsubid=1 and granted)
 then raise exception 'Locked wallet transaction required';end if;
 select * into strict c from beta_packs.control where id for share;
 perform id from commercial_billing.control where id for share;
 if not c.enabled or not beta_packs.member_allowed(u) or not beta_private.active_member_session()
  or exists(select 1 from credits_sandbox.access where user_id=u and kind='owner' and auth.jwt()->>'aal' is distinct from 'aal2')
  or exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled)
 then raise exception 'Founder-credit pack access unavailable';end if;
 if after_document#>>'{policy,liveEnabled}' is distinct from 'false' or after_document#>>'{policy,purchasedWithdrawable}' is distinct from 'false'
 then raise exception 'Free nonwithdrawable beta credits required';end if;
 select count(*) into pack_count from jsonb_each(e->'packs') x where not coalesce(previous->'packs','{}')?x.key;
 if pack_count<>1 then raise exception 'Exactly one complete pack transaction required';end if;
 select * into strict pack_record from jsonb_each(e->'packs') x where not coalesce(previous->'packs','{}')?x.key;
 p:=pack_record.value;
 select document into product from beta_packs.products where id=p->'product'->>'id';
 if product is null or product is distinct from p->'product' or p->>'member' is distinct from u::text
  or p->>'id' is distinct from pack_record.key or new_count<>(product->>'cards')::int
  or jsonb_array_length(p->'cards')<>new_count or p->>'openedAt' is not null
  or (select count(distinct e->'instances'->id->>'playerId') from jsonb_array_elements_text(p->'cards') id)<>new_count
 then raise exception 'Registered complete founder-credit pack required';end if;
 for item in select key,value from jsonb_each(e->'instances') x where not coalesce(previous->'instances','{}')?x.key order by key loop
  if not (p->'cards')?item.key or item.value->>'source' is distinct from pack_record.key
   or after_document#>>array['commerce','cards',item.key,'owner'] is distinct from u::text
  then raise exception 'Pack ownership and receipt mismatch';end if;
  select * into b from beta_packs.definitions where legacy_player=item.value->>'playerId' and rarity=item.value->>'rarity';
  if b.definition is null or b.sport is distinct from product->>'sport' or not season_catalogue.can_issue(b.sport,b.season,b.player_id,'free_beta_packs')
   or not season_catalogue.can_issue(b.sport,b.season,b.player_id,'free_weekly')
  then raise exception 'Approved season identity and source rights required';end if;
  select * into strict d from commercial_billing.definitions where id=b.definition for update;
  if item.value->>'definition' is distinct from b.legacy_player||':'||b.rarity
   or (item.value->>'serial')::int is distinct from d.issued+1 or d.issued>=d.lifetime_cap
   or (item.value->>'lifetimeCap')::int is distinct from d.lifetime_cap
   or d.issued<>coalesce((previous->'definitions'->(b.legacy_player||':'||b.rarity)->>'issued')::int,0)
   or exists(select 1 from commercial_billing.cards where id=item.key::uuid or (definition=d.id and serial=(item.value->>'serial')::int))
  then raise exception 'Permanent lifetime supply or serial mismatch';end if;
  insert into beta_packs.issued(card,definition,serial,pack,member_id,allocation,rights_id)
   values(item.key::uuid,d.id,(item.value->>'serial')::int,pack_record.key,u,item.value,b.rights_id);
  update commercial_billing.definitions set issued=issued+1 where id=d.id;
  registered_count:=registered_count+1;
 end loop;
 if registered_count<>new_count then raise exception 'Incomplete permanent allocation';end if;
 insert into beta_packs.events(action,actor,details)values('pack-issued',u,jsonb_build_object('pack',pack_record.key,'cards',registered_count,'product',product->>'id','creditPrice',product->'priceCredits','moneyReceived',false));
end$$;
create or replace function commercial_billing.prevent_parallel_mint() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from commercial_billing.definitions) then
  perform beta_packs.capture(old.document,new.document);
 end if;return new;end$$;
create or replace function commercial_billing.supply_balanced() returns trigger language plpgsql security definer set search_path='' as $$
declare target uuid;d commercial_billing.definitions;begin
 if tg_table_name in('cards','issued') then target:=new.definition;else target:=new.id;end if;
 select * into strict d from commercial_billing.definitions where id=target;
 if d.issued<>d.legacy_issued+(select count(*)from commercial_billing.cards where definition=target)+(select count(*)from beta_packs.issued where definition=target)
 then raise exception 'Lifetime counter must equal preserved issuance and all recorded new cards';end if;return null;end$$;
create constraint trigger beta_supply_balanced after insert on beta_packs.issued deferrable initially deferred for each row execute function commercial_billing.supply_balanced();
create function beta_packs.prevent_serial_collision() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from beta_packs.issued where card=new.id or(definition=new.definition and serial=new.serial))then raise exception 'Permanent beta serial already consumed';end if;return new;end$$;
create trigger beta_serial_collision before insert on commercial_billing.cards for each row execute function beta_packs.prevent_serial_collision();
-- Preserve every pre-existing guard; recognise only the new authoritative entry.
do $$declare body text;needle text;begin
 body:=pg_get_functiondef('commercial_billing.prevent_parallel_inventory()'::regprocedure);
 needle:='and not exists(select 1 from commercial_billing.cards c where c.id::text=cid)';
 if position(needle in body)=0 then raise exception 'Parallel inventory guard changed; review required';end if;
 body:=replace(body,needle,needle||E'\n   and not exists(select 1 from beta_packs.issued bi where bi.card::text=cid and bi.allocation @> (item-''id''))');
 -- The existing guard repeatedly serialised the complete multi-MB mirror row
 -- for every card. Cache exact values once; retain every original predicate.
 if position('select document into state from credits_sandbox.state limit 1;' in body)=0
  or position('declare state jsonb; item jsonb;' in body)=0
 then raise exception 'Inventory cache anchors changed; review required';end if;
 body:=replace(body,'to_jsonb(new)','_cached_new_row');
 body:=replace(body,'to_jsonb(old)','_cached_old_row');
 body:=replace(body,'select document into state from credits_sandbox.state limit 1;','select document::text::jsonb into state from credits_sandbox.state limit 1;');
 body:=replace(body,'declare state jsonb; item jsonb;','declare state jsonb; _cached_new_row jsonb:=to_jsonb(new)::text::jsonb; _cached_old_row jsonb:=to_jsonb(old)::text::jsonb; item jsonb;');
 execute body;
 body:=pg_get_functiondef('nfl_roster.guard_mint()'::regprocedure);
 needle:='if sport=''nfl'' and not nfl_roster.can_issue(pid,pos)';
 if position(needle in body)=0 then raise exception 'NFL mint guard changed; review required';end if;
 execute replace(body,needle,E'if tg_table_schema=''credits_sandbox'' then\n  if beta_packs.registered(new.id,new.definition,new.serial) then return new;end if;\n end if;\n '||needle);
 body:=pg_get_functiondef('operations.review(text,jsonb)'::regprocedure);
 needle:='d.legacy_issued+(select count(*) from commercial_billing.cards c where c.definition=d.id)';
 if position(needle in body)=0 then raise exception 'Operational supply observation changed; review required';end if;
 execute replace(body,needle,needle||'+(select count(*) from beta_packs.issued b where b.definition=d.id)');
end$$;
do $$declare t text;begin
 foreach t in array array['control','members','definitions','products','issued','events']loop
  execute format('alter table beta_packs.%I enable row level security',t);
  execute format('revoke all on beta_packs.%I from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app',t);
  execute format('create trigger no_truncate before truncate on beta_packs.%I for each statement execute function commercial_billing.immutable()',t);
  if t<>'control' then execute format('create trigger immutable before update or delete on beta_packs.%I for each row execute function commercial_billing.immutable()',t);end if;
 end loop;
end$$;
revoke all on all functions in schema beta_packs from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
revoke all on all sequences in schema beta_packs from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant usage on schema beta_packs to docked_beta_app;
grant execute on function beta_packs.catalogue(),beta_packs.owner_members(),beta_packs.assert_grant(uuid),beta_packs.registered(uuid,text,int) to docked_beta_app;
revoke all on function commercial_billing.supply_balanced() from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
