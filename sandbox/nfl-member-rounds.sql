-- Additive NFL free-beta bridge. Commercial schemas and historical cards untouched.
insert into beta_fantasy.sports(id,positions,team_size) values('nfl','{"QB":1,"RB":2,"WR":2,"TE":1,"FLEX":1}',7) on conflict do nothing;
create table sports_feed.nfl_control(id boolean primary key default true check(id), enabled boolean not null default false);
insert into sports_feed.nfl_control values(true,false);
create table sports_feed.nfl_players(
 player_id uuid primary key references beta_fantasy.players, provider_id text unique not null,
 edition_id uuid unique not null references beta_fantasy.editions,
 current_team text not null, source_status text not null, roster_raw_id bigint not null references sports_feed.raw_revisions,
 observed_at timestamptz not null, edition_team text not null
);
create table sports_feed.nfl_allocations(
 user_id uuid primary key references beta_fantasy.members, card_ids uuid[] not null,
 preserved_card_ids uuid[] not null, roster_raw_id bigint not null references sports_feed.raw_revisions,
 reason text not null, created_at timestamptz not null default clock_timestamp()
);
create table sports_feed.nfl_rounds(
 competition_id uuid primary key references beta_fantasy.competitions,
 stream_id text unique not null references sports_feed.streams,
 purpose text not null check(purpose in('member','acceptance')),
 fixtures jsonb not null, locked_snapshot jsonb, locked_at timestamptz,
 last_checked timestamptz, next_check timestamptz not null default clock_timestamp(),
 issues jsonb not null default '[]', lease_until timestamptz,
 check((locked_at is null)=(locked_snapshot is null))
);
create table sports_feed.nfl_worker_runs(
 id bigint generated always as identity primary key, started_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz, status text not null default 'running', detail jsonb not null default '{}'
);
do $$ declare t text;begin
 foreach t in array array['nfl_control','nfl_players','nfl_allocations','nfl_rounds','nfl_worker_runs'] loop
 execute format('alter table sports_feed.%I enable row level security',t);
 execute format('revoke all on sports_feed.%I from public,anon,authenticated,docked_beta_app',t);
 end loop;end$$;
create trigger immutable before update or delete on sports_feed.nfl_allocations for each row execute function beta_fantasy.immutable();
create function sports_feed.nfl_lock_due() returns integer language plpgsql security definer set search_path='' as $$
declare r record; n integer:=0;begin
 -- Same lock order as all card transfers and member lineup writes.
 perform pg_advisory_xact_lock(71820342);
 for r in select nr.competition_id from sports_feed.nfl_rounds nr join beta_fantasy.competitions c on c.id=nr.competition_id
 where nr.locked_at is null and c.locks_at<=clock_timestamp() order by c.locks_at for update of nr loop
 update sports_feed.nfl_rounds set locked_snapshot=coalesce((select jsonb_agg(to_jsonb(e) order by e.user_id) from beta_fantasy.entries e where e.competition_id=r.competition_id),'[]'),locked_at=clock_timestamp() where competition_id=r.competition_id;
 n:=n+1;
 end loop;return n;end$$;
create function sports_feed.nfl_allocate(u uuid) returns jsonb language plpgsql set search_path='' as $$
declare existing sports_feed.nfl_allocations; item record; chosen uuid[]:='{}'; granted uuid[]:='{}'; preserved uuid[]; raw bigint; ref uuid:=gen_random_uuid(); pos text; needed integer;begin
 perform pg_advisory_xact_lock(71820342);
 select * into existing from sports_feed.nfl_allocations where user_id=u;
 if found then return jsonb_build_object('card_ids',existing.card_ids,'already_claimed',true);end if;
 insert into beta_fantasy.members(user_id,expires_at) values(u,'infinity') on conflict do nothing;
 select coalesce(array_agg(id),'{}') into preserved from beta_fantasy.cards where owner_id=u;
 -- Equal free starter entitlement. No paid-tier advantage or production supply.
 foreach pos in array array['QB','RB','WR','TE'] loop
 needed:=case when pos in('RB','WR') then 3 else 2 end;
 for item in select np.*,p.position from sports_feed.nfl_players np join beta_fantasy.players p on p.id=np.player_id
 join beta_fantasy.editions e on e.id=np.edition_id
 where p.position=pos and np.source_status='ACT' and np.observed_at>clock_timestamp()-interval '72 hours'
 and exists(select 1 from sports_feed.nfl_rounds nr join beta_fantasy.competitions co on co.id=nr.competition_id,jsonb_array_elements(nr.fixtures) f where nr.purpose='member' and co.locks_at>clock_timestamp() and f->'playerIds' ? p.id::text)
 and e.issued<e.max_supply order by np.provider_id limit needed loop
 chosen:=array_append(chosen,item.edition_id);raw:=item.roster_raw_id;
 end loop;
 if cardinality(chosen)<>(case pos when 'QB' then 2 when 'RB' then 5 when 'WR' then 8 else 10 end) then raise exception 'Fresh complete NFL starter inventory unavailable';end if;
 end loop;
 foreach ref in array chosen loop
 granted:=array_append(granted,beta_fantasy.mint(ref,u,true,'free-beta-real-nfl-allocation',u));
 end loop;
 insert into sports_feed.nfl_allocations values(u,granted,preserved,raw,'Separate current-player free-beta entitlement; original fictional cards and history preserved',clock_timestamp());
 return jsonb_build_object('card_ids',granted,'already_claimed',false);
