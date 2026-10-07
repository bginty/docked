-- Isolated, closed, test-credit-only Preview. Never enables existing production flags.
create schema fantasy;
revoke all on schema fantasy from public,anon,authenticated;
create table fantasy.settings(id boolean primary key default true check(id), enabled boolean not null default false, fee_bps integer not null default 750 check(fee_bps between 0 and 10000));
insert into fantasy.settings default values;
create table fantasy.members(user_id uuid primary key, expires_at timestamptz not null, revoked_at timestamptz, joined_at timestamptz not null default clock_timestamp());
create table fantasy.sports(id text primary key, positions jsonb not null, team_size integer not null check(team_size between 1 and 30));
insert into fantasy.sports values('football','{"GK":1,"DEF":4,"MID":4,"FWD":2}',11);
create table fantasy.tiers(id text primary key, rank integer unique not null, reference_supply integer not null check(reference_supply>0));
insert into fantasy.tiers values('CORE',1,10000),('RARE',2,2500),('ELITE',3,500),('LEGENDARY',4,100),('ICON',5,10);
create table fantasy.players(id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 2 and 80), sport text not null references fantasy.sports, position text not null, team text not null, colour text not null check(colour ~ '^#[0-9A-Fa-f]{6}$'), shirt integer not null check(shirt between 1 and 99), first_season text not null, prospect_rank integer check(prospect_rank>0), status text not null default 'active' check(status in('active','injured','suspended','unavailable','dropped','retired','delisted')));
create table fantasy.editions(id uuid primary key default gen_random_uuid(), player_id uuid not null references fantasy.players, tier text not null references fantasy.tiers, season text not null, kind text not null check(kind in('first_year','regular','special')), max_supply integer not null check(max_supply>0), issued integer not null default 0 check(issued>=0 and issued<=max_supply), prospect_rank integer, launch_at timestamptz not null default clock_timestamp(), status text not null default 'draft' check(status in('draft','launched','closed')), locked_at timestamptz, unique(player_id,tier,season,kind));
create table fantasy.cards(id uuid primary key default gen_random_uuid(), edition_id uuid not null references fantasy.editions, serial integer not null check(serial>0), owner_id uuid not null references fantasy.members(user_id), tradeable boolean not null, created_at timestamptz not null default clock_timestamp(), unique(edition_id,serial));
create table fantasy.ownership_events(id uuid primary key default gen_random_uuid(), card_id uuid not null references fantasy.cards, from_user uuid references fantasy.members, to_user uuid not null references fantasy.members, reason text not null, reference uuid not null, acquisition_price bigint, prospect_rank integer, created_at timestamptz not null default clock_timestamp());
create table fantasy.journals(id uuid primary key default gen_random_uuid(), reason text not null, reference uuid not null unique, created_at timestamptz not null default clock_timestamp());
create table fantasy.ledger(id uuid primary key default gen_random_uuid(), journal_id uuid not null references fantasy.journals, account text not null, amount bigint not null check(amount<>0), created_at timestamptz not null default clock_timestamp());
create index on fantasy.ledger(account);
create table fantasy.pack_definitions(id uuid primary key default gen_random_uuid(), name text not null, version integer not null default 1, slots jsonb not null check(jsonb_typeof(slots)='array' and jsonb_array_length(slots) between 1 and 30), pool uuid[] not null check(cardinality(pool)>0), weights jsonb not null, guarantees jsonb not null default '{}', price bigint not null check(price>=0), max_quantity integer not null check(max_quantity>0), sold integer not null default 0 check(sold>=0 and sold<=max_quantity), tradeable boolean not null, starts_at timestamptz not null default clock_timestamp(), ends_at timestamptz not null default clock_timestamp()+interval '1 year', status text not null default 'active' check(status in('active','closed')), unique(name,version));
create table fantasy.packs(id uuid primary key default gen_random_uuid(), user_id uuid not null references fantasy.members, definition_id uuid not null references fantasy.pack_definitions, request_id uuid not null unique, created_at timestamptz not null default clock_timestamp(), opened_at timestamptz);
create table fantasy.pack_items(pack_id uuid not null references fantasy.packs, slot integer not null, card_id uuid not null unique references fantasy.cards, primary key(pack_id,slot));
create table fantasy.listings(id uuid primary key default gen_random_uuid(), card_id uuid not null references fantasy.cards, seller uuid not null references fantasy.members, price bigint not null check(price between 1 and 1000000000), fee_bps integer not null check(fee_bps between 0 and 10000), state text not null default 'active' check(state in('active','sold','cancelled')), created_at timestamptz not null default clock_timestamp());
create unique index on fantasy.listings(card_id) where state='active';
create table fantasy.sales(id uuid primary key default gen_random_uuid(), listing_id uuid not null unique references fantasy.listings, buyer uuid not null references fantasy.members, seller uuid not null references fantasy.members, price bigint not null, fee bigint not null, created_at timestamptz not null default clock_timestamp());
create table fantasy.trades(id uuid primary key default gen_random_uuid(), sender uuid not null references fantasy.members, recipient uuid not null references fantasy.members, state text not null default 'pending' check(state in('draft','pending','accepted','declined','cancelled','expired')), expires_at timestamptz not null default clock_timestamp()+interval '7 days', created_at timestamptz not null default clock_timestamp(), check(sender<>recipient));
create table fantasy.trade_items(trade_id uuid not null references fantasy.trades, card_id uuid not null references fantasy.cards, from_user uuid not null references fantasy.members, primary key(trade_id,card_id));
create table fantasy.scoring_rules(id uuid primary key default gen_random_uuid(), version text not null unique, rules jsonb not null);
insert into fantasy.scoring_rules(version,rules) values('football-demo-v1','{"appearance":1,"sixty_minutes":1,"goal":{"GK":6,"DEF":6,"MID":5,"FWD":4},"assist":3,"clean_sheet":{"GK":4,"DEF":4,"MID":1,"FWD":0},"save_group":3,"save_points":1,"yellow":-1,"red":-3,"own_goal":-2,"conceded_group":2,"conceded_points":-1}');
create table fantasy.competitions(id uuid primary key default gen_random_uuid(), name text not null, sport text not null references fantasy.sports, season text not null, round integer not null check(round>0), opens_at timestamptz not null default clock_timestamp(), locks_at timestamptz not null, rules jsonb not null, scoring_id uuid not null references fantasy.scoring_rules, awards jsonb not null default '[100,70,50]', prize text not null default 'Preview/Test Prize' check(prize='Preview/Test Prize'), scored_at timestamptz, seed integer, check(locks_at>opens_at));
create table fantasy.entries(id uuid primary key default gen_random_uuid(), competition_id uuid not null references fantasy.competitions, user_id uuid not null references fantasy.members, cards uuid[] not null, snapshot jsonb not null, updated_at timestamptz not null default clock_timestamp(), unique(competition_id,user_id));
create table fantasy.round_scores(competition_id uuid not null references fantasy.competitions, player_id uuid not null references fantasy.players, scoring_id uuid not null references fantasy.scoring_rules, stats jsonb not null, score integer not null, primary key(competition_id,player_id));
create table fantasy.round_inputs(competition_id uuid not null references fantasy.competitions, player_id uuid not null references fantasy.players, stats jsonb not null, actor uuid not null, primary key(competition_id,player_id));
create table fantasy.results(competition_id uuid not null references fantasy.competitions, user_id uuid not null references fantasy.members, entry_id uuid not null references fantasy.entries, score integer not null, rank integer not null, championship_points integer not null, primary key(competition_id,user_id));
create table fantasy.status_events(id uuid primary key default gen_random_uuid(), player_id uuid not null references fantasy.players, status text not null, actor uuid not null, created_at timestamptz not null default clock_timestamp());
create table fantasy.replacements(card_id uuid primary key references fantasy.cards, user_id uuid not null references fantasy.members, pack_id uuid unique references fantasy.packs, created_at timestamptz not null default clock_timestamp());
create table fantasy.requests(user_id uuid not null references fantasy.members, request_id uuid not null, action text not null, payload jsonb not null, result jsonb not null, primary key(user_id,request_id));
create table fantasy.admin_events(id uuid primary key default gen_random_uuid(), actor uuid not null, action text not null, payload jsonb not null, created_at timestamptz not null default clock_timestamp());

