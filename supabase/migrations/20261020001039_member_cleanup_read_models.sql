-- Read-only, session-scoped projection. No entries, assets, rules or publication approvals change.
-- Existing nfl_standings() stays available for compatible callers.
create or replace function sports_feed.play_standings_before_status() returns jsonb language plpgsql security definer set search_path='' as $$
declare viewer uuid; answer jsonb;
begin
 viewer:=beta_fantasy.production_eligible();
 if viewer is null or viewer<>auth.uid() or not beta_private.active_member_session() then raise exception 'Active admitted session required';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'competitionId',c.id,'label',c.name,'season',c.season,'week',c.round,'mode',c.rules->>'mode',
  -- Exact saved rule content and lineup version define a compatible series, not a mutable display label.
  'series',md5(jsonb_build_object('rules',coalesce(j.body#>'{period,rules}',sr.rules),'lineup',c.rules->>'lineup_version')::text),
  'visible',coalesce(rc.standings_visible,true),
  'finalised',coalesce(rc.standings_visible,true) and j.body->>'finalisedAt' is not null and c.scored_at is not null
    and jsonb_array_length(coalesce(j.calculated->'rows','[]'))>0
    and jsonb_array_length(j.calculated->'rows')=(select count(*) from beta_fantasy.entries e where e.competition_id=c.id)
    and not exists(select 1 from jsonb_array_elements(j.calculated->'rows') x where x->>'status'<>'final' or x->>'centipoints' is null),
  'rows',coalesce((select jsonb_agg(jsonb_build_object(
    'key',md5('docked-standings-v1:'||e.user_id::text),'name',coalesce(nullif(t.name,''),'Unnamed team'),
    'isMe',e.user_id=viewer,
    'centipoints',case when coalesce(rc.standings_visible,true) then score.value->'centipoints' else null end,
    'rank',case when coalesce(rc.standings_visible,true) then score.value->'rank' else null end,
    'status',case when not coalesce(rc.standings_visible,true) then 'under-review' else coalesce(score.value->>'status','pending-data') end,
    'lineup',case when e.user_id=viewer or (
      c.locks_at<=clock_timestamp() and coalesce(rc.standings_visible,true)
      and exists(select 1 from beta_fantasy.lineup_publication_policy p where p.competition_id=c.id and p.enabled and p.approved_at<=clock_timestamp())
      and beta_private.admitted(e.user_id)
      and exists(select 1 from beta_private.social_profiles p join beta_private.social_profiles vp on vp.user_id=viewer and vp.status in ('active','restricted') where p.user_id=e.user_id and beta_private.social_profile_visible(vp.id,p.id,false))
      and (select count(*) from beta_fantasy.slot_locks l where l.competition_id=c.id and l.user_id=e.user_id and l.locked_at<=clock_timestamp() and (l.snapshot->>'kickoff')::timestamptz<=clock_timestamp()
        and exists(select 1 from jsonb_array_elements(cfg.configuration->'slots') s where s->>'id'=l.slot))=jsonb_array_length(cfg.configuration->'slots')
      and jsonb_array_length(cfg.configuration->'slots')>0
    ) then (
      select coalesce(jsonb_agg(jsonb_build_object(
       'serial',card.value->'serial','max_supply',card.value->'max_supply','slot',card.value->>'slot','name',card.value->>'name','position',card.value->>'position','tier',card.value->>'tier','team',card.value->>'team',
       'fixtures',coalesce((select jsonb_agg(jsonb_build_object('scheduledAt',f->>'scheduledAt','status',f->>'status')) from jsonb_array_elements(n.fixtures) f where f->'playerIds' ? (card.value->>'player_id')),'[]'::jsonb),
       'multiplier',coalesce((card.value->>'multiplierTenths')::numeric/10,(card.value->>'multiplier')::numeric),
       'locked',l.slot is not null and l.locked_at<=clock_timestamp(),
       'baseCentipoints',case when coalesce(rc.standings_visible,true) then player.value->'baseCentipoints' else null end,
       'centipoints',case when coalesce(rc.standings_visible,true) then player.value->'centipoints' else null end,
       'status',case when not coalesce(rc.standings_visible,true) then 'under-review' when player.value->>'centipoints' is null then 'pending-data' else score.value->>'status' end,
       'parts',case when coalesce(rc.standings_visible,true) then coalesce((select jsonb_agg(jsonb_build_object('statistic',part->>'statistic','quantity',part->'quantity','centipoints',part->'centipoints')) from jsonb_array_elements(player.value->'matches') m cross join lateral jsonb_array_elements(m#>'{score,parts}') part),'[]') else '[]'::jsonb end
      ) order by card.value->>'slot'),'[]')
      from jsonb_array_elements(e.snapshot) original
      left join beta_fantasy.slot_locks l on l.competition_id=c.id and l.user_id=e.user_id and l.slot=original->>'slot'
      cross join lateral(select coalesce(l.snapshot,original) value) card
      left join lateral(select p value from jsonb_array_elements(score.value->'players') p where p->>'cardId'=coalesce(card.value->>'card_id',card.value->>'id') limit 1) player on true
    ) else null end
  ) order by (score.value->>'rank')::integer nulls last,md5('docked-standings-v1:'||e.user_id::text))
  from beta_fantasy.entries e
  left join beta_fantasy.team_names t on t.user_id=e.user_id
  left join lateral(select x value from jsonb_array_elements(j.calculated->'rows') x where x->>'member'=e.user_id::text limit 1) score on true
  where e.competition_id=c.id),'[]')
 ) order by c.season desc,c.round desc,c.id),'[]') into answer
 from sports_feed.nfl_rounds n join beta_fantasy.competitions c on c.id=n.competition_id
 join beta_fantasy.scoring_rules sr on sr.id=c.scoring_id
 join beta_fantasy.lineup_configurations cfg on cfg.version=c.rules->>'lineup_version'
 left join beta_fantasy.round_controls rc on rc.competition_id=c.id
 left join lateral(select body,calculated from sports_feed.journal where stream_id=n.stream_id order by revision desc limit 1) j on true
 where n.purpose='member' and c.sport='nfl' and c.rules->>'mode' in ('SALARY_CAP','OPEN');
 return answer;
end $$;
revoke all on function sports_feed.play_standings_before_status() from public,anon,authenticated,service_role,docked_app,docked_beta_app;

-- Own immutable sale receipts for presentation; no wallet or notification rewriting.
create or replace function credits_sandbox.my_sale_receipts() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not beta_private.active_member_session() or not beta_private.admitted(auth.uid()) then raise exception 'Active admitted session required'; end if;
 return coalesce((select jsonb_object_agg(listing_id,receipt) from credits_sandbox.sale_notification_outbox where recipient=auth.uid()),'{}'::jsonb);
end $$;
revoke all on function credits_sandbox.my_sale_receipts() from public,anon,authenticated,service_role,docked_app;
grant execute on function credits_sandbox.my_sale_receipts() to docked_beta_app;

create table if not exists credits_sandbox.web_push_subscriptions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 endpoint text not null unique, keys jsonb not null, enabled boolean not null default true,
 created_at timestamptz not null default clock_timestamp(), updated_at timestamptz not null default clock_timestamp()
);
create table if not exists credits_sandbox.sale_push_deliveries (
 listing_id text not null references credits_sandbox.sale_notification_outbox(listing_id),
 subscription_id uuid not null references credits_sandbox.web_push_subscriptions(id),
 status text not null default 'queued' check(status in ('queued','sending','sent','expired','cancelled','failed')),
 attempts integer not null default 0, available_at timestamptz not null default clock_timestamp(),
 lease uuid, delivered_at timestamptz, last_error text,
 primary key(listing_id,subscription_id)
);
alter table credits_sandbox.web_push_subscriptions enable row level security;
alter table credits_sandbox.sale_push_deliveries enable row level security;
revoke all on credits_sandbox.web_push_subscriptions,credits_sandbox.sale_push_deliveries from public,anon,authenticated,service_role,docked_app,docked_beta_app;
create index if not exists sale_push_due on credits_sandbox.sale_push_deliveries(available_at) where status in ('queued','sending');
create index if not exists push_subscriber on credits_sandbox.web_push_subscriptions(user_id) where enabled;

create or replace function credits_sandbox.manage_web_push(p_endpoint text,p_keys jsonb,p_enabled boolean) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not beta_private.active_member_session() or not beta_private.admitted(auth.uid()) then raise exception 'Active admitted session required'; end if;
 if p_endpoint !~ '^https://' or length(p_endpoint)>2048 then raise exception 'Invalid subscription'; end if;
 if not p_enabled then
   update credits_sandbox.web_push_subscriptions set enabled=false,updated_at=clock_timestamp() where user_id=auth.uid() and endpoint=p_endpoint;
   update credits_sandbox.sale_push_deliveries d set status='cancelled' from credits_sandbox.web_push_subscriptions s where d.subscription_id=s.id and s.user_id=auth.uid() and s.endpoint=p_endpoint and d.status in ('queued','sending');
   return true;
 end if;
 if coalesce(p_keys->>'p256dh','') !~ '^[A-Za-z0-9_-]{87,88}$' or coalesce(p_keys->>'auth','') !~ '^[A-Za-z0-9_-]{22,24}$' then raise exception 'Invalid subscription keys'; end if;
 if exists(select 1 from credits_sandbox.web_push_subscriptions where endpoint=p_endpoint and user_id<>auth.uid()) then raise exception 'This browser subscription belongs to another account. Disable it before changing accounts.'; end if;
 if (select count(*) from credits_sandbox.web_push_subscriptions where user_id=auth.uid() and enabled)>=10 and not exists(select 1 from credits_sandbox.web_push_subscriptions where endpoint=p_endpoint and user_id=auth.uid()) then raise exception 'Too many devices'; end if;
 insert into credits_sandbox.web_push_subscriptions(user_id,endpoint,keys) values(auth.uid(),p_endpoint,p_keys)
 on conflict(endpoint) do update set enabled=true,keys=excluded.keys,updated_at=clock_timestamp()
 where credits_sandbox.web_push_subscriptions.user_id=auth.uid();
 if not found then raise exception 'This browser subscription belongs to another account. Disable it before changing accounts.'; end if;
 return true;
end $$;
create or replace function credits_sandbox.web_push_enabled(p_endpoint text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not beta_private.active_member_session() or not beta_private.admitted(auth.uid()) then raise exception 'Active admitted session required'; end if;
 return exists(select 1 from credits_sandbox.web_push_subscriptions where user_id=auth.uid() and endpoint=p_endpoint and enabled);
end $$;
revoke all on function credits_sandbox.manage_web_push(text,jsonb,boolean),credits_sandbox.web_push_enabled(text) from public,anon,authenticated,service_role,docked_app;
grant execute on function credits_sandbox.manage_web_push(text,jsonb,boolean),credits_sandbox.web_push_enabled(text) to docked_beta_app;

create or replace function credits_sandbox.queue_sale_push() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into credits_sandbox.sale_push_deliveries(listing_id,subscription_id)
 select new.listing_id,s.id from credits_sandbox.web_push_subscriptions s where s.user_id=new.recipient and s.enabled and s.created_at<=new.created_at
 on conflict do nothing;
 return new;
end $$;
revoke all on function credits_sandbox.queue_sale_push() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
drop trigger if exists queue_sale_push on credits_sandbox.sale_notification_outbox;
create trigger queue_sale_push after insert on credits_sandbox.sale_notification_outbox for each row execute function credits_sandbox.queue_sale_push();

create or replace function credits_sandbox.claim_sale_push() returns jsonb language plpgsql security definer set search_path='' as $$
declare answer jsonb;
begin
 with due as (select d.listing_id,d.subscription_id from credits_sandbox.sale_push_deliveries d join credits_sandbox.web_push_subscriptions s on s.id=d.subscription_id where d.status in ('queued','sending') and d.available_at<=clock_timestamp() and s.enabled and beta_private.admitted(s.user_id) order by d.available_at limit 20 for update of d skip locked),
 claimed as (update credits_sandbox.sale_push_deliveries d set status='sending',attempts=attempts+1,available_at=clock_timestamp()+interval '5 minutes',lease=gen_random_uuid() from due where d.listing_id=due.listing_id and d.subscription_id=due.subscription_id returning d.*)
 select coalesce(jsonb_agg(jsonb_build_object('listing',d.listing_id,'subscription',d.subscription_id,'lease',d.lease,'endpoint',s.endpoint,'keys',s.keys,'receipt',o.receipt)),'[]') into answer from claimed d join credits_sandbox.web_push_subscriptions s on s.id=d.subscription_id join credits_sandbox.sale_notification_outbox o on o.listing_id=d.listing_id;
 return answer;
end $$;
create or replace function credits_sandbox.finish_sale_push(p_listing text,p_subscription uuid,p_lease uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('sent','expired','retry') then raise exception 'Invalid outcome'; end if;
 update credits_sandbox.sale_push_deliveries set status=case when p_status='retry' then case when attempts>=12 then 'failed' else 'queued' end else p_status end,
 delivered_at=case when p_status='sent' then clock_timestamp() else null end,
 available_at=clock_timestamp()+make_interval(secs=>least(21600,60*power(2,least(attempts,8))::integer)),last_error=case when p_status='sent' then null else p_status end
 where listing_id=p_listing and subscription_id=p_subscription and lease=p_lease and status='sending';
 if found and p_status='expired' then update credits_sandbox.web_push_subscriptions set enabled=false,updated_at=clock_timestamp() where id=p_subscription; end if;
end $$;
revoke all on function credits_sandbox.claim_sale_push(),credits_sandbox.finish_sale_push(text,uuid,uuid,text) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function credits_sandbox.claim_sale_push(),credits_sandbox.finish_sale_push(text,uuid,uuid,text) to docked_nfl_worker;
