-- Prepared for review only. No programme is enabled and no account is enrolled.
-- Classify historical posts only from existing metadata or unambiguous card evidence.
create table private.social_sport_review(
 post_id uuid primary key references private.social_posts(id),
 reason text not null, observed_at timestamptz not null default clock_timestamp()
);
alter table private.social_sport_review enable row level security;
revoke all on private.social_sport_review from public,anon,authenticated,service_role,docked_app,docked_beta_app;
insert into private.social_sport_review(post_id,reason)
select p.id,'Missing or conflicting sport evidence' from private.social_posts p
where p.kind not in ('official_tip','community_edge') and (
 (p.sport is null and (select count(distinct c->>'sport') from jsonb_array_elements(coalesce(p.card_snapshots,'[]')) c where c->>'sport' in ('nfl','afl','nrl','basketball'))<>1)
 or exists(select 1 from jsonb_array_elements(coalesce(p.card_snapshots,'[]')) c where c->>'sport' is null or c->>'sport' not in ('nfl','afl','nrl','basketball') or (p.sport is not null and c->>'sport'<>p.sport))
);
update private.social_posts p set sport=(select min(c->>'sport') from jsonb_array_elements(p.card_snapshots)c)
where p.sport is null and p.kind not in ('official_tip','community_edge')
 and not exists(select 1 from private.social_sport_review r where r.post_id=p.id)
 and jsonb_array_length(coalesce(p.card_snapshots,'[]'))>0;
create index social_sport_chronological on private.social_posts(sport,created_at desc,id desc);
create function private.require_post_sport() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='UPDATE' and (new.sport is distinct from old.sport or new.card_snapshots is distinct from old.card_snapshots) then raise exception 'Post sport and card snapshot are immutable';end if;
 if new.kind not in ('official_tip','community_edge') and (new.sport is null or new.sport not in ('nfl','afl','nrl','basketball')) then
  raise exception 'Choose NFL, AFL or NRL for this post';
 end if;
 if exists(select 1 from jsonb_array_elements(coalesce(new.card_snapshots,'[]')) c where c->>'sport' is distinct from new.sport) then
  raise exception 'Attached cards must match the post sport';
 end if;
 return new;
end$$;
create trigger require_post_sport before insert or update of sport,card_snapshots on private.social_posts for each row execute function private.require_post_sport();
revoke all on function private.require_post_sport() from public,anon,authenticated,service_role,docked_app,docked_beta_app;

create table beta_private.social_sport_review(
 post_id uuid primary key references beta_private.social_posts(id),
 reason text not null, observed_at timestamptz not null default clock_timestamp()
);
alter table beta_private.social_sport_review enable row level security;
revoke all on beta_private.social_sport_review from public,anon,authenticated,service_role,docked_app,docked_beta_app;
insert into beta_private.social_sport_review(post_id,reason)
select p.id,'Missing or conflicting sport evidence' from beta_private.social_posts p
where p.kind not in ('official_tip','community_edge') and (
 (p.sport is null and (select count(distinct c->>'sport') from jsonb_array_elements(coalesce(p.card_snapshots,'[]')) c where c->>'sport' in ('nfl','afl','nrl','basketball'))<>1)
 or exists(select 1 from jsonb_array_elements(coalesce(p.card_snapshots,'[]')) c where c->>'sport' is null or c->>'sport' not in ('nfl','afl','nrl','basketball') or (p.sport is not null and c->>'sport'<>p.sport))
);
update beta_private.social_posts p set sport=(select min(c->>'sport') from jsonb_array_elements(p.card_snapshots)c)
where p.sport is null and p.kind not in ('official_tip','community_edge')
 and not exists(select 1 from beta_private.social_sport_review r where r.post_id=p.id)
 and jsonb_array_length(coalesce(p.card_snapshots,'[]'))>0;
create index social_sport_chronological on beta_private.social_posts(sport,created_at desc,id desc);
create function beta_private.require_post_sport() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='UPDATE' and (new.sport is distinct from old.sport or new.card_snapshots is distinct from old.card_snapshots) then raise exception 'Post sport and card snapshot are immutable';end if;
 if new.kind not in ('official_tip','community_edge') and (new.sport is null or new.sport not in ('nfl','afl','nrl','basketball')) then
  raise exception 'Choose NFL, AFL or NRL for this post';
 end if;
 if exists(select 1 from jsonb_array_elements(coalesce(new.card_snapshots,'[]')) c where c->>'sport' is distinct from new.sport) then
  raise exception 'Attached cards must match the post sport';
 end if;
 return new;
