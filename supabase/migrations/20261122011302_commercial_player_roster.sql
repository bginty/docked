-- Current roster facts are separate from immutable collectible identity.
-- No existing definitions, cards, balances, flags or source decisions change.
create table commercial_billing.roster_batches(
 id uuid primary key default gen_random_uuid(),actor uuid not null,request uuid not null,
 command jsonb not null,command_hash text not null check(command_hash~'^[a-f0-9]{64}$'),
 changes integer not null,new_definitions integer not null,created_at timestamptz not null default clock_timestamp(),
 unique(actor,request)
);
create table commercial_billing.roster_candidates(
 player_id uuid primary key,sport text not null check(sport in('nfl','afl','nrl')),
 candidate jsonb not null,actor uuid not null,batch uuid not null references commercial_billing.roster_batches,
 created_at timestamptz not null default clock_timestamp()
);
-- The first reviewed candidate fixes identity. Later reviewed club/position/
-- source metadata is retained in immutable batch commands before the first
-- definition registration; permanent definition snapshots never change.
create table commercial_billing.player_roster_events(
 id uuid primary key default gen_random_uuid(),sequence bigint generated always as identity unique,
 sport text not null check(sport in('nfl','afl','nrl')),player_id uuid not null,
 registration text not null check(registration in('ACTIVE','DELISTED','RETIRED','UNSIGNED','PENDING_RELIST','UNKNOWN')),
 availability text not null check(availability in('AVAILABLE','INJURED','SUSPENDED','UNKNOWN')),
 club_id text,club_name text,source_url text not null,source_hash text not null check(source_hash~'^[a-f0-9]{64}$'),
 observed_at timestamptz not null,effective_at timestamptz not null,
 actor uuid not null,batch uuid not null references commercial_billing.roster_batches,
 relist_confirmed boolean not null,recorded_at timestamptz not null default clock_timestamp(),
 unique(batch,sport,player_id),check((club_id is null)=(club_name is null)),
 check(registration<>'ACTIVE' or(club_id is not null and club_name is not null))
);
create index commercial_player_roster_latest on commercial_billing.player_roster_events(sport,player_id,sequence desc);
create table commercial_billing.roster_definition_registrations(
 definition uuid primary key references commercial_billing.definitions,
 player_id uuid not null,sport text not null,batch uuid not null references commercial_billing.roster_batches
);
create table commercial_billing.roster_activation_events(
 id uuid primary key default gen_random_uuid(),actor uuid not null,request uuid not null,
 player_id uuid not null,sport text not null,revision uuid not null references commercial_billing.player_roster_events,
 command jsonb not null,rights_reference text not null,created_at timestamptz not null default clock_timestamp(),unique(actor,request)
);
do $$declare t text;begin
 foreach t in array array['roster_batches','roster_candidates','player_roster_events','roster_definition_registrations','roster_activation_events'] loop
  execute format('alter table commercial_billing.%I enable row level security',t);
  execute format('revoke all on commercial_billing.%I from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app',t);
  execute format('grant select on commercial_billing.%I to docked_commercial_app',t);
  execute format('create policy commercial_roster_read on commercial_billing.%I for select to docked_commercial_app using(true)',t);
  execute format('create trigger immutable before update or delete on commercial_billing.%I for each row execute function commercial_billing.immutable()',t);
  execute format('create trigger no_truncate before truncate on commercial_billing.%I for each statement execute function commercial_billing.immutable()',t);
 end loop;
end$$;


revoke all on sequence commercial_billing.player_roster_events_sequence_seq from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
create view commercial_billing.current_player_roster with(security_invoker=true) as
 select distinct on(sport,player_id) * from commercial_billing.player_roster_events order by sport,player_id,sequence desc;
revoke all on commercial_billing.current_player_roster from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant select on commercial_billing.current_player_roster to docked_commercial_app;

