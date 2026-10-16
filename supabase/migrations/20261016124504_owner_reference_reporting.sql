-- Read-only aggregate additions for the owner dashboard. No member/ledger writes.
-- Kept in the private beta schema with the same explicit owner/session/AAL2 gate.
create function beta_private.owner_reference_reporting(p_start timestamptz,p_end timestamptz,p_sport text default null,p_include_staff boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare output jsonb; begin
 if not coalesce(beta_private.active_member_session(),false) or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from beta_private.roles where user_id=auth.uid() and role='owner')
 or not coalesce(beta_private.owner_gameplay_identity(auth.uid()),false) then raise exception 'Owner MFA required';end if;
 if p_start is null or p_end is null or p_end<=p_start or p_end-p_start>interval '366 days' or p_sport not in('football','nfl','afl') then raise exception 'Invalid reporting range';end if;
 with members as materialized (
  select p.id,p.created_at from beta_public.profiles p join beta_private.admissions a on a.user_id=p.id
  where p_include_staff or (not a.administrator and not exists(select 1 from beta_private.roles r where r.user_id=p.id))
 ), days as (
  select generate_series((p_start at time zone 'Australia/Sydney')::date,((least(p_end,clock_timestamp())-interval '1 microsecond') at time zone 'Australia/Sydney')::date,interval '1 day')::date report_day
 ), registrations as (
  select (created_at at time zone 'Australia/Sydney')::date report_day,count(*) n from members where created_at>=p_start and created_at<least(p_end,clock_timestamp()) group by 1
 ), cards as materialized (
  select c.created_at at from beta_fantasy.cards c join beta_fantasy.editions e on e.id=c.edition_id join beta_fantasy.players p on p.id=e.player_id where p_sport is null or p.sport=p_sport
  union all
  select to_timestamp((i.document->>'mintedAt')::numeric/1000) from credits_sandbox.card_instances i join credits_sandbox.card_definitions d on d.id=i.definition join credits_sandbox.permanent_players p on p.id=d.player_id where p_sport is null or p.sport=p_sport
 ), recent as (
  select 'registration:'||id::text id,'registration' kind,'New member registered' title,created_at at,'/admin/preview-testers' href from members where created_at>=p_start and created_at<p_end
  union all select 'report:'||id::text,'report','Report submitted',created_at,'/admin/community/reports' from beta_private.social_reports where created_at>=p_start and created_at<p_end
  union all select 'competition:'||id::text,'competition','Competition scheduled',opens_at,'/fantasy/admin' from beta_fantasy.competitions where opens_at>=p_start and opens_at<least(p_end,clock_timestamp()) and (p_sport is null or sport=p_sport)
  union all select 'moderation:'||id::text,'moderation','Moderation action recorded',created_at,'/admin/community/reports' from beta_private.social_moderation_events where created_at>=p_start and created_at<p_end
 )
 select jsonb_build_object(
  'memberIds',coalesce((select jsonb_agg(id) from members),'[]'),
  'usersCurrent',(select count(*) from members where created_at<least(p_end,clock_timestamp())),
  'usersPrevious',(select count(*) from members where created_at<p_start),
  'newUsersCurrent',(select count(*) from members where created_at>=p_start and created_at<least(p_end,clock_timestamp())),
  'newUsersPrevious',(select count(*) from members where created_at>=p_start-(p_end-p_start) and created_at<p_start),
  'registrations',coalesce((select jsonb_agg(row) from (
    select d.report_day as "day",coalesce(r.n,0) registrations,
     (select count(*) from members where created_at<p_start)+sum(coalesce(r.n,0)) over(order by d.report_day) cumulative
    from days d left join registrations r using(report_day) order by d.report_day) row),'[]'),
  'circulationCurrent',(select count(*) from cards where at<least(p_end,clock_timestamp())),
  'circulationPrevious',(select count(*) from cards where at<p_start),
  'moderation',jsonb_build_object(
    'content',(select count(*) from beta_private.social_reports where status in('open','escalated') and target_type in('post','comment','media','community','discussion')),
    'members',(select count(*) from beta_private.social_reports where status in('open','escalated') and target_type='profile'),
    'listings',null),
  'recent',coalesce((select jsonb_agg(row) from (select * from recent where at<=clock_timestamp() order by at desc,id limit 20) row),'[]')
 ) into output;
 return output;
end $$;
revoke all on function beta_private.owner_reference_reporting(timestamptz,timestamptz,text,boolean) from public,anon,authenticated,service_role,docked_app;
grant execute on function beta_private.owner_reference_reporting(timestamptz,timestamptz,text,boolean) to docked_beta_app;
-- Existing created/status indexes cover bounded reporting; cards are an all-time
-- circulation count, not maximum configured supply. JSON economy is read once by
-- the established owner snapshot transaction and projected on the server.