create function fantasy.immutable() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'Immutable fantasy record'; end $$;
create function fantasy.member_guard() returns trigger language plpgsql set search_path='' as $$ begin
 perform pg_advisory_xact_lock(71820341);
 if new.revoked_at is null and new.expires_at>clock_timestamp() and (select count(*) from fantasy.members where user_id<>new.user_id and revoked_at is null and expires_at>clock_timestamp())>=3 then raise exception 'Preview limited to three members'; end if;
 return new; end $$;
create trigger member_limit before insert or update on fantasy.members for each row execute function fantasy.member_guard();
create function fantasy.competition_guard() returns trigger language plpgsql set search_path='' as $$ begin
 if (to_jsonb(new)-array['seed','scored_at']) is distinct from (to_jsonb(old)-array['seed','scored_at']) or old.scored_at is not null then raise exception 'Competition rules and results immutable'; end if;
 return new; end $$;
create trigger competition_version before update on fantasy.competitions for each row execute function fantasy.competition_guard();
create function fantasy.edition_guard() returns trigger language plpgsql set search_path='' as $$ begin
 if new.max_supply>old.max_supply or (old.locked_at is not null and (new.max_supply<>old.max_supply or new.player_id<>old.player_id or new.tier<>old.tier or new.season<>old.season or new.kind<>old.kind or new.locked_at is distinct from old.locked_at)) or new.issued<old.issued then raise exception 'Edition supply and identity locked'; end if;
 return new; end $$;
create trigger edition_guard before update on fantasy.editions for each row execute function fantasy.edition_guard();
create function fantasy.card_guard() returns trigger language plpgsql set search_path='' as $$ declare e fantasy.editions; begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-'owner_id') is distinct from (to_jsonb(old)-'owner_id') then raise exception 'Card identity immutable'; end if;
 else
  select * into strict e from fantasy.editions where id=new.edition_id for update;
  if e.status<>'launched' or e.launch_at>clock_timestamp() or new.serial<>e.issued+1 or new.serial>e.max_supply then raise exception 'Edition supply exhausted or invalid serial'; end if;
  update fantasy.editions set issued=new.serial,locked_at=coalesce(locked_at,clock_timestamp()) where id=e.id;
 end if; return new; end $$;
create trigger card_guard before insert or update on fantasy.cards for each row execute function fantasy.card_guard();
create function fantasy.ledger_check() returns trigger language plpgsql set search_path='' as $$ begin
 if (select coalesce(sum(amount),0) from fantasy.ledger where journal_id=new.journal_id)<>0 then raise exception 'Unbalanced journal'; end if;
 if exists(select 1 from fantasy.ledger where account not like 'system:%' group by account having sum(amount)<0) then raise exception 'Insufficient credits'; end if;
 return null; end $$;
create constraint trigger ledger_balanced after insert on fantasy.ledger deferrable initially deferred for each row execute function fantasy.ledger_check();
create function fantasy.entry_guard() returns trigger language plpgsql set search_path='' as $$ declare comp_id uuid; begin
 comp_id:=case when tg_op='INSERT' then new.competition_id else old.competition_id end;
 if exists(select 1 from fantasy.competitions where id=comp_id and (locks_at<=clock_timestamp() or opens_at>clock_timestamp() or scored_at is not null)) then raise exception 'Lineup locked'; end if; if tg_op='DELETE' then return old; end if; return new; end $$;
create trigger entry_locked before insert or update or delete on fantasy.entries for each row execute function fantasy.entry_guard();
create function fantasy.pack_guard() returns trigger language plpgsql set search_path='' as $$ begin
 if (to_jsonb(new)-'sold') is distinct from (to_jsonb(old)-'sold') then raise exception 'Pack configuration version immutable'; end if; return new; end $$;
