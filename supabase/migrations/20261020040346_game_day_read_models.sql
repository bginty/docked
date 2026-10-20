-- Read-only, session-scoped projection. No entries, assets, rules or publication approvals change.
-- Existing nfl_standings() stays available for compatible callers.
create function sports_feed.game_day_standings() returns jsonb language plpgsql security definer set search_path='' as $$
declare viewer uuid; answer jsonb;
begin
 viewer:=beta_fantasy.production_eligible();
 if viewer is null or viewer<>auth.uid() or not beta_private.active_member_session() then raise exception 'Active admitted session required';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'competitionId',c.id,'label',c.name,'season',c.season,'week',c.round,'mode',c.rules->>'mode',
  'closesAt',c.locks_at,'serverTime',extract(epoch from clock_timestamp())*1000,
  'fixtures',coalesce((select jsonb_agg(jsonb_build_object('scheduledAt',f->>'scheduledAt','status',f->>'status')) from jsonb_array_elements(n.fixtures)f),'[]'),
  -- Exact saved rule content and lineup version define a compatible series, not a mutable display label.
  'series',md5(jsonb_build_object('rules',coalesce(j.body#>'{period,rules}',sr.rules),'lineup',c.rules->>'lineup_version')::text),
  'visible',coalesce(rc.standings_visible,true),
  'finalised',coalesce(rc.standings_visible,true) and j.body->>'finalisedAt' is not null and c.scored_at is not null
    and jsonb_array_length(coalesce(j.calculated->'rows','[]'))>0
    and jsonb_array_length(j.calculated->'rows')=(select count(*) from beta_fantasy.entries e where e.competition_id=c.id)
    and not exists(select 1 from jsonb_array_elements(j.calculated->'rows') x where x->>'status'<>'final' or x->>'centipoints' is null),
  'updatedAt',j.recorded_at,'feedMode','postgame',
  'lastCheckedAt',n.last_checked,'dataDelayed',jsonb_array_length(n.issues)>0,
  'rows',coalesce((select jsonb_agg(jsonb_build_object(
    'key',md5('docked-standings-v1:'||e.user_id::text),'name',coalesce(nullif(t.name,''),'Unnamed team'),
    'isMe',e.user_id=viewer,
    'totalPlayers',jsonb_array_length(e.snapshot),
    'completedPlayers',case when coalesce(rc.standings_visible,true) then
      (select count(*) from jsonb_array_elements(score.value->'players') p
       where p->>'centipoints' is not null and jsonb_array_length(p->'matches')>0
       and not exists(select 1 from jsonb_array_elements(p->'matches') m where m->>'sourceStatus' is distinct from 'completed' or m->'score' is null or m->'score'='null'::jsonb)) else null end,
    'knownCentipoints',case when coalesce(rc.standings_visible,true)
      and exists(select 1 from jsonb_array_elements(score.value->'players') p cross join lateral jsonb_array_elements(p->'matches') m where m->'score' is not null and m->'score'<>'null'::jsonb)
      then score.value->'knownCentipoints' else null end,
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
       'completed',coalesce(player.value->>'centipoints' is not null and jsonb_array_length(player.value->'matches')>0
       and not exists(select 1 from jsonb_array_elements(player.value->'matches') m where m->>'sourceStatus' is distinct from 'completed' or m->'score' is null or m->'score'='null'::jsonb),false) and coalesce(rc.standings_visible,true),
       'locked',l.slot is not null and l.locked_at<=clock_timestamp(),
       'baseCentipoints',case when coalesce(rc.standings_visible,true) then player.value->'baseCentipoints' else null end,
       'centipoints',case when coalesce(rc.standings_visible,true) then player.value->'centipoints' else null end,
       'status',case when not coalesce(rc.standings_visible,true) then 'under-review' when player.value->>'centipoints' is null then 'pending-data'
       when exists(select 1 from jsonb_array_elements(player.value->'matches') m where m->>'availability'='confirmed-dnp') then 'dnp'
       when exists(select 1 from jsonb_array_elements(player.value->'matches') m where m->>'availability'='bye') then 'bye'
       when jsonb_array_length(player.value->'matches')>0 and not exists(select 1 from jsonb_array_elements(player.value->'matches') m where m->>'sourceStatus' is distinct from 'completed') then 'final'
       else 'provisional' end,
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
 left join lateral(select body,calculated,recorded_at from sports_feed.journal where stream_id=n.stream_id order by revision desc limit 1) j on true
 where n.purpose='member' and c.sport='nfl' and c.rules->>'mode' in ('SALARY_CAP','OPEN');
 return answer;
end $$;
revoke all on function sports_feed.game_day_standings() from public,anon,authenticated,service_role,docked_app;
grant execute on function sports_feed.game_day_standings() to docked_beta_app;

-- Same owner/session/MFA guard as the existing operations report. Read-only:
-- health inspection cannot import statistics, rewrite journals or award prizes.
create function sports_feed.owner_scoring_diagnostics() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not beta_private.active_member_session() or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from beta_private.roles where user_id=auth.uid() and role='owner')
 or not beta_private.owner_gameplay_identity(auth.uid()) then raise exception 'Owner MFA required'; end if;
 return jsonb_build_object(
  'serverTime',clock_timestamp(),
  'runs',coalesce((select jsonb_agg(x) from (
    select started_at,finished_at,
     case when finished_at is null and started_at<clock_timestamp()-interval '10 minutes' then 'interrupted' else status end status,detail
    from sports_feed.nfl_worker_runs order by started_at desc limit 12)x),'[]'),
  'sources',coalesce((select jsonb_agg(jsonb_build_object(
    'dataset',r.body->>'dataset','observedAt',r.observed_at,'checkedAt',c.checked_at,'nextAttempt',c.next_attempt,
    'error',c.error_code,'completionObservedAt',(select max(o.observed_at) from sports_feed.completion_observations o where o.raw_id=r.id)))
    from sports_feed.postgame_cache c left join sports_feed.raw_revisions r on r.id=c.raw_id),'[]'),
  'rounds',coalesce((select jsonb_agg(jsonb_build_object(
    'competition',n.competition_id,'lastChecked',n.last_checked,'nextCheck',n.next_check,'issues',n.issues,
    'fixtures',coalesce((select jsonb_agg(jsonb_build_object('game',f->>'gameId','kickoff',f->>'scheduledAt',
      'completionObservedAt',c.first_observed_at)) from jsonb_array_elements(n.fixtures)f
      left join sports_feed.completions c on c.game_id=f->>'gameId'),'[]')))
    from sports_feed.nfl_rounds n where n.purpose='member'),'[]'));
end $$;
revoke all on function sports_feed.owner_scoring_diagnostics() from public,anon,authenticated,service_role,docked_app;
grant execute on function sports_feed.owner_scoring_diagnostics() to docked_beta_app;