end$$;
create trigger require_post_sport before insert or update of sport,card_snapshots on beta_private.social_posts for each row execute function beta_private.require_post_sport();
revoke all on function beta_private.require_post_sport() from public,anon,authenticated,service_role,docked_app,docked_beta_app;

-- Extend the existing entitlement tables. NFL rows keep their IDs, anchors and receipts.
alter table sports_feed.weekly_core_packs drop constraint weekly_core_packs_user_id_fkey;
alter table sports_feed.weekly_core_schedules add column sport text not null default 'nfl' check(sport in ('nfl','afl','nrl'));
alter table sports_feed.weekly_core_schedules drop constraint weekly_core_schedules_pkey;
alter table sports_feed.weekly_core_schedules add primary key(user_id,sport);
alter table sports_feed.weekly_core_schedules drop constraint weekly_core_schedules_policy_check;
alter table sports_feed.weekly_core_schedules add check(policy='weekly-core-'||sport||'-v1');
alter table sports_feed.weekly_core_packs drop constraint weekly_core_packs_sport_check;
alter table sports_feed.weekly_core_packs add check(sport in ('nfl','afl','nrl'));
alter table sports_feed.weekly_core_packs drop constraint weekly_core_packs_policy_check;
alter table sports_feed.weekly_core_packs add check(policy='weekly-core-'||sport||'-v1');
alter table sports_feed.weekly_core_packs drop constraint weekly_core_packs_user_id_period_key;
alter table sports_feed.weekly_core_packs add unique(user_id,sport,period);
alter table sports_feed.weekly_core_packs add foreign key(user_id,sport) references sports_feed.weekly_core_schedules(user_id,sport);
create table sports_feed.weekly_sport_programmes(
 sport text primary key check(sport in ('afl','nrl')), enabled boolean not null default false,
 enabled_at timestamptz, authority_note text,
 check(not enabled or (enabled_at is not null and length(authority_note)>10))
);
insert into sports_feed.weekly_sport_programmes(sport) values('afl'),('nrl');
alter table sports_feed.weekly_sport_programmes enable row level security;
revoke all on sports_feed.weekly_sport_programmes from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_nfl_worker;
-- Preserve old NFL entry points and their policy, including the legacy cutover.
-- Explicit NFL filters prevent new sport schedules affecting those old callers.
do $$declare b text;f text;begin
 foreach f in array array['sports_feed.weekly_core_reconcile(uuid)','sports_feed.my_weekly_core()','sports_feed.weekly_core_job()'] loop
  b:=pg_get_functiondef(f::regprocedure);
  b:=replace(b,'on conflict(user_id,period)','on conflict(user_id,sport,period)');
  b:=replace(b,'where user_id=u','where user_id=u and sport=''nfl''');
  b:=replace(b,'where p.user_id=u','where p.user_id=u and p.sport=''nfl''');
  b:=replace(b,'weekly_core_schedules s using(user_id)','weekly_core_schedules s on s.user_id=a.user_id and s.sport=''nfl''');
  execute b;
 end loop;
 b:=pg_get_functiondef('sports_feed.open_weekly_core(uuid,uuid)'::regprocedure);
 b:=replace(b,'where q.id=pack_id and q.user_id=u','where q.id=pack_id and q.user_id=u and q.sport=''nfl''');
 execute b;
end$$;

create function sports_feed.weekly_core_allowed(u uuid,s text) returns boolean language sql stable security definer set search_path='' as $$
 select case when s='nfl' then sports_feed.weekly_core_allowed(u) else
 s in ('afl','nrl') and exists(select 1 from sports_feed.weekly_sport_programmes where sport=s and enabled)
 and beta_private.admitted(u)
 and exists(select 1 from credits_sandbox.access where user_id=u and enabled)
 and exists(select 1 from sports_feed.sport_sandbox_access where user_id=u)
 and exists(select 1 from sports_feed.private_beta_sports where sport=s and enabled)
 and exists(select 1 from sports_feed.nba_beta_control where enabled)
 and exists(select 1 from sports_feed.nba_beta_access where user_id=u and enabled and expires_at>clock_timestamp())
 and exists(select 1 from beta_public.profiles where id=u and disabled_at is null)
 and not exists(select 1 from beta_fantasy.members where user_id=u and (revoked_at is not null or expires_at<=clock_timestamp())) end
