-- Additive, dormant by default. Applying this migration never promotes Preview.
alter table fantasy.settings add column deployment_mode text not null default 'preview' check(deployment_mode in('preview','production'));
alter table fantasy.settings add column production_ref text;
alter table fantasy.settings add column terms_version text;
alter table fantasy.settings add column privacy_version text;
alter table fantasy.settings add constraint production_metadata_required check(deployment_mode<>'production' or (production_ref is not null and production_ref ~ '^[a-z]{20}$' and terms_version is not null and privacy_version is not null));
alter table fantasy.competitions drop constraint competitions_prize_check;
alter table fantasy.competitions add constraint competitions_prize_check check(prize in('Preview/Test Prize','No cash prize'));
create table fantasy.production_policy(version integer generated always as identity primary key, daily_points integer not null check(daily_points between 1 and 50), card_every integer not null check(card_every between 7 and 365), daily_card_limit integer not null check(daily_card_limit between 0 and 100), created_at timestamptz not null default clock_timestamp(), actor uuid);
create table fantasy.production_catalog(id boolean primary key default true check(id), starter_definition uuid not null references fantasy.pack_definitions, reward_definition uuid not null references fantasy.pack_definitions);
create table fantasy.production_definitions(definition_id uuid primary key references fantasy.pack_definitions, kind text not null check(kind in('starter','reward')));
create table fantasy.starter_claims(user_id uuid primary key references fantasy.members, pack_id uuid not null unique references fantasy.packs, created_at timestamptz not null default clock_timestamp());
create table fantasy.daily_claims(id uuid primary key default gen_random_uuid(), user_id uuid not null references fantasy.members, period date not null, points integer not null check(points between 1 and 50), policy_version integer not null references fantasy.production_policy, pack_id uuid unique references fantasy.packs, card_outcome text not null check(card_outcome in('not_due','awarded','stock_unavailable','daily_limit')), created_at timestamptz not null default clock_timestamp(), unique(user_id,period));
create table fantasy.production_rounds(competition_id uuid primary key references fantasy.competitions);
create index on fantasy.daily_claims(period) where pack_id is not null;
create index on fantasy.cards(owner_id,created_at);
create index on fantasy.ownership_events(card_id,created_at);
create index on fantasy.packs(user_id,created_at);
create index on fantasy.pack_items(pack_id,slot);
do $$ declare n text; begin
 foreach n in array array['production_policy','production_catalog','production_definitions','starter_claims','daily_claims','production_rounds'] loop
  execute format('alter table fantasy.%I enable row level security',n);
  execute format('revoke all on fantasy.%I from public,anon,authenticated,docked_app',n);
  if n<>'production_catalog' then execute format('create trigger immutable before update or delete on fantasy.%I for each row execute function fantasy.immutable()',n); end if;
 end loop;
end $$;

-- Keep the original Preview implementations and restrict entry by database mode.
alter function fantasy.actor(boolean) rename to preview_actor;
alter function fantasy.command(text,jsonb,uuid) rename to preview_command;
do $$ begin execute replace(pg_get_functiondef('fantasy.preview_command(text,jsonb,uuid)'::regprocedure),'command.request_id','preview_command.request_id'); end $$;
alter function fantasy.read_state() rename to preview_read_state;
create function fantasy.production_eligible() returns uuid language plpgsql set search_path='' as $$
declare u uuid:=auth.uid(); s fantasy.settings; begin
 select * into strict s from fantasy.settings;
 if s.deployment_mode<>'production' or not s.enabled or current_setting('docked.fantasy_production',true) is distinct from s.production_ref or coalesce(current_setting('docked.fantasy_preview',true),'')<>'' then raise exception 'Production Fantasy context required'; end if;
 perform 1 from public.profiles where id=u for share;
 if not private.active_member_session() or not exists(select 1 from public.profiles where id=u and disabled_at is null and age_attested and accepted_version=s.terms_version) then raise exception 'Verified current-consent account required'; end if;
 if not coalesce((select granted and version=s.privacy_version from private.consent_events where user_id=u and purpose='privacy' order by created_at desc,id desc limit 1),false) then raise exception 'Current privacy consent required'; end if;
 if exists(select 1 from auth.users au where au.id=u and (to_jsonb(au)->>'banned_until')::timestamptz>clock_timestamp()) then raise exception 'Account banned'; end if;
 return u;