create trigger pack_version before update on fantasy.pack_definitions for each row execute function fantasy.pack_guard();
do $$ declare t text; begin
 for t in select tablename from pg_tables where schemaname='fantasy' loop
  execute format('alter table fantasy.%I enable row level security',t);
  execute format('revoke all on fantasy.%I from public,anon,authenticated,docked_app',t);
 end loop;
 foreach t in array array['ownership_events','journals','ledger','pack_items','sales','scoring_rules','round_scores','results','status_events','requests','admin_events','trade_items'] loop
  execute format('create trigger immutable before update or delete on fantasy.%I for each row execute function fantasy.immutable()',t);
 end loop;
 foreach t in array array['cards','editions','packs','members','competitions','replacements'] loop
  execute format('create trigger no_delete before delete on fantasy.%I for each row execute function fantasy.immutable()',t);
 end loop;
end $$;

create function fantasy.actor(admin_required boolean default false) returns uuid language plpgsql set search_path='' as $$ declare u uuid:=auth.uid(); begin
 if current_setting('docked.fantasy_preview',true) is distinct from 'test-credits-only' or not (select enabled from fantasy.settings) then raise exception 'Fantasy Preview disabled'; end if;
 perform 1 from fantasy.members where user_id=u for share;
 perform 1 from public.profiles where id=u for share;
 if not private.active_member_session() or not exists(select 1 from public.profiles where id=u and disabled_at is null and age_attested and accepted_version<>'') or not exists(select 1 from fantasy.members where user_id=u and revoked_at is null and expires_at>clock_timestamp()) then raise exception 'Preview membership or session required'; end if;
 if exists(select 1 from auth.users au where au.id=u and (to_jsonb(au)->>'banned_until')::timestamptz>clock_timestamp()) then raise exception 'Account banned'; end if;
 if admin_required and (coalesce(auth.jwt()->>'aal','')<>'aal2' or not exists(select 1 from private.roles where user_id=u and role in('owner','admin'))) then raise exception 'Admin MFA required'; end if;
 return u; end $$;
create function fantasy.balance(u uuid) returns bigint language sql set search_path='' as $$ select coalesce(sum(amount),0)::bigint from fantasy.ledger where account=u::text $$;
create function fantasy.money(reason text, ref uuid, accounts text[], amounts bigint[]) returns void language plpgsql set search_path='' as $$ declare j uuid; i integer; begin
 if cardinality(accounts)<>cardinality(amounts) or (select sum(x) from unnest(amounts) x)<>0 then raise exception 'Unbalanced journal'; end if;
 insert into fantasy.journals(reason,reference) values(reason,ref) returning id into j;
 for i in 1..cardinality(accounts) loop if amounts[i]<>0 then insert into fantasy.ledger(journal_id,account,amount) values(j,accounts[i],amounts[i]); end if; end loop;
 if exists(select 1 from fantasy.ledger where account not like 'system:%' group by account having sum(amount)<0) then raise exception 'Insufficient credits'; end if;
end $$;
create function fantasy.mint(eid uuid,u uuid,tradeable boolean,reason text,ref uuid) returns uuid language plpgsql set search_path='' as $$ declare c uuid; e fantasy.editions; begin
 select * into strict e from fantasy.editions where id=eid for update;
 insert into fantasy.cards(edition_id,serial,owner_id,tradeable) values(eid,e.issued+1,u,tradeable) returning id into c;
 insert into fantasy.ownership_events(card_id,to_user,reason,reference,prospect_rank) values(c,u,reason,ref,e.prospect_rank);
 return c; end $$;
create function fantasy.transferable(cid uuid,u uuid) returns void language plpgsql set search_path='' as $$ begin
 if not exists(select 1 from fantasy.members m join public.profiles p on p.id=m.user_id where m.user_id=u and m.revoked_at is null and m.expires_at>clock_timestamp() and p.disabled_at is null) then raise exception 'Card owner membership inactive'; end if;
 if exists(select 1 from fantasy.pack_items pi join fantasy.packs pa on pa.id=pi.pack_id where pi.card_id=cid and pa.opened_at is null) then raise exception 'Open the pack before transferring cards'; end if;
 if not exists(select 1 from fantasy.cards where id=cid and owner_id=u and tradeable) then raise exception 'Tradeable owned card required'; end if;
 if exists(select 1 from fantasy.entries e join fantasy.competitions c on c.id=e.competition_id where cid=any(e.cards) and c.scored_at is null) then raise exception 'Card committed to lineup; remove before trading'; end if;
end $$;
create function fantasy.transfer(cid uuid,from_id uuid,to_id uuid,reason text,ref uuid,price bigint default null) returns void language plpgsql set search_path='' as $$ begin
 perform fantasy.transferable(cid,from_id);
 update fantasy.cards set owner_id=to_id where id=cid and owner_id=from_id;
 if not found then raise exception 'Ownership changed'; end if;
 insert into fantasy.ownership_events(card_id,from_user,to_user,reason,reference,acquisition_price,prospect_rank) select cid,from_id,to_id,reason,ref,price,p.prospect_rank from fantasy.cards c join fantasy.editions e on e.id=c.edition_id join fantasy.players p on p.id=e.player_id where c.id=cid;
 update fantasy.listings set state='cancelled' where card_id=cid and state='active';
end $$;
create function fantasy.social(u uuid,body text) returns void language plpgsql set search_path='' as $$ declare sid uuid; begin
 -- Use existing visibility/moderation/blocking policies. Never post for suspended/private accounts.
 select id into sid from private.social_profiles where user_id=u and status='active' and visibility='members';
 if sid is not null and private.community_feature_allowed(u,'community_social') then
  insert into private.social_posts(author_id,kind,body,sport) values(sid,'celebration',body,'football');
 end if; end $$;