$$;
create function sports_feed.weekly_core_reconcile(u uuid,s text) returns integer language plpgsql security definer set search_path='' as $$
declare schedule sports_feed.weekly_core_schedules;now_at timestamptz:=clock_timestamp();last_period int;n int;begin
 if s='nfl' then return sports_feed.weekly_core_reconcile(u);end if;
 perform pg_advisory_xact_lock(71820342);
 if not sports_feed.weekly_core_allowed(u,s) then return 0;end if;
 -- First eligibility processing anchors the programme. No backdated rewards.
 insert into sports_feed.weekly_core_schedules(user_id,sport,policy,enrolled_at)
 values(u,s,'weekly-core-'||s||'-v1',now_at) on conflict do nothing;
 select * into strict schedule from sports_feed.weekly_core_schedules where user_id=u and sport=s for update;
 last_period:=least(floor(extract(epoch from(now_at-schedule.enrolled_at))/604800)::int,schedule.next_period+499);
 insert into sports_feed.weekly_core_packs(user_id,sport,policy,period,due_at,issued_at)
 select u,s,schedule.policy,i,schedule.enrolled_at+i*interval '604800 seconds',now_at from generate_series(schedule.next_period,last_period)i
 on conflict(user_id,sport,period) do nothing;
 get diagnostics n=row_count;
 if last_period>=schedule.next_period then update sports_feed.weekly_core_schedules set next_period=last_period+1 where user_id=u and sport=s;end if;
 return n;
end$$;
create function sports_feed.my_weekly_core(s text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;schedule sports_feed.weekly_core_schedules;begin
 if s='nfl' then return sports_feed.my_weekly_core()||jsonb_build_object('sport','nfl');end if;
 u:=beta_fantasy.production_eligible();
 if s not in ('afl','nrl') or u is null or not beta_private.active_member_session() or sports_feed.private_beta_sport() is distinct from s or sports_feed.private_beta_sport_identity() is distinct from u then raise exception 'Active sport session required';end if;
 if not sports_feed.weekly_core_allowed(u,s) then return jsonb_build_object('sport',s,'enabled',false,'serverTime',extract(epoch from clock_timestamp())*1000,'packs','[]'::jsonb);end if;
 perform sports_feed.weekly_core_reconcile(u,s);
 select * into strict schedule from sports_feed.weekly_core_schedules where user_id=u and sport=s;
 return jsonb_build_object('sport',s,'enabled',true,'member',u,'policy',schedule.policy,'enrolledAt',schedule.enrolled_at,'serverTime',extract(epoch from clock_timestamp())*1000,
 'nextIssueAt',schedule.enrolled_at+schedule.next_period*interval '604800 seconds',
 'packs',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'issuedAt',p.issued_at,'dueAt',p.due_at,'openedAt',p.opened_at,'receipt',p.receipt)order by p.due_at desc,p.id)from sports_feed.weekly_core_packs p where p.user_id=u and p.sport=s),'[]'));
end$$;

-- Non-permanent, non-transferable Core rewards are owned by the immutable pack
-- receipt's account, not inferred from catalogue/selection eligibility. No wallet
-- or limited-supply registry is involved; no issued limited serial is consumed.
create function sports_feed.weekly_core_inventory(u uuid,s text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(c||jsonb_build_object('owner_id',u,'acquired_at',p.opened_at,'created_at',p.opened_at)),'[]')
 from sports_feed.weekly_core_packs p cross join lateral jsonb_array_elements(p.receipt->'cards') c
 where p.user_id=u and p.sport=s and s in ('afl','nrl') and p.opened_at is not null
