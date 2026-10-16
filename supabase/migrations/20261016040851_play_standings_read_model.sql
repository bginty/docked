-- Read-only, session-scoped projection. No entries, assets, rules or publication approvals change.
-- Existing nfl_standings() stays available for compatible callers.
create function sports_feed.play_standings() returns jsonb language plpgsql security definer set search_path='' as $$
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
revoke all on function sports_feed.play_standings() from public,anon,authenticated,service_role,docked_app;
grant execute on function sports_feed.play_standings() to docked_beta_app;