create function fantasy.lineup(comp uuid,u uuid,ids uuid[]) returns jsonb language plpgsql set search_path='' as $$ declare c fantasy.competitions; s fantasy.sports; item record; snapshot jsonb; begin
 select * into strict c from fantasy.competitions where id=comp;
 select * into strict s from fantasy.sports where id=c.sport;
 if (select count(*) from jsonb_object_keys(coalesce(c.rules->'positions',s.positions)))<>(select count(*) from jsonb_object_keys(s.positions)) or exists(select 1 from jsonb_each_text(coalesce(c.rules->'positions',s.positions)) f where not (s.positions ? f.key) or f.value::integer<0) or (select sum(value::integer) from jsonb_each_text(coalesce(c.rules->'positions',s.positions))) is distinct from s.team_size then raise exception 'Complete sport formation required'; end if;
 if cardinality(ids)<>s.team_size or (select count(distinct x) from unnest(ids) x)<>s.team_size then raise exception 'Invalid lineup size or duplicate card'; end if;
 if exists(select 1 from fantasy.pack_items pi join fantasy.packs pa on pa.id=pi.pack_id where pi.card_id=any(ids) and pa.opened_at is null) then raise exception 'Open pack before fielding cards'; end if;
 if (select count(*) from fantasy.cards a join fantasy.editions e on e.id=a.edition_id join fantasy.players p on p.id=e.player_id where a.id=any(ids) and a.owner_id=u and p.sport=c.sport and p.status not in('retired','delisted') and not exists(select 1 from fantasy.listings l where l.card_id=a.id and l.state='active'))<>s.team_size then raise exception 'Ineligible, listed or unowned card'; end if;
 if coalesce((c.rules->>'duplicates')::boolean,false)=false and (select count(distinct e.player_id) from fantasy.cards a join fantasy.editions e on e.id=a.edition_id where a.id=any(ids))<>s.team_size then raise exception 'Duplicate player'; end if;
 for item in select key,value from jsonb_each_text(coalesce(c.rules->'positions',s.positions)) loop
  if (select count(*) from fantasy.cards a join fantasy.editions e on e.id=a.edition_id join fantasy.players p on p.id=e.player_id where a.id=any(ids) and p.position=item.key)<>item.value::integer then raise exception 'Invalid position formation'; end if;
 end loop;
 for item in select key,value from jsonb_each_text(coalesce(c.rules->'tier_max','{}')) loop
  if (select count(*) from fantasy.cards a join fantasy.editions e on e.id=a.edition_id where a.id=any(ids) and e.tier=item.key)>item.value::integer then raise exception 'Tier eligibility exceeded'; end if;
 end loop;
 if (select count(*) from fantasy.cards a join fantasy.editions e on e.id=a.edition_id where a.id=any(ids) and e.kind='first_year')<coalesce((c.rules->>'first_year_min')::integer,0) or (select count(*) from fantasy.cards a join fantasy.editions e on e.id=a.edition_id where a.id=any(ids) and e.tier='CORE')<coalesce((c.rules->>'core_min')::integer,0) then raise exception 'Minimum Core or First Year eligibility'; end if;
 select jsonb_agg(jsonb_build_object('card_id',a.id,'player_id',e.player_id,'tier',e.tier,'position',p.position,'season',e.season,'kind',e.kind) order by a.id) into snapshot from fantasy.cards a join fantasy.editions e on e.id=a.edition_id join fantasy.players p on p.id=e.player_id where a.id=any(ids);
 return snapshot; end $$;
create function fantasy.score(stats jsonb,p_position text,r jsonb) returns integer language sql immutable set search_path='' as $$
 select case when (stats->>'minutes')::integer=0 then 0 else
 (r->>'appearance')::integer + case when (stats->>'minutes')::integer>=60 then (r->>'sixty_minutes')::integer else 0 end
 +(stats->>'goals')::integer*(r->'goal'->>p_position)::integer +(stats->>'assists')::integer*(r->>'assist')::integer
 +case when (stats->>'minutes')::integer>=60 and (stats->>'conceded')::integer=0 then (r->'clean_sheet'->>p_position)::integer else 0 end
 +case when p_position='GK' then ((stats->>'saves')::integer/(r->>'save_group')::integer)*(r->>'save_points')::integer else 0 end
 +(stats->>'yellow')::integer*(r->>'yellow')::integer +(stats->>'red')::integer*(r->>'red')::integer +(stats->>'own_goals')::integer*(r->>'own_goal')::integer
 +case when p_position in('GK','DEF') then ((stats->>'conceded')::integer/(r->>'conceded_group')::integer)*(r->>'conceded_points')::integer else 0 end end
$$;

create function fantasy.prepare_pack(pack_id uuid,u uuid) returns void language plpgsql set search_path='' as $$
declare pack fantasy.packs; d fantasy.pack_definitions; chosen fantasy.editions; i integer; item record; selected_tier text; slot_position text; weights double precision; draw double precision; cid uuid;
begin
 select * into strict pack from fantasy.packs where id=pack_id and user_id=u;
 select * into strict d from fantasy.pack_definitions where id=pack.definition_id;
   -- Charge only when issuance succeeds. An exhausted pool cannot strand paid credits.
   if d.price>0 then perform fantasy.money('pack',pack.id,array[u::text,'system:pack'],array[-d.price,d.price]); end if;
   for i in 0..jsonb_array_length(d.slots)-1 loop
    slot_position:=d.slots->>i;
    -- Guarantees occupy configured leading slots; other slots use explicit tier weights.
    selected_tier:=d.guarantees->>i::text;
    if selected_tier is null then
     select sum(value::double precision) into weights from jsonb_each_text(d.weights);
     if weights is null or weights<=0 or exists(select 1 from jsonb_each_text(d.weights) where value::double precision<0) then raise exception 'Invalid pack weights'; end if;
     draw:=random()*weights;
     for item in select key,value::double precision as weight from jsonb_each_text(d.weights) order by key loop
      draw:=draw-item.weight; if draw<0 then selected_tier:=item.key; exit; end if;
     end loop;
    end if;
    select a.* into chosen from fantasy.editions a join fantasy.players b on b.id=a.player_id where a.id=any(d.pool) and a.tier=selected_tier and a.status='launched' and a.launch_at<=clock_timestamp() and a.issued<a.max_supply and b.status not in('retired','delisted') and (slot_position='ANY' or b.position=slot_position) and (d.name<>'Starter' or not exists(select 1 from fantasy.pack_items pi join fantasy.cards ci on ci.id=pi.card_id join fantasy.editions ei on ei.id=ci.edition_id where pi.pack_id=pack.id and ei.player_id=a.player_id)) order by random() limit 1;
    if not found then raise exception 'Configured pool exhausted; no reroll or debit'; end if;
    cid:=fantasy.mint(chosen.id,u,d.tradeable,case when d.name='Starter' then 'starter' else 'pack' end,pack.id);
    insert into fantasy.pack_items values(pack.id,i,cid);
   end loop;