$$;
create function sports_feed.open_weekly_core(pack_id uuid,request_id uuid,s text) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;p sports_feed.weekly_core_packs;prior beta_fantasy.requests;item jsonb;cards jsonb:='[]';answer jsonb;payload jsonb;cid uuid;now_at timestamptz:=clock_timestamp();begin
 if s='nfl' then return sports_feed.open_weekly_core(pack_id,request_id);end if;
 perform pg_advisory_xact_lock(71820342);
 u:=beta_fantasy.production_eligible();
 if u is null or not beta_private.active_member_session() or sports_feed.private_beta_sport() is distinct from s or sports_feed.private_beta_sport_identity() is distinct from u or not sports_feed.weekly_core_allowed(u,s) then raise exception 'Weekly sport access unavailable';end if;
 if pack_id is null or request_id is null then raise exception 'Pack and request required';end if;
 payload:=jsonb_build_object('pack_id',pack_id,'sport',s);
 select * into prior from beta_fantasy.requests q where q.user_id=u and q.request_id=open_weekly_core.request_id;
 if found then if prior.action<>'open_weekly_sport_core' or prior.payload<>payload then raise exception 'Request ID reused';end if;return prior.result;end if;
 select * into p from sports_feed.weekly_core_packs q where q.id=pack_id and q.user_id=u and q.sport=s for update;
 if not found then raise exception 'Pack unavailable';end if;
 if p.receipt is not null then answer:=p.receipt;else
  for item in select identity from credits_sandbox.nba_fixture_players where identity->>'sport'=s and identity->>'status'='active'
   and credits_sandbox.is_roster_beta_player(identity) order by gen_random_uuid() limit 4 loop
   cid:=gen_random_uuid();
   cards:=cards||jsonb_build_array(jsonb_build_object('id',cid,'card_id',cid,'owner_id',u,'player_id',item->>'fixturePlayerId','canonical_player_id',item->>'fixturePlayerId',
    'name',item->>'name','team',item->>'currentTeam','sport',s,'position',item->>'position','eligible_positions',coalesce(item->'eligiblePositions',jsonb_build_array(item->>'position')),
    'tier','CORE','serial',0,'max_supply',0,'multiplier',1,'multiplierTenths',10,'season','REAL PLAYER · BETA INVENTORY','status','active','listed',false,'tradeable',false,
    'kind','regular','colour','#1677FF','shirt',1,'verifiedJerseyNumber',item->'verifiedJerseyNumber','inventory_class','real-roster-beta-v1','inventory_source','weekly-core-beta-v1','roster_source',item->'rosterBeta'));
  end loop;
  if jsonb_array_length(cards)<>4 then raise exception 'Four verified Core players are not available. Your pack is still unopened.';end if;
  answer:=jsonb_build_object('id',p.id,'name','Weekly '||upper(s)||' Starter Pack','opened_at',now_at,'cards',cards);
  update sports_feed.weekly_core_packs set opened_at=now_at,receipt=answer where id=p.id;
 end if;
 insert into beta_fantasy.requests values(u,request_id,'open_weekly_sport_core',payload,answer);
 return answer;
end$$;
-- Keep the existing worker route and audited NFL run. Each new sport/account
-- failure is isolated and recorded; a retry resumes the same immutable anchor.
alter function sports_feed.weekly_core_job() rename to weekly_core_nfl_job;
alter table sports_feed.weekly_core_job_failures add column sport text not null default 'nfl' check(sport in ('nfl','afl','nrl'));
alter table sports_feed.weekly_core_job_failures drop constraint weekly_core_job_failures_pkey;
alter table sports_feed.weekly_core_job_failures add primary key(run_id,user_id,sport);
create function sports_feed.weekly_core_job() returns integer language plpgsql security definer set search_path='' as $$
declare r record;n int;run uuid;additional int:=0;failure_count int:=0;begin
 n:=sports_feed.weekly_core_nfl_job();
 if not exists(select 1 from sports_feed.weekly_sport_programmes where enabled) then return n;end if;
 insert into sports_feed.weekly_core_job_runs(status) values('running') returning id into run;
 for r in select a.user_id,p.sport from credits_sandbox.access a cross join sports_feed.weekly_sport_programmes p
 left join sports_feed.weekly_core_schedules s on s.user_id=a.user_id and s.sport=p.sport
 where p.enabled and sports_feed.weekly_core_allowed(a.user_id,p.sport) and (s.user_id is null or s.enrolled_at+s.next_period*interval '604800 seconds'<=clock_timestamp())
 order by s.enrolled_at+s.next_period*interval '604800 seconds' nulls first,a.user_id,p.sport limit 100 loop
  begin additional:=additional+sports_feed.weekly_core_reconcile(r.user_id,r.sport);
  exception when others then failure_count:=failure_count+1;insert into sports_feed.weekly_core_job_failures(run_id,user_id,sport,sqlstate) values(run,r.user_id,r.sport,sqlstate);end;
 end loop;
 update sports_feed.weekly_core_job_runs set finished_at=clock_timestamp(),issued=additional,failures=failure_count,status=case when failure_count>0 then 'partial' else 'complete' end where id=run;
 return n+additional;