end $$;
create function fantasy.actor(admin_required boolean default false) returns uuid language plpgsql set search_path='' as $$ declare u uuid; begin
 if (select deployment_mode from fantasy.settings)='preview' then
  if coalesce(current_setting('docked.fantasy_production',true),'')<>'' then raise exception 'Production context forbidden in Preview'; end if;
  return fantasy.preview_actor(admin_required);
 end if;
 u:=fantasy.production_eligible();
 if not exists(select 1 from fantasy.members where user_id=u and revoked_at is null and expires_at>clock_timestamp()) then raise exception 'Production membership required'; end if;
 if admin_required and (coalesce(auth.jwt()->>'aal','')<>'aal2' or not exists(select 1 from private.roles where user_id=u and role in('owner','admin'))) then raise exception 'Admin MFA required'; end if;
 return u;
end $$;
create or replace function fantasy.member_guard() returns trigger language plpgsql set search_path='' as $$ begin
 perform pg_advisory_xact_lock(71820341);
 if (select deployment_mode from fantasy.settings)='preview' and new.revoked_at is null and new.expires_at>clock_timestamp() and (select count(*) from fantasy.members where user_id<>new.user_id and revoked_at is null and expires_at>clock_timestamp())>=3 then raise exception 'Preview limited to three members'; end if;
 return new;