end$$;
alter function beta_fantasy.production_command(text,jsonb,uuid) rename to production_command_before_nfl;
revoke all on function beta_fantasy.production_command_before_nfl(text,jsonb,uuid) from public,anon,authenticated,docked_beta_app;
create function beta_fantasy.production_command(action text,p jsonb,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid; prior beta_fantasy.requests; answer jsonb; c beta_fantasy.competitions; ids uuid[]; snap jsonb; counts jsonb;begin
 if not exists(select 1 from sports_feed.nfl_control where enabled) then return beta_fantasy.production_command_before_nfl(action,p,request_id);end if;
 perform pg_advisory_xact_lock(71820342);
 u:=beta_fantasy.production_eligible();
 if not beta_private.active_member_session() then raise exception 'Active session required';end if;
 if request_id is null or p is null or jsonb_typeof(p)<>'object' then raise exception 'Request required';end if;
 select * into prior from beta_fantasy.requests q where q.user_id=u and q.request_id=production_command.request_id;
 if found then if prior.action<>action or prior.payload<>p then raise exception 'Request ID reused';end if;return prior.result;end if;
 if action='claim_starter' then
 if p<>'{}' then raise exception 'Empty starter payload required';end if;
 answer:=sports_feed.nfl_allocate(u);
 elsif action='save_lineup' and exists(select 1 from sports_feed.nfl_rounds where competition_id=(p->>'competition_id')::uuid and purpose='member') then
 select * into strict c from beta_fantasy.competitions where id=(p->>'competition_id')::uuid;
 if c.locks_at<=clock_timestamp() or c.opens_at>clock_timestamp() then raise exception 'Lineup locked';end if;
 if (select count(*) from jsonb_object_keys(p))<>2 or jsonb_typeof(p->'cards')<>'array' then raise exception 'Exact lineup payload required';end if;
 select array_agg(value::uuid) into ids from jsonb_array_elements_text(p->'cards');
 if cardinality(ids)<>7 or (select count(distinct x) from unnest(ids)x)<>7 then raise exception 'Seven distinct owned cards required';end if;
 select jsonb_agg(jsonb_build_object('card_id',a.id,'player_id',e.player_id,'tier',e.tier,'position',pl.position,'season',e.season,'kind',e.kind,'provider_id',np.provider_id,'name',pl.name,'team',np.current_team) order by a.id),
 jsonb_build_object('QB',count(*) filter(where pl.position='QB'),'RB',count(*) filter(where pl.position='RB'),'WR',count(*) filter(where pl.position='WR'),'TE',count(*) filter(where pl.position='TE'),'unique',count(distinct pl.id)) into snap,counts
 from beta_fantasy.cards a join beta_fantasy.editions e on e.id=a.edition_id join beta_fantasy.players pl on pl.id=e.player_id join sports_feed.nfl_players np on np.player_id=pl.id
 where a.id=any(ids) and a.owner_id=u and pl.sport='nfl' and np.source_status='ACT' and np.observed_at>clock_timestamp()-interval '72 hours'
 and exists(select 1 from sports_feed.nfl_rounds nr,jsonb_array_elements(nr.fixtures) f where nr.competition_id=c.id and f->'playerIds' ? pl.id::text)
 and not exists(select 1 from beta_fantasy.listings where card_id=a.id and state='active');
 if coalesce(jsonb_array_length(snap),0)<>7 or (counts->>'unique')::int<>7 or (counts->>'QB')::int<>1 or (counts->>'RB')::int<2 or (counts->>'WR')::int<2 or (counts->>'TE')::int<1 then raise exception 'NFL requires QB, 2 RB, 2 WR, TE and RB/WR/TE FLEX; owned eligible mapped players only';end if;
 insert into beta_fantasy.entries(competition_id,user_id,cards,snapshot) values(c.id,u,ids,snap) on conflict(competition_id,user_id) do update set cards=excluded.cards,snapshot=excluded.snapshot,updated_at=clock_timestamp();
 insert into sports_feed.stream_members(stream_id,user_id) select stream_id,u from sports_feed.nfl_rounds where competition_id=c.id on conflict do nothing;
 answer:=jsonb_build_object('saved',true,'competition_id',c.id);
 elsif action in('admin_stats','admin_simulate') and exists(select 1 from sports_feed.nfl_rounds where competition_id=(p->>'competition_id')::uuid) then raise exception 'NFL results require authorised source reconciliation';
 elsif action='claim_daily' then raise exception 'Daily card rewards unavailable in the free NFL beta';
 else return beta_fantasy.production_command_before_nfl(action,p,request_id);
 end if;
 insert into beta_fantasy.requests values(u,request_id,action,p,answer);return answer;
end$$;
revoke all on function sports_feed.nfl_allocate(uuid),sports_feed.nfl_lock_due(),beta_fantasy.production_command(text,jsonb,uuid) from public,anon,authenticated,docked_beta_app;
grant execute on function beta_fantasy.production_command(text,jsonb,uuid) to docked_beta_app;

create function sports_feed.nfl_round_guard() returns trigger language plpgsql set search_path='' as $$begin
 if (to_jsonb(new)-array['locked_snapshot','locked_at','last_checked','next_check','issues','lease_until']) is distinct from (to_jsonb(old)-array['locked_snapshot','locked_at','last_checked','next_check','issues','lease_until']) or
 (old.locked_at is not null and (new.locked_at is distinct from old.locked_at or new.locked_snapshot is distinct from old.locked_snapshot)) then raise exception 'Round identity and locked lineup evidence immutable';end if;return new;end$$;
create trigger guard before update on sports_feed.nfl_rounds for each row execute function sports_feed.nfl_round_guard();
create trigger no_delete before delete on sports_feed.nfl_rounds for each row execute function beta_fantasy.immutable();

alter function beta_fantasy.production_read_state() rename to production_read_state_before_nfl;
revoke all on function beta_fantasy.production_read_state_before_nfl() from public,anon,authenticated,docked_beta_app;
create function beta_fantasy.production_read_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare state jsonb; u uuid; comps jsonb; summaries jsonb; details jsonb;begin
 state:=beta_fantasy.production_read_state_before_nfl();if not exists(select 1 from sports_feed.nfl_control where enabled) then return state;end if;u:=(state->>'user_id')::uuid;
 select coalesce(jsonb_agg(to_jsonb(c)-'prize' order by c.locks_at),'[]') into comps from beta_fantasy.competitions c join sports_feed.nfl_rounds n on n.competition_id=c.id where n.purpose='member';
 select coalesce(jsonb_agg(jsonb_build_object('competition_id',n.competition_id,'user_id',u,'score',(r->>'centipoints')::numeric/100,'rank',r->'rank','championship_points',0,'status',r->>'status')),'[]') into summaries
 from sports_feed.nfl_rounds n join lateral(select calculated from sports_feed.journal where stream_id=n.stream_id order by revision desc limit 1)j on true,
 jsonb_array_elements(j.calculated->'rows')r where n.purpose='member' and r->>'member'=u::text and r->>'centipoints' is not null;
 select coalesce(jsonb_agg(jsonb_build_object('competition_id',n.competition_id,'cards',coalesce(d->'cards','[]'),'scores',
 coalesce((select jsonb_agg(jsonb_build_object('player_id',p->>'playerId','score',(p->>'centipoints')::numeric/100,'stats','{}'::jsonb,'scoring_version',j.calculated->>'rulesVersion','rules','{}'::jsonb,'matches',p->'matches')) from jsonb_array_elements(r->'players')p),'[]'))),'[]') into details
 from sports_feed.nfl_rounds n join lateral(select calculated from sports_feed.journal where stream_id=n.stream_id order by revision desc limit 1)j on true,
 jsonb_array_elements(j.calculated->'rows')r left join lateral(select value d from jsonb_array_elements(state->'round_details') where value->>'competition_id'=n.competition_id::text)orig on true
 where n.purpose='member' and r->>'member'=u::text;
 return state||jsonb_build_object('nfl_beta',true,'competitions',comps,'results',summaries,'round_details',details,
 'cards',coalesce((select jsonb_agg(c) from jsonb_array_elements(state->'cards')c where exists(select 1 from sports_feed.nfl_players p where p.player_id=(c->>'player_id')::uuid)),'[]'),
 'archived_card_count',(select count(*) from jsonb_array_elements(state->'cards')c where not exists(select 1 from sports_feed.nfl_players p where p.player_id=(c->>'player_id')::uuid)),
 'packs','[]'::jsonb,'rewards',(state->'rewards')||jsonb_build_object('starter_claimed',exists(select 1 from sports_feed.nfl_allocations where user_id=u),'daily_available',false));
end$$;
revoke all on function sports_feed.nfl_round_guard(),beta_fantasy.production_read_state() from public,anon,authenticated,docked_beta_app;
grant execute on function beta_fantasy.production_read_state() to docked_beta_app;

create function sports_feed.nfl_standings() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;begin
 u:=beta_fantasy.production_eligible();if not beta_private.active_member_session() then raise exception 'Active session required';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('competitionId',n.competition_id,'label',j.calculated->>'period','rows',(
 select coalesce(jsonb_agg(jsonb_build_object('name',case when r->>'member'=u::text then 'You' else coalesce(p.display_name,'Member') end,'points',(r->>'centipoints')::numeric/100,'rank',r->'rank','status',r->>'status') order by (r->>'rank')::int nulls last),'[]') from jsonb_array_elements(j.calculated->'rows')r left join beta_private.social_profiles p on p.user_id=(r->>'member')::uuid and p.status='active' and p.visibility='members')))
 from sports_feed.nfl_rounds n join lateral(select calculated from sports_feed.journal where stream_id=n.stream_id order by revision desc limit 1)j on true
 where n.purpose='member' and exists(select 1 from sports_feed.stream_members m where m.stream_id=n.stream_id and m.user_id=u)),'[]');