end$$;
revoke all on function sports_feed.weekly_core_nfl_job(),sports_feed.weekly_core_job(),sports_feed.weekly_core_allowed(uuid,text),sports_feed.weekly_core_reconcile(uuid,text),sports_feed.my_weekly_core(text),sports_feed.open_weekly_core(uuid,uuid,text),sports_feed.weekly_core_inventory(uuid,text) from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_nfl_worker;
grant execute on function sports_feed.weekly_core_job() to docked_nfl_worker;
grant execute on function sports_feed.my_weekly_core(text),sports_feed.open_weekly_core(uuid,uuid,text) to docked_beta_app;
do $$declare b text;needle text;begin
 b:=pg_get_functiondef('sports_feed.owned_sport_inventory(uuid,text)'::regprocedure);
 b:=replace(b,'select coalesce(jsonb_agg(card),''[]'')','select coalesce(jsonb_agg(card),''[]'') || sports_feed.weekly_core_inventory(u,sport_id)');execute b;
 b:=pg_get_functiondef('beta_fantasy.owned_collection_page(jsonb)'::regprocedure);
 needle:='owned as materialized(select * from beta_rows union all select * from legacy_rows)';
 if position(needle in b)=0 then raise exception 'Unexpected collection projection';end if;
 b:=replace(b,needle,'weekly_rows as (select c->>''id'' id,c->>''name'' name,c->>''team'' team,c->>''position'' position,''CORE'' tier,0::bigint serial,extract(epoch from(c->>''acquired_at'')::timestamptz)*1000 acquired,jsonb_build_object(''id'',c->>''id'',''inventory'',''beta'',''card'',c) payload from jsonb_array_elements(sports_feed.weekly_core_inventory(u,sport_id))c), owned as materialized(select * from beta_rows union all select * from legacy_rows union all select * from weekly_rows)');execute b;
end$$;

-- Apply the existing per-card visibility policy to starter Core sharing too.
do $$declare b text;needle text;begin
 b:=pg_get_functiondef('beta_private.social_legacy_cards(uuid)'::regprocedure);
 needle:='beta_private.social_legacy_cards_before_card_privacy(target)';
 if position(needle in b)=0 then raise exception 'Unexpected social inventory projection';end if;
 b:=replace(b,needle,needle||' || (select coalesce(jsonb_agg(c-''owner_id''),''[]'') from jsonb_array_elements(sports_feed.weekly_core_inventory(target,''afl'')||sports_feed.weekly_core_inventory(target,''nrl''))c)');execute b;
end$$;

-- Publish only schedule fields for competitions already authorised by the existing
-- state function. Player lists and raw provider payloads remain server-side.
alter function sports_feed.sport_sandbox_state(text) rename to sport_sandbox_state_before_parity;
create function sports_feed.sport_sandbox_state(sport_id text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;fixtures jsonb;begin
 result:=sports_feed.sport_sandbox_state_before_parity(sport_id);
 select coalesce(jsonb_object_agg(r.competition_id,(select coalesce(jsonb_agg(jsonb_build_object('scheduledAt',f->>'scheduledAt','status',f->>'status')),'[]') from jsonb_array_elements(r.fixtures)f)),'{}') into fixtures
 from sports_feed.sport_rounds r where r.sport=sport_id and r.competition_id in (select (c->>'id')::uuid from jsonb_array_elements(result->'competitions')c);
 return result||jsonb_build_object('fixtures',fixtures);
end$$;
revoke all on function sports_feed.sport_sandbox_state_before_parity(text),sports_feed.sport_sandbox_state(text) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function sports_feed.sport_sandbox_state(text) to docked_beta_app;