end $$;
create function fantasy.command(action text,p jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if (select deployment_mode from fantasy.settings)<>'preview' then raise exception 'Preview commands disabled in production'; end if;
 return fantasy.preview_command(action,p,request_id);
end $$;
create function fantasy.read_state() returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if (select deployment_mode from fantasy.settings)<>'preview' then raise exception 'Preview state disabled in production'; end if;
 return fantasy.preview_read_state();
end $$;

-- Called only by a verified migration operator on an unused Fantasy installation.
-- It neither changes existing Edge tables nor copies any Preview accounts/data.
create function fantasy.initialize_production(project_ref text,terms text,privacy text) returns void language plpgsql set search_path='' as $$
declare starter uuid; reward uuid; comp uuid; scoring uuid; begin
 perform pg_advisory_xact_lock(71820341);
 if project_ref is null or terms is null or privacy is null or project_ref !~ '^[a-z]{20}$' or project_ref in('bckkllmndoxzpzdqrevb','dwdjeecjdkkiidoutnme') or terms !~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$' or privacy !~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{2,79}$' or terms ~* '(draft|preview|fixture|pending|unapproved|placeholder)' or privacy ~* '(draft|preview|fixture|pending|unapproved|placeholder)' then raise exception 'Reviewed production identity and policy versions required'; end if;
 if (select deployment_mode from fantasy.settings)<>'preview' or exists(select 1 from fantasy.members) or exists(select 1 from fantasy.cards) or exists(select 1 from fantasy.journals) or exists(select 1 from fantasy.entries) then raise exception 'Clean production Fantasy installation required'; end if;
 insert into fantasy.pack_definitions(name,version,slots,pool,weights,guarantees,price,max_quantity,tradeable,ends_at)
 select 'Starter',2,'["GK","DEF","DEF","DEF","DEF","MID","MID","MID","MID","FWD","FWD"]',array_agg(id),'{"CORE":100}','{}',0,1000,false,clock_timestamp()+interval '100 years' from fantasy.editions where tier='CORE' returning id into starter;
 insert into fantasy.pack_definitions(name,slots,pool,weights,guarantees,price,max_quantity,tradeable,ends_at)
 select 'Daily reward', '["ANY"]',array_agg(id),'{"CORE":100}','{}',0,10000,false,clock_timestamp()+interval '100 years' from fantasy.editions where tier='CORE' returning id into reward;
 insert into fantasy.production_catalog values(true,starter,reward);
 insert into fantasy.production_definitions values(starter,'starter'),(reward,'reward');
 insert into fantasy.production_policy(daily_points,card_every,daily_card_limit) values(10,7,100);
 insert into fantasy.scoring_rules(version,rules) select 'football-free-play-v1',rules from fantasy.scoring_rules where version='football-demo-v1' returning id into scoring;
 insert into fantasy.competitions(name,sport,season,round,locks_at,rules,scoring_id,prize) values('Free football league','football','2027',1,clock_timestamp()+interval '7 days','{"duplicates":false}',scoring,'No cash prize') returning id into comp;
 insert into fantasy.production_rounds values(comp);
 update fantasy.settings set deployment_mode='production',production_ref=project_ref,terms_version=terms,privacy_version=privacy,enabled=true;
end $$;
create function fantasy.production_pack(definition uuid,u uuid) returns uuid language plpgsql set search_path='' as $$ declare d fantasy.pack_definitions; pack uuid; begin
 select * into strict d from fantasy.pack_definitions where id=definition for update;
 if d.price<>0 or d.tradeable or d.status<>'active' or clock_timestamp()<d.starts_at or clock_timestamp()>=d.ends_at or d.sold>=d.max_quantity then raise exception 'Free pack unavailable'; end if;
 insert into fantasy.packs(user_id,definition_id,request_id) values(u,d.id,gen_random_uuid()) returning id into pack;
 update fantasy.pack_definitions set sold=sold+1 where id=d.id;
 perform fantasy.prepare_pack(pack,u);
 return pack;
end $$;
create function fantasy.production_command(action text,p jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; prior fantasy.requests; result jsonb; pack uuid; comp_id uuid; definition uuid; previous fantasy.pack_definitions; policy fantasy.production_policy; claim fantasy.daily_claims; period_key date; outcome text:='not_due'; count_claims integer; begin
 perform pg_advisory_xact_lock(71820341);
 u:=fantasy.production_eligible();
 if request_id is null or p is null or jsonb_typeof(p)<>'object' then raise exception 'Request ID and payload required'; end if;
 if action is null or action not in('claim_starter','claim_daily','open_pack','save_lineup','admin_reward_policy','admin_stats','admin_simulate','admin_free_round','admin_starter_stock') then raise exception 'Action unavailable in free-play production'; end if;
 insert into fantasy.members(user_id,expires_at) values(u,'infinity') on conflict(user_id) do nothing;
 perform fantasy.actor(action like 'admin_%');
 select * into prior from fantasy.requests q where q.user_id=u and q.request_id=production_command.request_id;
 if found then if prior.action<>action or prior.payload<>p then raise exception 'Request ID reused'; end if; return prior.result; end if;
 if action in('open_pack','save_lineup','admin_stats','admin_simulate') then
  if action<>'open_pack' and not exists(select 1 from fantasy.production_rounds where competition_id=(p->>'competition_id')::uuid) then raise exception 'Production round required'; end if;
  if action='open_pack' and not exists(select 1 from fantasy.packs pa join fantasy.production_definitions pd on pa.definition_id=pd.definition_id where pa.id=(p->>'pack_id')::uuid and pa.user_id=u) then raise exception 'Own production pack required'; end if;
  return fantasy.preview_command(action,p,request_id);
 elsif action='claim_starter' then
  if p<>'{}'::jsonb then raise exception 'Starter payload must be empty'; end if;
  select pack_id into pack from fantasy.starter_claims where user_id=u;
  if pack is null then
   pack:=fantasy.production_pack((select starter_definition from fantasy.production_catalog),u);
   insert into fantasy.starter_claims values(u,pack,clock_timestamp());
  end if;
  result:=jsonb_build_object('pack_id',pack);
 elsif action='claim_daily' then
  if p<>'{}'::jsonb then raise exception 'Daily payload must be empty'; end if;
  if not exists(select 1 from fantasy.starter_claims where user_id=u) then raise exception 'Claim starter before daily rewards'; end if;
  period_key:=(clock_timestamp() at time zone 'UTC')::date;
  select * into claim from fantasy.daily_claims where user_id=u and period=period_key;
  if not found then
   select * into strict policy from fantasy.production_policy order by version desc limit 1;
   select count(*)+1 into count_claims from fantasy.daily_claims where user_id=u;
   if count_claims%policy.card_every=0 then
    if (select count(*) from fantasy.daily_claims where period=period_key and pack_id is not null)>=policy.daily_card_limit then outcome:='daily_limit';
    else
     -- Only expected stock exhaustion falls back to points; unexpected failures abort.
     if exists(select 1 from fantasy.pack_definitions d join fantasy.production_catalog pc on pc.reward_definition=d.id where d.price=0 and not d.tradeable and d.sold<d.max_quantity and d.status='active' and clock_timestamp()>=d.starts_at and clock_timestamp()<d.ends_at and exists(select 1 from fantasy.editions e join fantasy.players pl on pl.id=e.player_id where e.id=any(d.pool) and e.tier='CORE' and e.status='launched' and e.launch_at<=clock_timestamp() and e.issued<e.max_supply and pl.status not in('retired','delisted'))) then
      pack:=fantasy.production_pack((select reward_definition from fantasy.production_catalog),u); outcome:='awarded';
     else outcome:='stock_unavailable'; end if;
    end if;
   end if;
   insert into fantasy.daily_claims(user_id,period,points,policy_version,pack_id,card_outcome) values(u,period_key,policy.daily_points,policy.version,pack,outcome) returning * into claim;
  end if;
  result:=jsonb_build_object('claim_id',claim.id,'period',claim.period,'points',claim.points,'pack_id',claim.pack_id,'card_outcome',claim.card_outcome);
 elsif action='admin_starter_stock' then
  if p->>'quantity' is null or (select count(*) from jsonb_object_keys(p))<>1 or (p->>'quantity')::integer not between 1 and 1000 then raise exception 'Bounded starter quantity required'; end if;
  select d.* into strict previous from fantasy.pack_definitions d join fantasy.production_catalog pc on pc.starter_definition=d.id;
  if previous.sold<previous.max_quantity then raise exception 'Existing starter allocation must be exhausted'; end if;
  insert into fantasy.pack_definitions(name,version,slots,pool,weights,guarantees,price,max_quantity,tradeable,ends_at)
   values('Starter',previous.version+1,previous.slots,previous.pool,previous.weights,previous.guarantees,0,(p->>'quantity')::integer,false,previous.ends_at) returning id into definition;
  insert into fantasy.production_definitions values(definition,'starter');
  update fantasy.production_catalog set starter_definition=definition;
  result:=jsonb_build_object('definition_id',definition);
  insert into fantasy.admin_events(actor,action,payload) values(u,action,p);
 elsif action='admin_free_round' then
  if not (p ?& array['name','season','round','locks_at']) or (select count(*) from jsonb_object_keys(p))<>4 or length(p->>'name') not between 2 and 80 or length(p->>'season') not between 1 and 20 or (p->>'round')::integer not between 1 and 1000 or (p->>'locks_at')::timestamptz<=clock_timestamp() or (p->>'locks_at')::timestamptz>clock_timestamp()+interval '90 days' then raise exception 'Valid future free round required'; end if;
  insert into fantasy.competitions(name,sport,season,round,locks_at,rules,scoring_id,prize) values(p->>'name','football',p->>'season',(p->>'round')::integer,(p->>'locks_at')::timestamptz,'{"duplicates":false}',(select id from fantasy.scoring_rules where version='football-free-play-v1'),'No cash prize') returning id into comp_id;
  insert into fantasy.production_rounds values(comp_id);
  result:=jsonb_build_object('competition_id',comp_id);
  insert into fantasy.admin_events(actor,action,payload) values(u,action,p);
 else
  if not (p ?& array['daily_points','card_every','daily_card_limit']) or (select count(*) from jsonb_object_keys(p))<>3 then raise exception 'Exact reward policy required'; end if;
  insert into fantasy.production_policy(daily_points,card_every,daily_card_limit,actor) values((p->>'daily_points')::integer,(p->>'card_every')::integer,(p->>'daily_card_limit')::integer,u) returning jsonb_build_object('version',version) into result;
  insert into fantasy.admin_events(actor,action,payload) values(u,action,p);
 end if;
 insert into fantasy.requests values(u,request_id,action,p,result);
 return result;
end $$;

create function fantasy.production_read_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; t timestamptz:=clock_timestamp(); result jsonb; begin
 u:=fantasy.production_eligible();
 if exists(select 1 from fantasy.members where user_id=u and (revoked_at is not null or expires_at<=clock_timestamp())) then raise exception 'Membership inactive'; end if;
 select jsonb_build_object('mode','production','user_id',u,'credits',0,'fee_bps',0,'admin',coalesce(auth.jwt()->>'aal','')='aal2' and exists(select 1 from private.roles where user_id=u and role in('owner','admin')),'catalog',null,
 'cards',coalesce((select jsonb_agg(to_jsonb(x)) from (select a.*,e.tier,e.season,e.kind,e.max_supply,e.player_id,p.name,p.position,p.team,p.colour,p.shirt,p.status,p.sport,false as listed,a.created_at as acquired_at from fantasy.cards a join fantasy.editions e on e.id=a.edition_id join fantasy.players p on p.id=e.player_id where a.owner_id=u and not exists(select 1 from fantasy.pack_items pi join fantasy.packs pa on pa.id=pi.pack_id where pi.card_id=a.id and pa.opened_at is null) order by a.created_at desc limit 1000) x),'[]'),
 'packs',coalesce((select jsonb_agg(to_jsonb(x)) from (select a.*,d.name,d.slots,case when a.opened_at is not null then (select jsonb_agg(card_id order by slot) from fantasy.pack_items where pack_id=a.id) else null end as cards from fantasy.packs a join fantasy.pack_definitions d on d.id=a.definition_id where a.user_id=u order by a.created_at desc limit 1000) x),'[]'),
 'shop','[]'::jsonb,'market','[]'::jsonb,'trades','[]'::jsonb,'ledger','[]'::jsonb,'replacements','[]'::jsonb,
 'competitions',coalesce((select jsonb_agg(to_jsonb(c)-'prize') from (select co.* from fantasy.competitions co join fantasy.production_rounds pr on pr.competition_id=co.id order by co.locks_at desc limit 50)c),'[]'),
 'entries',coalesce((select jsonb_agg(to_jsonb(e)) from (select * from fantasy.entries where user_id=u order by updated_at desc limit 50)e),'[]'),
 'results',coalesce((select jsonb_agg(to_jsonb(r)) from (select r.* from fantasy.results r join fantasy.production_rounds pr on pr.competition_id=r.competition_id where r.user_id=u order by r.competition_id limit 100)r),'[]'),
 'provenance',coalesce((select jsonb_agg(to_jsonb(o)) from (select o.* from fantasy.ownership_events o join fantasy.cards c on c.id=o.card_id where c.owner_id=u order by o.created_at desc limit 1000)o),'[]'),
 'members',jsonb_build_array(jsonb_build_object('id',u,'name','You')),
 'rewards',jsonb_build_object('server_time',t,'period_timezone','UTC','next_claim_at',case when exists(select 1 from fantasy.daily_claims where user_id=u and period=(t at time zone 'UTC')::date) then ((t at time zone 'UTC')::date+1)::timestamp at time zone 'UTC' else t end,'claimed_today',exists(select 1 from fantasy.daily_claims where user_id=u and period=(t at time zone 'UTC')::date),'points',coalesce((select sum(points) from fantasy.daily_claims where user_id=u),0),'starter_claimed',exists(select 1 from fantasy.starter_claims where user_id=u),'policy',(select to_jsonb(p)-'actor' from fantasy.production_policy p order by version desc limit 1),'history',coalesce((select jsonb_agg(to_jsonb(h)) from (select period,points,policy_version,pack_id,card_outcome,created_at from fantasy.daily_claims where user_id=u order by period desc limit 90)h),'[]'))
 ) into result;
 return result;
end $$;

create or replace function fantasy.social(u uuid,body text) returns void language plpgsql set search_path='' as $$ declare sid uuid; begin
 select id into sid from private.social_profiles where user_id=u and status='active' and visibility='members';
 if sid is not null and private.community_feature_allowed(u,'community_social') then
  insert into private.social_posts(author_id,kind,body,sport) values(sid,'celebration',case when (select deployment_mode from fantasy.settings)='production' then replace(body,'Fantasy Cards Preview','Fantasy Cards') else body end,'football');
 end if;
end $$;
-- No direct runtime access to legacy helpers or production bootstrap.
revoke all on all functions in schema fantasy from public,anon,authenticated,docked_app;
grant execute on function fantasy.command(text,jsonb,uuid),fantasy.read_state(),fantasy.production_command(text,jsonb,uuid),fantasy.production_read_state() to docked_app;