end $$;

-- Single reviewed mutation entry. Runtime receives EXECUTE only, never table writes.
create function fantasy.command(action text,p jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; result jsonb:='{}'; prior fantasy.requests; d fantasy.pack_definitions; pack fantasy.packs; chosen fantasy.editions; l fantasy.listings; tr fantasy.trades; comp fantasy.competitions; item record; i integer; cid uuid; ref uuid; snap jsonb; ids uuid[]; weights double precision; draw double precision; selected_tier text; slot_position text; fee bigint; score_rules jsonb; stats jsonb; n bigint; pid uuid; is_admin boolean;
begin
 perform pg_advisory_xact_lock(71820341);
 u:=fantasy.actor(false);
 if request_id is null then raise exception 'Request ID required'; end if;
 select * into prior from fantasy.requests q where q.user_id=u and q.request_id=command.request_id;
 if found then if prior.action<>action or prior.payload<>p then raise exception 'Request ID reused'; end if; return prior.result; end if;
 is_admin:=action like 'admin_%'; if is_admin then perform fantasy.actor(true); end if;
 if action in('claim_starter','buy_pack') then
  if action='claim_starter' then
   if exists(select 1 from fantasy.packs a join fantasy.pack_definitions b on b.id=a.definition_id where a.user_id=u and b.name='Starter') then raise exception 'Starter already claimed'; end if;
   select * into strict d from fantasy.pack_definitions where name='Starter' and version=1;
  else select * into strict d from fantasy.pack_definitions where id=(p->>'definition_id')::uuid and name not in('Starter','Replacement'); end if;
  if d.status<>'active' or clock_timestamp()<d.starts_at or clock_timestamp()>=d.ends_at or d.sold>=d.max_quantity then raise exception 'Pack unavailable'; end if;
  insert into fantasy.packs(user_id,definition_id,request_id) values(u,d.id,request_id) returning id into ref;
  update fantasy.pack_definitions set sold=sold+1 where id=d.id;
  perform fantasy.prepare_pack(ref,u);
  result:=jsonb_build_object('pack_id',ref);
 elsif action='open_pack' then
  select * into strict pack from fantasy.packs where id=(p->>'pack_id')::uuid and user_id=u;
  if pack.opened_at is null then
   select * into strict d from fantasy.pack_definitions where id=pack.definition_id;
   update fantasy.packs set opened_at=clock_timestamp() where id=pack.id;
   perform fantasy.social(u,'Opened a '||d.name||' pack in Fantasy Cards Preview.');
  end if;
  select jsonb_build_object('pack_id',pack.id,'cards',jsonb_agg(card_id order by slot)) into result from fantasy.pack_items where pack_id=pack.id;
 elsif action='list' then
  cid:=(p->>'card_id')::uuid; perform fantasy.transferable(cid,u);
  insert into fantasy.listings(card_id,seller,price,fee_bps) select cid,u,(p->>'price')::bigint,fee_bps from fantasy.settings returning id into ref;
  perform fantasy.social(u,'Listed a card for test credits in Fantasy Cards Preview.'); result:=jsonb_build_object('listing_id',ref);
 elsif action='cancel_listing' then
  update fantasy.listings set state='cancelled' where id=(p->>'listing_id')::uuid and seller=u and state='active'; if not found then raise exception 'Active owned listing required'; end if;
 elsif action='buy' then
  select * into strict l from fantasy.listings where id=(p->>'listing_id')::uuid;
  if l.state<>'active' or l.seller=u then raise exception 'Listing unavailable'; end if;
  perform fantasy.transferable(l.card_id,l.seller);
  fee:=(l.price*l.fee_bps+5000)/10000;
  insert into fantasy.sales(listing_id,buyer,seller,price,fee) values(l.id,u,l.seller,l.price,fee) returning id into ref;
  perform fantasy.money('sale',ref,array[u::text,l.seller::text,'system:fee'],array[-l.price,l.price-fee,fee]);
  perform fantasy.transfer(l.card_id,l.seller,u,'sale',ref,l.price);
  update fantasy.listings set state='sold' where id=l.id;
  perform fantasy.social(u,'Acquired a card on the test-credit marketplace.');
 elsif action='offer_trade' then
  pid:=(p->>'recipient')::uuid;
  if not exists(select 1 from fantasy.members where user_id=pid and revoked_at is null and expires_at>clock_timestamp()) then raise exception 'Recipient unavailable'; end if;
  if jsonb_array_length(p->'give') not between 1 and 30 or jsonb_array_length(p->'receive') not between 1 and 30 then raise exception 'Both trade sides required'; end if;
  insert into fantasy.trades(sender,recipient) values(u,pid) returning id into ref;
  for item in select value::uuid as id,u as owner from jsonb_array_elements_text(p->'give') union all select value::uuid,pid from jsonb_array_elements_text(p->'receive') loop
   perform fantasy.transferable(item.id,item.owner);
   insert into fantasy.trade_items values(ref,item.id,item.owner);
  end loop; result:=jsonb_build_object('trade_id',ref);
 elsif action in('accept_trade','decline_trade','cancel_trade') then
  select * into strict tr from fantasy.trades where id=(p->>'trade_id')::uuid;
  if tr.state<>'pending' or tr.expires_at<=clock_timestamp() then raise exception 'Trade unavailable or expired'; end if;
  if (action='cancel_trade' and tr.sender<>u) or (action<>'cancel_trade' and tr.recipient<>u) then raise exception 'Trade permission denied'; end if;
  if action='accept_trade' then
   for item in select * from fantasy.trade_items where trade_id=tr.id order by card_id loop perform fantasy.transferable(item.card_id,item.from_user); end loop;
   for item in select * from fantasy.trade_items where trade_id=tr.id order by card_id loop perform fantasy.transfer(item.card_id,item.from_user,case when item.from_user=tr.sender then tr.recipient else tr.sender end,'trade',tr.id); end loop;
   perform fantasy.social(u,'Completed a card trade in Fantasy Cards Preview.');
  end if;
  update fantasy.trades set state=case action when 'accept_trade' then 'accepted' when 'decline_trade' then 'declined' else 'cancelled' end where id=tr.id;
 elsif action='save_lineup' then
  select * into strict comp from fantasy.competitions where id=(p->>'competition_id')::uuid;
  if clock_timestamp()<comp.opens_at or clock_timestamp()>=comp.locks_at or comp.scored_at is not null then raise exception 'Lineup locked or entry closed'; end if;
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(p->'cards'); snap:=fantasy.lineup(comp.id,u,ids);
  insert into fantasy.entries(competition_id,user_id,cards,snapshot) values(comp.id,u,ids,snap) on conflict(competition_id,user_id) do update set cards=excluded.cards,snapshot=excluded.snapshot,updated_at=clock_timestamp();
 elsif action='admin_credit' then
  pid:=(p->>'user_id')::uuid; if not exists(select 1 from fantasy.members where user_id=pid) or (p->>'amount')::bigint not between 1 and 1000000 then raise exception 'Invalid credit grant'; end if;
  perform fantasy.money('admin_credit',request_id,array['system:issuance',pid::text],array[-(p->>'amount')::bigint,(p->>'amount')::bigint]);
 elsif action='admin_status' then
  pid:=(p->>'player_id')::uuid;
  update fantasy.players set status=p->>'status' where id=pid; if not found then raise exception 'Player missing'; end if;
  insert into fantasy.status_events(player_id,status,actor) values(pid,p->>'status',u);
  if p->>'status' in('retired','delisted') then
   -- Before lock, retirement invalidates the saved entry; rebuild explicitly, never substitute.
   delete from fantasy.entries en using fantasy.competitions co where en.competition_id=co.id and co.locks_at>clock_timestamp() and exists(select 1 from jsonb_array_elements(en.snapshot) si where (si->>'player_id')::uuid=pid);
   insert into fantasy.replacements(card_id,user_id) select a.id,a.owner_id from fantasy.cards a join fantasy.editions e on e.id=a.edition_id where e.player_id=pid on conflict do nothing;
  end if;
 elsif action='admin_replacement' then
  cid:=(p->>'card_id')::uuid;
  select user_id into strict pid from fantasy.replacements where card_id=cid and pack_id is null;
  select * into strict d from fantasy.pack_definitions where name='Replacement' and version=1;
  if d.sold>=d.max_quantity then raise exception 'Replacement stock exhausted'; end if;
  insert into fantasy.packs(user_id,definition_id,request_id) values(pid,d.id,request_id) returning id into ref;
  update fantasy.pack_definitions set sold=sold+1 where id=d.id;
  perform fantasy.prepare_pack(ref,pid);
  update fantasy.replacements set pack_id=ref where card_id=cid; result:=jsonb_build_object('pack_id',ref);
 elsif action='admin_simulate' then
  select * into strict comp from fantasy.competitions where id=(p->>'competition_id')::uuid;
  if comp.scored_at is not null or clock_timestamp()<comp.locks_at then raise exception 'Round must be locked and unscored'; end if;
  select rules into strict score_rules from fantasy.scoring_rules where id=comp.scoring_id;
  for item in select a.* from fantasy.players a where sport=comp.sport order by id loop
   n:=('x'||substr(md5((p->>'seed')||':'||item.id::text),1,8))::bit(32)::bigint;
   stats:=jsonb_build_object('minutes',case when item.status='active' then 90 else 0 end,'goals',case when n%7=0 then 1 else 0 end,'assists',case when n%5=0 then 1 else 0 end,'conceded',n%4,'saves',n%8,'yellow',case when n%11=0 then 1 else 0 end,'red',0,'own_goals',0);
   stats:=coalesce((select ri.stats from fantasy.round_inputs ri where ri.competition_id=comp.id and ri.player_id=item.id),stats);
   insert into fantasy.round_scores values(comp.id,item.id,comp.scoring_id,stats,fantasy.score(stats,item.position,score_rules));
  end loop;
  insert into fantasy.results(competition_id,user_id,entry_id,score,rank,championship_points)
  select comp.id,x.user_id,x.id,x.total,x.place,coalesce((comp.awards->>(x.place::integer-1))::integer,0) from (
   select e.id,e.user_id,sum(s.score)::integer total,rank() over(order by sum(s.score) desc)::integer place from fantasy.entries e cross join lateral jsonb_array_elements(e.snapshot) a join fantasy.round_scores s on s.competition_id=e.competition_id and s.player_id=(a->>'player_id')::uuid where e.competition_id=comp.id group by e.id,e.user_id
  ) x;
  update fantasy.competitions set scored_at=clock_timestamp(),seed=(p->>'seed')::integer where id=comp.id;
  for item in select user_id from fantasy.results where competition_id=comp.id and rank=1 loop perform fantasy.social(item.user_id,'Won '||comp.name||' in Fantasy Cards Preview.'); end loop;
 elsif action='admin_stats' then
  if not exists(select 1 from fantasy.competitions co join fantasy.players pl on pl.sport=co.sport where co.id=(p->>'competition_id')::uuid and pl.id=(p->>'player_id')::uuid and co.scored_at is null) then raise exception 'Unscored sport round required'; end if;
  if not ((p->'stats') ?& array['minutes','goals','assists','conceded','saves','yellow','red','own_goals']) or exists(select 1 from jsonb_each_text(p->'stats') x where x.value::integer<0 or x.value::integer>150) then raise exception 'Invalid event statistics'; end if;
  insert into fantasy.round_inputs values((p->>'competition_id')::uuid,(p->>'player_id')::uuid,p->'stats',u) on conflict(competition_id,player_id) do update set stats=excluded.stats,actor=excluded.actor;
 elsif action='admin_scoring' then
  if (p->'rules'->>'save_group')::integer<=0 or (p->'rules'->>'conceded_group')::integer<=0 then raise exception 'Positive scoring divisor required'; end if;
  insert into fantasy.scoring_rules(version,rules)values(p->>'version',p->'rules');
 elsif action='admin_player' then
  if not exists(select 1 from fantasy.sports where id=p->>'sport' and positions ? (p->>'position')) then raise exception 'Sport position invalid'; end if;
  insert into fantasy.players(name,sport,position,team,colour,shirt,first_season,prospect_rank) values(p->>'name',p->>'sport',p->>'position',p->>'team',p->>'colour',(p->>'shirt')::integer,p->>'first_season',(p->>'prospect_rank')::integer) returning id into ref; result:=jsonb_build_object('player_id',ref);
 elsif action='admin_edition' then
  if p->>'kind'='first_year' and not exists(select 1 from fantasy.players where id=(p->>'player_id')::uuid and first_season=p->>'season') then raise exception 'First Year must match first eligible season'; end if;
  insert into fantasy.editions(player_id,tier,season,kind,max_supply,prospect_rank,launch_at,status) values((p->>'player_id')::uuid,p->>'tier',p->>'season',p->>'kind',(p->>'max_supply')::integer,(p->>'prospect_rank')::integer,(p->>'launch_at')::timestamptz,'draft') returning id into ref; result:=jsonb_build_object('edition_id',ref);
 elsif action='admin_lock_edition' then
  update fantasy.editions set locked_at=clock_timestamp(),status='launched' where id=(p->>'edition_id')::uuid and locked_at is null and status='draft'; if not found then raise exception 'Unlocked draft edition required'; end if;
 elsif action='admin_pack' then
  select array_agg(value::uuid) into ids from jsonb_array_elements_text(p->'pool');
  if cardinality(ids) is null or cardinality(ids)=0 or exists(select 1 from unnest(ids) x where not exists(select 1 from fantasy.editions where id=x and status='launched')) then raise exception 'Launched edition pool required'; end if;
  if exists(select 1 from jsonb_each_text(p->'weights') w where w.value::numeric<0 or not exists(select 1 from fantasy.tiers where id=w.key)) or (select sum(value::numeric) from jsonb_each_text(p->'weights'))<>100 then raise exception 'Tier probabilities must sum to 100'; end if;
  for item in select key,value from jsonb_each_text(coalesce(p->'guarantees','{}')) loop
   if item.key !~ '^[0-9]+$' or item.key::integer>=jsonb_array_length(p->'slots') or not exists(select 1 from fantasy.tiers where id=item.value) then raise exception 'Invalid guarantee slot'; end if;
  end loop;
  insert into fantasy.pack_definitions(name,version,slots,pool,weights,guarantees,price,max_quantity,tradeable,starts_at,ends_at) values(p->>'name',(p->>'version')::integer,p->'slots',ids,p->'weights',coalesce(p->'guarantees','{}'),(p->>'price')::bigint,(p->>'max_quantity')::integer,(p->>'tradeable')::boolean,(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz) returning id into ref;result:=jsonb_build_object('definition_id',ref);
 elsif action='admin_fee' then
  update fantasy.settings set fee_bps=(p->>'fee_bps')::integer;
 elsif action='admin_competition' then
  insert into fantasy.competitions(name,sport,season,round,locks_at,rules,scoring_id) values(p->>'name','football',p->>'season',(p->>'round')::integer,(p->>'locks_at')::timestamptz,p->'rules',(select id from fantasy.scoring_rules where version=coalesce(p->>'scoring_version','football-demo-v1'))) returning id into ref; result:=jsonb_build_object('competition_id',ref);
 else raise exception 'Unknown fantasy action'; end if;
 if is_admin then insert into fantasy.admin_events(actor,action,payload) values(u,action,p); end if;
 insert into fantasy.requests values(u,request_id,action,p,result);
 return result;
end $$;

create function fantasy.read_state() returns jsonb language plpgsql security definer set search_path='' as $$ declare u uuid; result jsonb; begin
 u:=fantasy.actor(false);
 select jsonb_build_object(
 'user_id',u,'credits',fantasy.balance(u),'admin',coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from private.roles where user_id=u and role in('owner','admin')),
 'fee_bps',(select fee_bps from fantasy.settings),
 'catalog',case when coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from private.roles where user_id=u and role in('owner','admin')) then jsonb_build_object('players',(select jsonb_agg(to_jsonb(p)) from fantasy.players p),'editions',(select jsonb_agg(to_jsonb(e)) from fantasy.editions e),'replacements',(select jsonb_agg(to_jsonb(r)) from fantasy.replacements r),'sales',(select jsonb_agg(to_jsonb(s)) from fantasy.sales s),'ownership',(select jsonb_agg(to_jsonb(o)) from fantasy.ownership_events o)) else null end,
 'cards',coalesce((select jsonb_agg(to_jsonb(x)) from (select a.*,e.tier,e.season,e.kind,e.max_supply,e.player_id,p.name,p.position,p.team,p.colour,p.shirt,p.status,p.sport,exists(select 1 from fantasy.listings l where l.card_id=a.id and l.state='active') as listed,(select max(created_at) from fantasy.ownership_events o where o.card_id=a.id and o.to_user=u) as acquired_at from fantasy.cards a join fantasy.editions e on e.id=a.edition_id join fantasy.players p on p.id=e.player_id where a.owner_id=u and not exists(select 1 from fantasy.pack_items pi join fantasy.packs pa on pa.id=pi.pack_id where pi.card_id=a.id and pa.opened_at is null) order by a.created_at desc) x),'[]'),
 'packs',coalesce((select jsonb_agg(to_jsonb(x)) from (select a.*,d.name,d.slots,case when a.opened_at is not null then (select jsonb_agg(card_id order by slot) from fantasy.pack_items where pack_id=a.id) else null end as cards from fantasy.packs a join fantasy.pack_definitions d on d.id=a.definition_id where a.user_id=u order by a.created_at desc) x),'[]'),
 'shop',coalesce((select jsonb_agg(to_jsonb(d)) from fantasy.pack_definitions d where name<>'Replacement'),'[]'),
 'market',coalesce((select jsonb_agg(to_jsonb(x)) from (select l.*,e.tier,e.season,e.kind,e.max_supply,p.name,p.position,p.status,a.serial from fantasy.listings l join fantasy.cards a on a.id=l.card_id join fantasy.editions e on e.id=a.edition_id join fantasy.players p on p.id=e.player_id where l.state='active') x),'[]'),
 'trades',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('items',(select jsonb_agg(to_jsonb(i)) from fantasy.trade_items i where i.trade_id=t.id))) from fantasy.trades t where u in(t.sender,t.recipient)),'[]'),
 'competitions',coalesce((select jsonb_agg(to_jsonb(c)) from fantasy.competitions c),'[]'),
 'entries',coalesce((select jsonb_agg(to_jsonb(e)) from fantasy.entries e where user_id=u),'[]'),
 'results',coalesce((select jsonb_agg(to_jsonb(r)) from fantasy.results r),'[]'),
 'ledger',coalesce((select jsonb_agg(to_jsonb(x)) from (select l.*,j.reason from fantasy.ledger l join fantasy.journals j on j.id=l.journal_id where account=u::text order by l.created_at desc limit 100) x),'[]'),
 'provenance',coalesce((select jsonb_agg(to_jsonb(o)) from fantasy.ownership_events o where o.card_id in(select id from fantasy.cards where owner_id=u)),'[]'),
 'members',coalesce((select jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(s.display_name,'Preview member'))) from fantasy.members m left join private.social_profiles s on s.user_id=m.user_id and s.visibility='members' and s.status='active' where m.revoked_at is null and m.expires_at>clock_timestamp()),'[]'),
 'replacements',coalesce((select jsonb_agg(to_jsonb(r)) from fantasy.replacements r where user_id=u),'[]')
 ) into result; return result; end $$;