end$$;
revoke all on function sports_feed.nfl_standings() from public,anon,authenticated,docked_beta_app;
grant execute on function sports_feed.nfl_standings() to docked_beta_app;

create function sports_feed.nfl_refresh_status(rows jsonb,raw bigint,observed timestamptz) returns void language plpgsql security definer set search_path='' as $$begin
 if observed>clock_timestamp() or observed<clock_timestamp()-interval '24 hours' or not exists(select 1 from sports_feed.raw_revisions where id=raw and body->>'dataset'='rosters' and body is not null and expires_at>clock_timestamp()) then raise exception 'Fresh roster provenance required';end if;
 update sports_feed.nfl_players np set current_team=r.team,source_status=r.status,roster_raw_id=raw,observed_at=observed
 from jsonb_to_recordset(rows)r(gsis_id text,team text,status text) where np.provider_id=r.gsis_id;
 update sports_feed.nfl_players set source_status='UNCONFIRMED' where not exists(select 1 from jsonb_array_elements(rows)r where r->>'gsis_id'=provider_id);
end$$;
revoke all on function sports_feed.nfl_refresh_status(jsonb,bigint,timestamptz) from public,anon,authenticated,docked_beta_app;
do $$begin if not exists(select 1 from pg_roles where rolname='docked_nfl_worker') then create role docked_nfl_worker nologin nosuperuser nocreatedb nocreaterole noinherit;end if;end$$;
grant usage on schema sports_feed to docked_nfl_worker;
grant select on sports_feed.nfl_rounds,sports_feed.nfl_worker_runs,sports_feed.streams,sports_feed.journal,sports_feed.raw_revisions,sports_feed.postgame_cache,sports_feed.completions,sports_feed.completion_observations,sports_feed.postgame_mapping,sports_feed.bundle_evidence to docked_nfl_worker;
grant insert on sports_feed.nfl_worker_runs,sports_feed.raw_revisions,sports_feed.postgame_cache,sports_feed.completion_observations,sports_feed.completions,sports_feed.postgame_mapping,sports_feed.bundle_evidence,sports_feed.journal to docked_nfl_worker;
grant update(finished_at,status,detail) on sports_feed.nfl_worker_runs to docked_nfl_worker;
grant update(next_attempt,lease,raw_id,etag,source_modified,checked_at,error_code) on sports_feed.postgame_cache to docked_nfl_worker;
grant update(body,purged_at) on sports_feed.raw_revisions to docked_nfl_worker;
grant update(last_checked,next_check,issues,lease_until) on sports_feed.nfl_rounds to docked_nfl_worker;
grant usage on sequence sports_feed.nfl_worker_runs_id_seq,sports_feed.raw_revisions_id_seq to docked_nfl_worker;
grant execute on function sports_feed.nfl_lock_due(),sports_feed.nfl_refresh_status(jsonb,bigint,timestamptz) to docked_nfl_worker;
-- Private worker's policies never extend to anonymous, member or browser roles.
do $$declare t text;begin
 foreach t in array array['nfl_rounds','nfl_worker_runs','streams','journal','raw_revisions','postgame_cache','completions','completion_observations','postgame_mapping','bundle_evidence'] loop
 execute format('create policy nfl_worker on sports_feed.%I to docked_nfl_worker using(true) with check(true)',t);
 end loop;end$$;
