-- Additive free-reward entitlement. No enrolments, cards or wallet mutations on install.
create table sports_feed.weekly_core_control(id boolean primary key default true check(id), enabled boolean not null default false);
insert into sports_feed.weekly_core_control values(true,false);
create table sports_feed.weekly_core_schedules(
 user_id uuid primary key references auth.users,
 enrolled_at timestamptz not null default clock_timestamp(),
 next_period integer not null default 0 check(next_period>=0),
 policy text not null default 'weekly-core-nfl-v1' check(policy='weekly-core-nfl-v1')
);
create table sports_feed.weekly_core_packs(
 id uuid primary key default gen_random_uuid(), user_id uuid not null references sports_feed.weekly_core_schedules,
 period integer not null check(period>=0), due_at timestamptz not null,
 issued_at timestamptz not null default clock_timestamp(), sport text not null default 'nfl' check(sport='nfl'),
 policy text not null default 'weekly-core-nfl-v1' check(policy='weekly-core-nfl-v1'),
 opened_at timestamptz, receipt jsonb,
 unique(user_id,period), check((opened_at is null)=(receipt is null))
);
create index weekly_core_member_history on sports_feed.weekly_core_packs(user_id,due_at desc,id);
do $$declare t text;begin foreach t in array array['weekly_core_control','weekly_core_schedules','weekly_core_packs'] loop
 execute format('alter table sports_feed.%I enable row level security',t);
 execute format('revoke all on sports_feed.%I from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_nfl_worker',t);
end loop;end$$;
create function sports_feed.weekly_core_guard() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' then raise exception 'Weekly reward history is permanent';end if;
 if tg_table_name='weekly_core_schedules' then
  if (to_jsonb(new)-'next_period') is distinct from (to_jsonb(old)-'next_period') or new.next_period<old.next_period then raise exception 'Reward anchor is immutable';end if;
 else
  if (to_jsonb(new)-array['opened_at','receipt']) is distinct from (to_jsonb(old)-array['opened_at','receipt']) or old.opened_at is not null or new.opened_at is null then raise exception 'Weekly pack may only open once';end if;
 end if;return new;
end$$;
create trigger weekly_schedule_guard before update or delete on sports_feed.weekly_core_schedules for each row execute function sports_feed.weekly_core_guard();
create trigger weekly_pack_guard before update or delete on sports_feed.weekly_core_packs for each row execute function sports_feed.weekly_core_guard();
create function sports_feed.weekly_core_allowed(u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from sports_feed.weekly_core_control where enabled)
 and exists(select 1 from sports_feed.nfl_control where enabled)
 and beta_private.admitted(u)
 and exists(select 1 from credits_sandbox.access where user_id=u and enabled)
 and not exists(select 1 from beta_fantasy.members where user_id=u and (revoked_at is not null or expires_at<=clock_timestamp()))
 and exists(select 1 from beta_public.profiles where id=u and disabled_at is null)
$$;
create function sports_feed.weekly_core_reconcile(u uuid) returns integer language plpgsql security definer set search_path='' as $$
declare s sports_feed.weekly_core_schedules; now_at timestamptz; last_period integer; n integer;begin
 perform pg_advisory_xact_lock(71820342);
 if not sports_feed.weekly_core_allowed(u) then return 0;end if;
 now_at:=clock_timestamp();
 insert into sports_feed.weekly_core_schedules(user_id,enrolled_at) values(u,now_at) on conflict do nothing;
 select * into strict s from sports_feed.weekly_core_schedules where user_id=u for update;
 -- 604800 seconds, not local-calendar days; bounded catch-up remains due for the next run.
 last_period:=least(floor(extract(epoch from(now_at-s.enrolled_at))/604800)::int,s.next_period+499);
 insert into sports_feed.weekly_core_packs(user_id,period,due_at,issued_at)
 select u,i,s.enrolled_at+i*interval '604800 seconds',now_at from generate_series(s.next_period,last_period)i on conflict(user_id,period) do nothing;
 get diagnostics n=row_count;
 if last_period>=s.next_period then update sports_feed.weekly_core_schedules set next_period=last_period+1 where user_id=u;end if;
 return n;
end$$;
create function sports_feed.weekly_core_job() returns integer language plpgsql security definer set search_path='' as $$
declare r record;n integer:=0;begin
 -- Same lock ordering as opening, wallet writes and lineup entries.
 perform pg_advisory_xact_lock(71820342);
 if not exists(select 1 from sports_feed.weekly_core_control where enabled) then return 0;end if;
 for r in select a.user_id from credits_sandbox.access a left join sports_feed.weekly_core_schedules s using(user_id)
 where a.enabled and sports_feed.weekly_core_allowed(a.user_id)
 and (s.user_id is null or s.enrolled_at+s.next_period*interval '604800 seconds'<=clock_timestamp())
 order by s.enrolled_at+s.next_period*interval '604800 seconds' nulls first,a.user_id limit 100
 loop n:=n+sports_feed.weekly_core_reconcile(r.user_id);end loop;
 return n;