-- Fictional, deterministic catalog only. No users or credits are seeded by migration.
insert into fantasy.players(id,name,sport,position,team,colour,shirt,first_season,prospect_rank)
select ('f1000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 (array['Noah','Arlo','Finn','Milo','Oscar','Theo','Jude','Ezra','Luca'])[1+(i-1)%9]||' '||(array['Vale','Rowan','Brook','Hart'])[1+(i-1)/9],
 'football',case when i<=4 then 'GK' when i<=16 then 'DEF' when i<=28 then 'MID' else 'FWD' end,
 (array['Harbour Blue','Valley Violet','Northern Red','Coastal Gold'])[1+(i-1)%4],(array['#1A2AFF','#8B3DFF','#E34C64','#E5B755'])[1+(i-1)%4],i,'2027',i from generate_series(1,36) i;
insert into fantasy.editions(player_id,tier,season,kind,max_supply,prospect_rank,status) select p.id,t.id,'2027','first_year',t.reference_supply,p.prospect_rank,'launched' from fantasy.players p cross join fantasy.tiers t;
insert into fantasy.pack_definitions(name,slots,pool,weights,guarantees,price,max_quantity,tradeable)
select 'Starter','["GK","DEF","DEF","DEF","DEF","MID","MID","MID","MID","FWD","FWD"]',array_agg(e.id),'{"CORE":1}','{}',0,3,false from fantasy.editions e where tier='CORE';
-- Starter pool slots must not repeat player identities within a pack; enforced below.
insert into fantasy.pack_definitions(name,slots,pool,weights,guarantees,price,max_quantity,tradeable)
select x.name,to_jsonb(array_fill('ANY'::text,array[x.size])),array_agg(e.id),x.weights::jsonb,x.guarantees::jsonb,x.price,100,true from fantasy.editions e cross join (values('Matchday',5,100,'{"CORE":75,"RARE":20,"ELITE":5}','{}'),('Pro',7,200,'{"CORE":50,"RARE":35,"ELITE":14,"LEGENDARY":1}','{"0":"RARE"}'),('Elite',9,400,'{"CORE":30,"RARE":40,"ELITE":25,"LEGENDARY":4,"ICON":1}','{"0":"ELITE"}'),('Replacement',1,0,'{"CORE":1}','{}')) x(name,size,price,weights,guarantees) group by x.name,x.size,x.price,x.weights,x.guarantees;
insert into fantasy.competitions(name,sport,season,round,locks_at,rules,scoring_id) select n.name,'football','2027',1,clock_timestamp()+interval '7 days',n.rules::jsonb,r.id from fantasy.scoring_rules r cross join (values('Rookie League','{"tier_max":{"ELITE":1,"LEGENDARY":0,"ICON":0},"core_min":5,"first_year_min":3}'),('Challenger','{"tier_max":{"ELITE":2,"LEGENDARY":1,"ICON":0}}'),('Open League','{}')) n(name,rules) where r.version='football-demo-v1';
revoke all on all functions in schema fantasy from public,anon,authenticated,docked_app;
grant usage on schema fantasy to docked_app;
grant execute on function fantasy.command(text,jsonb,uuid),fantasy.read_state() to docked_app;