-- Preserve the existing approved pool until a reviewed roster decision exists.
-- Thereafter only explicit ACTIVE registration admits future draws. No expiry
-- or missing fetch can silently resurrect a negative decision.
create function commercial_billing.roster_can_issue(s text,p uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce((select registration='ACTIVE' from commercial_billing.current_player_roster where sport=s and player_id=p),true)
$$;
-- Issuance takes shared control/account locks before the shared roster gate,
-- then deterministic definition rows. Import takes shared control then the
-- exclusive gate; it never takes customer-account locks while holding the gate.
create function commercial_billing.lock_roster_issuance() returns void
language plpgsql security definer set search_path='' as $$begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Pack issuance requires READ COMMITTED isolation';end if;
 perform 1 from commercial_billing.lock_control();
 perform pg_advisory_xact_lock_shared(76122026);
end$$;
create function commercial_billing.guard_roster_issuance() returns trigger
language plpgsql security definer set search_path='' as $$declare d commercial_billing.definitions;begin
 perform commercial_billing.lock_roster_issuance();
 select * into strict d from commercial_billing.definitions where id=new.definition;
 if not commercial_billing.roster_can_issue(d.sport,d.player_id) then raise exception 'Player is excluded from new pack issuance';end if;
 return new;
end$$;
-- Alphabetical trigger order obtains control/roster locks before the original
-- card supply trigger. Owner/lock UPDATE paths are deliberately unaffected.
create trigger a_commercial_roster_issuance before insert on commercial_billing.cards
 for each row execute function commercial_billing.guard_roster_issuance();

-- Existing reviewed aliases remain the cross-provider identity authority. NFL
-- can use that same registry without importing any beta identities or assets.
alter table sports_feed.player_identities drop constraint player_identities_sport_check;
alter table sports_feed.player_identities add constraint player_identities_sport_check check(sport in('afl','football','basketball','nrl','nfl'));

create function commercial_billing.official_roster_source(s text,u text) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(u~'^https://[^/?#@:]+(/|$)' and exists(
  select 1 from(values ('afl','afl.com.au'),('afl','aflplayers.com.au'),('afl','afc.com.au'),('afl','lions.com.au'),('afl','carltonfc.com.au'),('afl','collingwoodfc.com.au'),('afl','essendonfc.com.au'),('afl','fremantlefc.com.au'),('afl','geelongcats.com.au'),('afl','goldcoastfc.com.au'),('afl','gwsgiants.com.au'),('afl','hawthornfc.com.au'),('afl','melbournefc.com.au'),('afl','nmfc.com.au'),('afl','portadelaidefc.com.au'),('afl','richmondfc.com.au'),('afl','saints.com.au'),('afl','sydneyswans.com.au'),('afl','westcoasteagles.com.au'),('afl','westernbulldogs.com.au'),('nrl','nrl.com'),('nrl','broncos.com.au'),('nrl','raiders.com.au'),('nrl','bulldogs.com.au'),('nrl','sharks.com.au'),('nrl','dolphinsnrl.com.au'),('nrl','titans.com.au'),('nrl','seaeagles.com.au'),('nrl','melbournestorm.com.au'),('nrl','newcastleknights.com.au'),('nrl','cowboys.com.au'),('nrl','parraeels.com.au'),('nrl','penrithpanthers.com.au'),('nrl','rabbitohs.com.au'),('nrl','dragons.com.au'),('nrl','roosters.com.au'),('nrl','warriors.kiwi'),('nrl','weststigers.com.au'),('nfl','nfl.com'),('nfl','azcardinals.com'),('nfl','atlantafalcons.com'),('nfl','baltimoreravens.com'),('nfl','buffalobills.com'),('nfl','panthers.com'),('nfl','chicagobears.com'),('nfl','bengals.com'),('nfl','clevelandbrowns.com'),('nfl','dallascowboys.com'),('nfl','denverbroncos.com'),('nfl','detroitlions.com'),('nfl','packers.com'),('nfl','houstontexans.com'),('nfl','colts.com'),('nfl','jaguars.com'),('nfl','chiefs.com'),('nfl','chargers.com'),('nfl','therams.com'),('nfl','raiders.com'),('nfl','miamidolphins.com'),('nfl','vikings.com'),('nfl','patriots.com'),('nfl','neworleanssaints.com'),('nfl','giants.com'),('nfl','newyorkjets.com'),('nfl','philadelphiaeagles.com'),('nfl','steelers.com'),('nfl','seahawks.com'),('nfl','49ers.com'),('nfl','buccaneers.com'),('nfl','tennesseetitans.com'),('nfl','commanders.com')) h(sport,host) where h.sport=s and
   (lower(substring(u from '^https://([^/?#]+)'))=h.host or lower(substring(u from '^https://([^/?#]+)')) like '%.'||h.host)
 ),false)
$$;

create function commercial_billing.apply_roster_batch(expected_actor uuid,p jsonb,p_hash text,p_definitions jsonb)
returns commercial_billing.roster_batches language plpgsql security definer set search_path='' as $$
<<roster_apply>>
declare answer commercial_billing.roster_batches; item jsonb; candidate jsonb; initial_candidate jsonb; prior commercial_billing.player_roster_events;
 target uuid;s text;observed timestamptz;effective timestamptz;aliases jsonb;alias jsonb;new_count integer:=0;row_count integer;
 d jsonb;known boolean;batch_id uuid:=gen_random_uuid();request_id uuid;seen text[]:='{}';identity text;
 definition_hash text;definition_id uuid;expected_snapshot jsonb;expected_rights text;
begin
 perform commercial_billing.pack_award_actor(expected_actor);
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Roster mutation requires READ COMMITTED isolation';end if;
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>1048576
  or p->'confirmed' is distinct from 'true'::jsonb or jsonb_typeof(p->'changes') is distinct from 'array'
  or jsonb_array_length(p->'changes') not between 1 and 200 or coalesce(length(btrim(p->>'reference')),0) not between 3 and 200
  or p_hash is null or p_hash!~'^[a-f0-9]{64}$' or jsonb_typeof(p_definitions) is distinct from 'array'
  then raise exception 'Exact reviewed roster batch required';end if;
 request_id:=(p->>'request')::uuid;if request_id is null then raise exception 'Roster request required';end if;
 perform 1 from commercial_billing.lock_control();
 perform pg_advisory_xact_lock(76122026);
 select * into answer from commercial_billing.roster_batches where actor=expected_actor and request=request_id;
 if found then
  if answer.command<>p or answer.command_hash<>p_hash then raise exception 'Roster request conflict';end if;return answer;
 end if;
 -- Batch is inserted before children, then immutable; compute its count from
 -- canonical server-generated definition rows, checked against actual inserts.
 for d in select value from jsonb_array_elements(p_definitions) loop
  if not exists(select 1 from commercial_billing.definitions where id=(d->>'id')::uuid) then new_count:=new_count+1;end if;
 end loop;
 insert into commercial_billing.roster_batches(id,actor,request,command,command_hash,changes,new_definitions)
 values(batch_id,expected_actor,request_id,p,p_hash,jsonb_array_length(p->'changes'),new_count) returning * into answer;
 for item in select value from jsonb_array_elements(p->'changes') loop
  target:=(item->>'playerId')::uuid;s:=item->>'sport';identity:=s||':'||target::text;
  if target is null or s not in('nfl','afl','nrl') or identity=any(seen)
   or coalesce(item->>'registration','') not in('ACTIVE','DELISTED','RETIRED','UNSIGNED','PENDING_RELIST','UNKNOWN')
   or coalesce(item->>'availability','') not in('AVAILABLE','INJURED','SUSPENDED','UNKNOWN')
   or jsonb_typeof(item->'source') is distinct from 'object'
   or jsonb_typeof(item#>'{source,url}') is distinct from 'string'
   or jsonb_typeof(item#>'{source,hash}') is distinct from 'string'
   or jsonb_typeof(item#>'{source,observedAt}') is distinct from 'string'
   or jsonb_typeof(item#>'{source,effectiveAt}') is distinct from 'string'
   or coalesce(item#>>'{source,hash}','')!~'^[a-f0-9]{64}$'
   or not commercial_billing.official_roster_source(s,item#>>'{source,url}')
   then raise exception 'Invalid or duplicate canonical roster decision';end if;
  if item->>'registration'='ACTIVE' and(
   jsonb_typeof(item->'currentClub') is distinct from 'object'
   or jsonb_typeof(item#>'{currentClub,id}') is distinct from 'string'
   or jsonb_typeof(item#>'{currentClub,name}') is distinct from 'string'
   or coalesce(length(btrim(item#>>'{currentClub,id}')),0) not between 1 and 80
   or coalesce(length(btrim(item#>>'{currentClub,name}')),0) not between 1 and 120
  ) then raise exception 'Exact current registered club required';end if;
  seen:=array_append(seen,identity);observed:=(item#>>'{source,observedAt}')::timestamptz;effective:=(item#>>'{source,effectiveAt}')::timestamptz;
  if observed is null or effective is null or not isfinite(observed) or not isfinite(effective) or observed>clock_timestamp() or effective>clock_timestamp()
   then raise exception 'Future return or unobserved roster decision cannot be activated';end if;
  select * into prior from commercial_billing.current_player_roster where sport=s and player_id=target;
  if prior.id is distinct from (item->>'expectedRevision')::uuid then raise exception 'Roster changed; review current revision';end if;
  if prior.id is not null and(observed<prior.observed_at or effective<prior.effective_at) then raise exception 'Older roster evidence cannot replace a current decision';end if;
  if prior.id is not null and prior.registration<>'ACTIVE' and item->>'registration'='ACTIVE' and item->'relistConfirmed' is distinct from 'true'::jsonb
   then raise exception 'A verified return requires explicit relist confirmation';end if;
  candidate:=item->'candidate';
  if candidate is not null and(
   jsonb_typeof(candidate) is distinct from 'object' or jsonb_typeof(candidate->'snapshot') is distinct from 'object'
   or candidate->>'id' is distinct from target::text or candidate->>'sport' is distinct from s
   or jsonb_typeof(candidate->'provider') is distinct from 'string'
   or jsonb_typeof(candidate->'providerId') is distinct from 'string'
   or jsonb_typeof(candidate#>'{snapshot,name}') is distinct from 'string'
   or jsonb_typeof(candidate#>'{snapshot,team}') is distinct from 'string'
   or jsonb_typeof(candidate#>'{snapshot,position}') is distinct from 'string'
   or jsonb_typeof(candidate#>'{snapshot,season}') is distinct from 'string'
   or jsonb_typeof(candidate#>'{snapshot,colour}') is distinct from 'string'
   or coalesce(length(btrim(candidate#>>'{snapshot,name}')),0) not between 1 and 120
   or coalesce(length(btrim(candidate#>>'{snapshot,team}')),0) not between 1 and 120
   or coalesce(length(btrim(candidate#>>'{snapshot,position}')),0) not between 1 and 40
   or coalesce(length(btrim(candidate#>>'{snapshot,season}')),0) not between 1 and 80
   or coalesce(candidate#>>'{snapshot,colour}','')!~*'^#[a-f0-9]{6}$'
   or(candidate->'snapshot'?'accentColour' and(jsonb_typeof(candidate#>'{snapshot,accentColour}') is distinct from 'string'
    or coalesce(candidate#>>'{snapshot,accentColour}','')!~*'^#[a-f0-9]{6}$'))
   or coalesce(candidate#>>'{snapshot,status}','') not in('active','inactive','injured')
   or not(candidate->'snapshot'?'verifiedJerseyNumber')
   or(candidate#>'{snapshot,verifiedJerseyNumber}' is distinct from 'null'::jsonb and(
    jsonb_typeof(candidate#>'{snapshot,verifiedJerseyNumber}') is distinct from 'number'
    or coalesce(candidate#>>'{snapshot,verifiedJerseyNumber}','')!~'^[0-9]{1,2}$'))
   or candidate#>'{snapshot,synthetic}' is distinct from 'false'::jsonb
   or jsonb_typeof(candidate->'eligiblePositions') is distinct from 'array'
   or jsonb_array_length(candidate->'eligiblePositions') not between 1 and 6
   or(select count(distinct x.position) from jsonb_array_elements_text(candidate->'eligiblePositions') x(position))<>jsonb_array_length(candidate->'eligiblePositions')
   or not(candidate->'eligiblePositions' ? (candidate#>>'{snapshot,position}'))
   or exists(select 1 from jsonb_array_elements_text(candidate->'eligiblePositions') x(position) where
     (s='nfl' and x.position not in('QB','RB','WR','TE'))
     or(s='afl' and x.position not in('DEF','MID','FWD','RUC'))
     or(s='nrl' and x.position not in('WFB','CTR','HLF','EDG','MID')))
   or candidate#>>'{source,url}' is distinct from item#>>'{source,url}'
   or candidate#>>'{source,hash}' is distinct from item#>>'{source,hash}'
   or jsonb_typeof(candidate->'source') is distinct from 'object'
   or jsonb_typeof(candidate#>'{source,url}') is distinct from 'string'
   or jsonb_typeof(candidate#>'{source,hash}') is distinct from 'string'
   or jsonb_typeof(candidate#>'{source,checkedAt}') is distinct from 'string'
   or jsonb_typeof(candidate#>'{source,license}') is distinct from 'string'
   or jsonb_typeof(candidate#>'{source,verification}') is distinct from 'string'
   or(candidate#>>'{source,checkedAt}')::timestamptz is distinct from observed
   or candidate#>'{source,permanentIssuanceEligible}' is distinct from 'false'::jsonb
   or coalesce(length(btrim(candidate#>>'{source,license}')),0) not between 1 and 200
   or coalesce(length(btrim(candidate#>>'{source,verification}')),0) not between 12 and 600
  ) then raise exception 'Verified canonical identity, position and source must agree';end if;
  if candidate is not null then
   select c.candidate into initial_candidate from commercial_billing.roster_candidates c where c.sport=s and c.player_id=target;
   if found and(
    candidate->>'provider' is distinct from initial_candidate->>'provider'
    or candidate->>'providerId' is distinct from initial_candidate->>'providerId'
    or candidate#>>'{snapshot,name}' is distinct from initial_candidate#>>'{snapshot,name}'
   ) then raise exception 'Reviewed candidate must preserve its canonical identity and provider binding';end if;
  end if;
  select exists(select 1 from commercial_billing.definitions where sport=s and player_id=target)
   or exists(select 1 from commercial_billing.roster_candidates where sport=s and player_id=target) into known;
  if not known then
   if candidate is null then raise exception 'Verified new player identity, position and source required';end if;
   if exists(select 1 from commercial_billing.definitions where sport=s and lower(btrim(snapshot->>'name'))=lower(btrim(candidate#>>'{snapshot,name}')))
    or exists(select 1 from commercial_billing.roster_candidates where sport=s and lower(btrim(roster_candidates.candidate#>>'{snapshot,name}'))=lower(btrim(roster_apply.candidate#>>'{snapshot,name}')))
    then raise exception 'Matching existing player name requires canonical identity review';end if;
   insert into commercial_billing.roster_candidates(player_id,sport,candidate,actor,batch) values(target,s,roster_apply.candidate,expected_actor,batch_id);
  end if;
  aliases:=coalesce(item->'aliases','[]');
  if candidate is not null then aliases:=aliases||jsonb_build_array(jsonb_build_object('provider',candidate->>'provider','providerId',candidate->>'providerId'));end if;
  for alias in select value from jsonb_array_elements(aliases) loop
   if jsonb_typeof(alias->'provider') is distinct from 'string' or jsonb_typeof(alias->'providerId') is distinct from 'string'
    or coalesce(length(btrim(alias->>'provider')),0) not between 1 and 80 or coalesce(length(btrim(alias->>'providerId')),0) not between 1 and 160
    then raise exception 'Provider alias required';end if;
   if exists(select 1 from sports_feed.player_aliases where sport=s and provider=alias->>'provider'
     and((provider_player_id=alias->>'providerId' and player_id<>target::text) or(player_id=target::text and provider_player_id<>alias->>'providerId')))
    or exists(select 1 from commercial_billing.definitions where sport=s and snapshot->>'provider'=alias->>'provider'
     and((snapshot->>'providerId'=alias->>'providerId' and player_id<>target) or(player_id=target and snapshot->>'providerId'<>alias->>'providerId')))
    then raise exception 'Provider alias conflicts with permanent player identity';end if;
   insert into sports_feed.player_identities(sport,player_id) values(s,target::text) on conflict do nothing;
   insert into sports_feed.player_aliases(sport,provider,provider_player_id,player_id,evidence_hash)
    values(s,alias->>'provider',alias->>'providerId',target::text,item#>>'{source,hash}') on conflict do nothing;
   if not exists(select 1 from sports_feed.player_aliases where sport=s and provider=alias->>'provider'
     and provider_player_id=alias->>'providerId' and player_id=target::text)
    then raise exception 'Provider alias changed during canonical identity review';end if;
  end loop;
  if item->'registerDefinitions'='true'::jsonb then
   if item->>'registration' is distinct from 'ACTIVE' or candidate#>>'{snapshot,team}' is distinct from item#>>'{currentClub,name}'
    or candidate#>>'{snapshot,status}' is distinct from 'active' and candidate#>>'{snapshot,status}' is distinct from 'injured'
    then raise exception 'Active registration and exact current club are required before registering permanent definitions';end if;
   if candidate is null or not exists(select 1 from commercial_billing.roster_candidates where player_id=target and sport=s)
    or exists(select 1 from commercial_billing.definitions d where d.player_id=target and d.sport=s and not exists(select 1 from commercial_billing.roster_definition_registrations r where r.definition=d.id))
    then raise exception 'Only a verified new candidate can register dormant definitions';end if;
   if(select count(*) from jsonb_array_elements(p_definitions) x(value) where x.value->>'player_id'=target::text and x.value->>'sport'=s)<>5
    then raise exception 'Exactly five canonical rarity definitions required';end if;
   expected_snapshot:=candidate->'snapshot'||jsonb_build_object('eligiblePositions',candidate->'eligiblePositions',
    'provider',candidate->>'provider','providerId',candidate->>'providerId','source',candidate->'source');
   expected_rights:='owner-confirmed-player-names-20261102; factual-source:'||(candidate#>>'{source,license}')||':'||(candidate#>>'{source,hash}')||'; permanent-issuance-pending';
   for d in select value from jsonb_array_elements(p_definitions) where value->>'player_id'=target::text and value->>'sport'=s loop
    definition_hash:=encode(sha256(convert_to('dormant-real-player-pool-2026-11-05-v1:'||s||':'||target::text||':'||(d->>'rarity'),'UTF8')),'hex');
    definition_id:=(substr(definition_hash,1,8)||'-'||substr(definition_hash,9,4)||'-5'||substr(definition_hash,14,3)||'-a'||substr(definition_hash,18,3)||'-'||substr(definition_hash,21,12))::uuid;
    if d->'approved' is distinct from 'false'::jsonb or d->>'issued' is distinct from '0' or d->>'legacy_issued' is distinct from '0'
     or(d->>'id')::uuid is distinct from definition_id or definition_id is null
     or(d->>'lifetime_cap')::integer is distinct from(case d->>'rarity' when 'RARE' then 5000 when 'ELITE' then 2500 when 'ULTRA_RARE' then 400 when 'LEGENDARY' then 50 when 'ICON' then 1 end)
     or d->'snapshot' is distinct from expected_snapshot or d->>'rights_reference' is distinct from expected_rights
     then raise exception 'Canonical dormant definition required';end if;
    if not exists(select 1 from commercial_billing.definitions where id=(d->>'id')::uuid) then
     insert into commercial_billing.definitions(id,player_id,sport,rarity,lifetime_cap,issued,legacy_issued,approved,rights_reference,snapshot)
      values((d->>'id')::uuid,target,s,d->>'rarity',(d->>'lifetime_cap')::integer,0,0,false,d->>'rights_reference',d->'snapshot');
     insert into commercial_billing.roster_definition_registrations values((d->>'id')::uuid,target,s,batch_id);
    elsif not exists(select 1 from commercial_billing.definitions x where x.id=definition_id and x.player_id=target and x.sport=s
     and x.rarity=d->>'rarity' and x.lifetime_cap=(d->>'lifetime_cap')::integer and x.issued=0 and x.legacy_issued=0
     and not x.approved and x.snapshot=expected_snapshot and x.rights_reference=expected_rights)
      then raise exception 'Registered definition differs from exact dormant candidate';
    end if;
   end loop;
  end if;
  insert into commercial_billing.player_roster_events(sport,player_id,registration,availability,club_id,club_name,source_url,source_hash,observed_at,effective_at,actor,batch,relist_confirmed)
   values(s,target,item->>'registration',item->>'availability',item#>>'{currentClub,id}',item#>>'{currentClub,name}',item#>>'{source,url}',item#>>'{source,hash}',observed,effective,expected_actor,batch_id,coalesce((item->>'relistConfirmed')::boolean,false));
 end loop;
 if(select count(*) from commercial_billing.roster_definition_registrations where batch=batch_id)<>new_count then raise exception 'Unexpected dormant definition rows';end if;
 return answer;
end$$;

create function commercial_billing.owner_roster_rows(expected_actor uuid) returns setof jsonb
language plpgsql security definer set search_path='' set statement_timeout='10s' as $$begin
 perform commercial_billing.pack_award_actor(expected_actor);
 return query with definitions as(
  select d.sport,d.player_id,min(d.snapshot->>'name') name,
   array_agg(distinct d.snapshot->>'team' order by d.snapshot->>'team') saved_clubs,
   count(*)::integer definitions,count(*) filter(where d.approved)::integer approved,
   sum(d.issued)::integer issued,bool_or(d.approved and d.issued<d.lifetime_cap) capacity,
   jsonb_agg(jsonb_build_object('id',d.id,'rarity',d.rarity,'cap',d.lifetime_cap,'issued',d.issued,
    'remaining',d.lifetime_cap-d.issued,'approved',d.approved) order by d.id) supply
  from commercial_billing.definitions d group by d.sport,d.player_id
 ), players as(
  select * from definitions union all
  select c.sport,c.player_id,c.candidate#>>'{snapshot,name}',array[]::text[],0,0,0,false,'[]'::jsonb
   from commercial_billing.roster_candidates c where not exists(select 1 from definitions d where d.player_id=c.player_id and d.sport=c.sport)
 ) select jsonb_build_object(
  'playerId',p.player_id,'sport',p.sport,'name',p.name,'currentClubId',r.club_id,'currentClubName',r.club_name,
  'savedClubs',p.saved_clubs,'registration',coalesce(r.registration,'LEGACY'),
  'availability',coalesce(r.availability,'UNKNOWN'),'verification',case when r.id is null then 'LEGACY' else 'VERIFIED' end,
  'eligibility',p.capacity and commercial_billing.roster_can_issue(p.sport,p.player_id) and coalesce((select issuance_enabled from commercial_billing.control where id),false),
  'eligibilityReason',case when r.id is not null and r.registration<>'ACTIVE' then 'Excluded: '||lower(replace(r.registration,'_',' '))
   when p.definitions=0 then 'No permanent definitions registered'
   when p.approved=0 then 'Permanent definitions are not approved'
   when not p.capacity then 'Approved lifetime supply exhausted'
   when not coalesce((select issuance_enabled from commercial_billing.control where id),false) then 'Pack issuance is paused'
   when r.id is null then 'Existing approved pool; current roster unreviewed'
   else 'Reviewed active registration and approved remaining supply' end,
  'observedAt',r.observed_at,'effectiveAt',r.effective_at,'reviewedAt',r.recorded_at,
  'evidenceUrl',r.source_url,'evidenceHash',r.source_hash,'revision',r.id,
  'existingCards',(select count(*) from commercial_billing.cards c join commercial_billing.definitions d on d.id=c.definition where d.sport=p.sport and d.player_id=p.player_id),
  'definitionCount',p.definitions,'approvedDefinitions',p.approved,'lifetimeIssued',p.issued,'supply',p.supply,
  'aliases',(select coalesce(jsonb_agg(jsonb_build_object('provider',a.provider,'providerId',a.provider_id) order by a.provider,a.provider_id),'[]') from(
   select distinct snapshot->>'provider' provider,snapshot->>'providerId' provider_id from commercial_billing.definitions where sport=p.sport and player_id=p.player_id and snapshot->>'provider' is not null
   union select provider,provider_player_id from sports_feed.player_aliases where sport=p.sport and player_id=p.player_id::text
  )a)
 ) from players p left join commercial_billing.current_player_roster r on r.sport=p.sport and r.player_id=p.player_id;
end$$;

create function commercial_billing.activate_roster_candidate(expected_actor uuid,p jsonb)
returns commercial_billing.roster_activation_events language plpgsql security definer set search_path='' as $$
declare answer commercial_billing.roster_activation_events;target uuid;s text;c commercial_billing.control;r commercial_billing.player_roster_events;begin
 perform commercial_billing.pack_award_actor(expected_actor);
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'Roster mutation requires READ COMMITTED isolation';end if;
 if jsonb_typeof(p) is distinct from 'object' or p->>'request' is null or p->>'sport' not in('nfl','afl','nrl')
  or p->'confirmed' is distinct from 'true'::jsonb or coalesce(length(btrim(p->>'reference')),0) not between 3 and 200
  or coalesce(length(btrim(p->>'rightsReference')),0) not between 8 and 1000
  then raise exception 'Exact reviewed activation required';end if;
 select * into strict c from commercial_billing.lock_control();perform pg_advisory_xact_lock(76122026);
 select * into answer from commercial_billing.roster_activation_events where actor=expected_actor and request=(p->>'request')::uuid;
 if found then if answer.command<>p then raise exception 'Roster activation request conflict';end if;return answer;end if;
 target:=(p->>'playerId')::uuid;s:=p->>'sport';
 select * into r from commercial_billing.current_player_roster where sport=s and player_id=target;
 if p->'confirmed' is distinct from 'true'::jsonb or target is null or r.id is null or r.id is distinct from (p->>'expectedRevision')::uuid
  or r.registration<>'ACTIVE' or p->>'rightsReference' is distinct from c.approvals->>'playerRights'
  or coalesce(length(p->>'rightsReference'),0)<8 or coalesce((c.approvals->>'validUntil')::timestamptz,'-infinity')<=clock_timestamp()
  or coalesce(length(btrim(p->>'reference')),0) not between 3 and 200
  then raise exception 'Current active registration and exact existing player-rights approval required';end if;
 if exists(select 1 from commercial_billing.roster_activation_events where sport=s and player_id=target)
  then raise exception 'Previously activated definitions cannot be reapproved by roster updates';end if;
 if(select count(*) from commercial_billing.roster_definition_registrations where sport=s and player_id=target)<>5
  or exists(select 1 from commercial_billing.definitions d where d.sport=s and d.player_id=target and
   (d.approved or d.issued<>0 or d.legacy_issued<>0 or not exists(select 1 from commercial_billing.roster_definition_registrations x where x.definition=d.id)))
  then raise exception 'Only five newly registered dormant definitions may be activated';end if;
 perform 1 from commercial_billing.definitions where sport=s and player_id=target order by id for update;
 update commercial_billing.definitions set approved=true where sport=s and player_id=target;
 insert into commercial_billing.roster_activation_events(actor,request,player_id,sport,revision,command,rights_reference)
  values(expected_actor,(p->>'request')::uuid,target,s,r.id,p,p->>'rightsReference') returning * into answer;
 return answer;
end$$;

revoke all on function commercial_billing.roster_can_issue(text,uuid),commercial_billing.lock_roster_issuance(),
 commercial_billing.guard_roster_issuance(),commercial_billing.official_roster_source(text,text),
 commercial_billing.apply_roster_batch(uuid,jsonb,text,jsonb),commercial_billing.owner_roster_rows(uuid),
 commercial_billing.activate_roster_candidate(uuid,jsonb)
 from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_commercial_app;
grant execute on function commercial_billing.roster_can_issue(text,uuid),commercial_billing.lock_roster_issuance(),
 commercial_billing.apply_roster_batch(uuid,jsonb,text,jsonb),commercial_billing.owner_roster_rows(uuid),
 commercial_billing.activate_roster_candidate(uuid,jsonb) to docked_commercial_app;