end$$;
create function sports_feed.my_weekly_core() returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;s sports_feed.weekly_core_schedules;begin
 u:=beta_fantasy.production_eligible();
 if u is null or not beta_private.active_member_session() then raise exception 'Active admitted session required';end if;
 if not sports_feed.weekly_core_allowed(u) then return jsonb_build_object('enabled',false,'serverTime',extract(epoch from clock_timestamp())*1000,'packs','[]'::jsonb);end if;
 perform sports_feed.weekly_core_reconcile(u);
 select * into strict s from sports_feed.weekly_core_schedules where user_id=u;
 return jsonb_build_object('enabled',true,'member',u,'policy',s.policy,'enrolledAt',s.enrolled_at,'serverTime',extract(epoch from clock_timestamp())*1000,
 'nextIssueAt',s.enrolled_at+s.next_period*interval '604800 seconds',
 'packs',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'issuedAt',p.issued_at,'dueAt',p.due_at,'openedAt',p.opened_at,'receipt',p.receipt) order by p.due_at desc,p.id) from sports_feed.weekly_core_packs p where p.user_id=u),'[]'::jsonb));
end$$;
create function sports_feed.open_weekly_core(pack_id uuid,request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare u uuid;p sports_feed.weekly_core_packs;prior beta_fantasy.requests;item record;cid uuid;cards jsonb:='[]';answer jsonb;now_at timestamptz;payload jsonb;begin
 perform pg_advisory_xact_lock(71820342);
 u:=beta_fantasy.production_eligible();
 if u is null or not beta_private.active_member_session() or not sports_feed.weekly_core_allowed(u) then raise exception 'Weekly pack access unavailable';end if;
 if request_id is null or pack_id is null then raise exception 'Pack and request required';end if;
 payload:=jsonb_build_object('pack_id',pack_id);
 select * into prior from beta_fantasy.requests q where q.user_id=u and q.request_id=open_weekly_core.request_id;
 if found then if prior.action<>'open_weekly_core' or prior.payload<>payload then raise exception 'Request ID reused';end if;return prior.result;end if;
 select * into p from sports_feed.weekly_core_packs q where q.id=pack_id and q.user_id=u for update;
 if not found then raise exception 'Pack unavailable';end if;
 if p.receipt is not null then
  insert into beta_fantasy.requests values(u,request_id,'open_weekly_core',payload,p.receipt);
  return p.receipt;
 end if;
 insert into beta_fantasy.members(user_id,expires_at) values(u,'infinity') on conflict do nothing;
 now_at:=clock_timestamp();
 -- Each canonical roster identity appears once. Random UUID keys are generated on
 -- the server, using PostgreSQL's cryptographic UUID generator, never random().
 -- Existing Core edition limits/serial guards remain authoritative.
 for item in select np.edition_id,np.current_team,np.edition_team,pl.* from sports_feed.nfl_players np
 join beta_fantasy.players pl on pl.id=np.player_id join beta_fantasy.editions e on e.id=np.edition_id
 where pl.sport='nfl' and pl.position in('QB','RB','WR','TE') and pl.status not in('retired','delisted')
 and np.source_status='ACT' and np.observed_at<=now_at and np.observed_at>now_at-interval '72 hours'
 and e.tier='CORE' and e.status='launched' and e.launch_at<=now_at and e.issued<e.max_supply
 order by gen_random_uuid() limit 4 loop
  cid:=beta_fantasy.mint(item.edition_id,u,false,'weekly-core-free-reward',p.id);
  cards:=cards||(select jsonb_build_array(jsonb_build_object('id',c.id,'edition_id',e.id,'serial',c.serial,'name',item.name,'position',item.position,
   'tier','CORE','season',e.season,'kind',e.kind,'max_supply',0,'player_id',item.id,'team',item.current_team,'edition_team',item.edition_team,
   'colour',item.colour,'shirt',item.shirt,'status',item.status,'sport','nfl','tradeable',false)) from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id where c.id=cid);
 end loop;
 if jsonb_array_length(cards)<>4 then raise exception 'Four eligible Core players are not available. Your pack is still unopened.';end if;
 answer:=jsonb_build_object('id',p.id,'name','Weekly Core Pack','opened_at',now_at,'cards',cards);
 update sports_feed.weekly_core_packs set opened_at=now_at,receipt=answer where id=p.id;
 insert into beta_fantasy.requests values(u,request_id,'open_weekly_core',payload,answer);
 return answer;
end$$;
revoke all on function sports_feed.weekly_core_guard(),sports_feed.weekly_core_allowed(uuid),sports_feed.weekly_core_reconcile(uuid),sports_feed.weekly_core_job(),sports_feed.my_weekly_core(),sports_feed.open_weekly_core(uuid,uuid) from public,anon,authenticated,service_role,docked_app,docked_beta_app,docked_nfl_worker;
grant execute on function sports_feed.my_weekly_core(),sports_feed.open_weekly_core(uuid,uuid) to docked_beta_app;
grant execute on function sports_feed.weekly_core_job() to docked_nfl_worker;
-- Activation and cron scheduling are separate reviewed operations. Migration is inert.
