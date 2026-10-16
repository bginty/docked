-- Additive, read-only owner reporting. No grants, rewards, fees or member mutations.
-- Reuses the established active-session + owner + AAL2 database guard.
create function beta_private.owner_command_centre(p_start timestamptz,p_end timestamptz,p_sport text default null,p_include_staff boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare report jsonb; centre jsonb; begin
 report:=beta_private.owner_operations(p_start,p_end,p_sport,p_include_staff);
 -- Carry canonical display context; the server uses the shared competition-name
 -- projection. Saved names, IDs and immutable scoring rules remain unchanged.
 report:=jsonb_set(report,'{competitions}',coalesce((select jsonb_agg(
  x.value||jsonb_build_object('display',jsonb_build_object('mode',c.rules->>'mode','lineupVersion',c.rules->>'lineup_version','season',c.season,'week',c.round)) order by x.ordinality)
  from jsonb_array_elements(report->'competitions') with ordinality x(value,ordinality)
  join beta_fantasy.competitions c on c.id=(x.value->>'id')::uuid),'[]'));
 with members as (
  select p.id from beta_public.profiles p join beta_private.admissions a on a.user_id=p.id
  where p.disabled_at is null and a.status='accepted'
  and (p_include_staff or (not a.administrator and not exists(select 1 from beta_private.roles r where r.user_id=p.id)))
 ), packs as (
  select x.value->>'member' member,to_timestamp((x.value->>'openedAt')::numeric/1000) at,x.value->'product'->>'sport' sport
  from credits_sandbox.state s cross join lateral jsonb_each(coalesce(s.document->'economy'->'packs','{}')) x
  where x.value->>'openedAt' is not null
  union all select user_id::text,opened_at,sport from sports_feed.weekly_core_packs where opened_at is not null
  union all select user_id::text,opened_at,null::text from beta_fantasy.packs where opened_at is not null
 ), activity as (
  select e.user_id::text member,e.updated_at at,c.sport,'entry' kind from beta_fantasy.entries e join beta_fantasy.competitions c on c.id=e.competition_id
  union all select member,at,sport,'pack' from packs
  union all select sp.user_id::text,p.created_at,p.sport,'post' from beta_private.social_posts p join beta_private.social_profiles sp on sp.id=p.author_id where p.deleted_at is null and p.kind<>'edge'
 ), filtered as (
  select a.* from activity a join members m on m.id::text=a.member where (p_sport is null or a.sport=p_sport) and at>=p_start and at<p_end
 ), days as (
  select generate_series((p_start at time zone 'Australia/Sydney')::date,((p_end-interval '1 microsecond') at time zone 'Australia/Sydney')::date,interval '1 day')::date as report_day
 )
 select jsonb_build_object(
  'activeMembers',(select count(distinct member) from filtered),
  'packsOpened',(select count(*) from filtered where kind='pack'),
  'entriesUpdated',(select count(*) from filtered where kind='entry'),
  'posts',(select count(*) from filtered where kind='post'),
  'pendingInvitations',(select count(*) from beta_private.admissions a where status='reserved' and expires_at>clock_timestamp() and (p_include_staff or (not administrator and not exists(select 1 from beta_private.roles r where r.user_id=a.user_id)))),
  'suspendedMembers',(select count(*) from beta_public.profiles p join beta_private.admissions a on a.user_id=p.id where p.disabled_at is not null and (p_include_staff or (not a.administrator and not exists(select 1 from beta_private.roles r where r.user_id=p.id)))),
  'daily',coalesce((select jsonb_agg(jsonb_build_object('day',d.report_day,'entries',coalesce(x.entries,0),'packs',coalesce(x.packs,0),'posts',coalesce(x.posts,0)) order by d.report_day) from days d left join (
   select (at at time zone 'Australia/Sydney')::date as report_day,count(*) filter(where kind='entry') entries,count(*) filter(where kind='pack') packs,count(*) filter(where kind='post') posts from filtered group by 1
  ) x using(report_day)),'[]'),
  'packFailures',coalesce((select jsonb_agg(row) from (select pf.id,pf.category,pf.recorded_at from credits_sandbox.pack_failures pf join members m on m.id::text=pf.member where pf.recorded_at>=p_start and pf.recorded_at<p_end and (p_sport is null or exists(select 1 from credits_sandbox.pack_configuration pc where pc.document->>'id'=pf.product and pc.document->>'sport'=p_sport)) order by pf.recorded_at desc,pf.id limit 50) row),'[]'),
  'feedJobs',coalesce((select jsonb_agg(row) from (select id,provider,state,attempts,error_code,last_success,available_at,lease_until from sports_feed.jobs where state in ('blocked','leased') order by available_at,id limit 50) row),'[]'),
  'lastRosterSync',(select max(observed_at) from sports_feed.nfl_players),
  'workerRuns',coalesce((select jsonb_agg(row) from (select id,started_at,finished_at,status from sports_feed.nfl_worker_runs order by started_at desc,id desc limit 10) row),'[]'),
  'weeklyEnabled',(select enabled from sports_feed.weekly_core_control where id),
  'inventorySummary',coalesce((select jsonb_agg(row) from (
   select tier,sum(issued) issued,sum(cap) cap from (
    select e.tier,e.issued,e.max_supply cap from beta_fantasy.editions e join beta_fantasy.players p on p.id=e.player_id where p_sport is null or p.sport=p_sport
    union all select d.rarity,(select count(*) from credits_sandbox.card_instances i where i.definition=d.id),d.lifetime_cap from credits_sandbox.card_definitions d join credits_sandbox.permanent_players p on p.id=d.player_id where p_sport is null or p.sport=p_sport
   ) editions group by tier order by tier
  ) row),'[]'),
  'limitations',jsonb_build_array('Activity counts currently accepted, non-disabled members: saved-entry updates, opened packs and non-deleted posts, not logins or retention.','Entries use their last saved timestamp; this is not a reconstructed submission history.','Pack counts include the current credit economy, weekly rewards and legacy packs, scoped by known sport.','Inventory includes recorded beta editions across members, including staff; Core capacity is not commercial stock.','Wallet metrics are account-wide test-credit totals and are unaffected by sport or staff filters.','Feed job exceptions are current, account-wide; pack failures follow member, sport and date filters, latest 50. Unknown product sport is excluded from sport-specific failures. Worker history is latest 10.')) into centre;
 -- Keep summary/export metrics consistent with the current economy and staff definition.
 report:=jsonb_set(report,'{metrics}',(report->'metrics')||jsonb_build_object(
  'registered',(select count(*) from auth.users u join beta_private.admissions a on a.user_id=u.id where p_include_staff or (not a.administrator and not exists(select 1 from beta_private.roles r where r.user_id=u.id))),
  'admitted',(select count(*) from beta_public.profiles p join beta_private.admissions a on a.user_id=p.id where a.status='accepted' and p.disabled_at is null and (p_include_staff or (not a.administrator and not exists(select 1 from beta_private.roles r where r.user_id=p.id)))),
  'newRegistrations',(select count(*) from beta_public.profiles p join beta_private.admissions a on a.user_id=p.id where a.status='accepted' and p.disabled_at is null and p.created_at>=p_start and p.created_at<p_end and (p_include_staff or (not a.administrator and not exists(select 1 from beta_private.roles r where r.user_id=p.id)))),
  'packsOpened',centre->'packsOpened','activeInRange',centre->'activeMembers','teamsEntered',centre->'entriesUpdated','posts',centre->'posts'));
 return report||jsonb_build_object('centre',centre);
end $$;
revoke all on function beta_private.owner_command_centre(timestamptz,timestamptz,text,boolean) from public,anon,authenticated,service_role,docked_app;
grant execute on function beta_private.owner_command_centre(timestamptz,timestamptz,text,boolean) to docked_beta_app;
