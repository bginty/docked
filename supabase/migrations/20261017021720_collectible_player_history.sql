-- Public player statistics for admitted members, not entry/ownership projections.
-- Private schema and existing session gate; no direct journal or PostgREST grants.
create function sports_feed.card_player_history(player text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare viewer uuid; answer jsonb; player_aliases text[];
begin
 viewer:=beta_fantasy.production_eligible();
 if viewer is null or viewer<>auth.uid() or not beta_private.active_member_session() then raise exception 'Active admitted session required'; end if;
 if length(player)>120 or length(player)<1 then raise exception 'Invalid player'; end if;
 -- Verified provider identity bridge, never player-name matching. Preserve old Core history.
 select array_agg(distinct id) into player_aliases from (
  select player id
  union select n.player_id::text from sports_feed.nfl_players n join credits_sandbox.permanent_players p on p.provider_id=n.provider_id and p.sport='nfl' and p.provider='nflverse' where p.id=player
  union select p.id from sports_feed.nfl_players n join credits_sandbox.permanent_players p on p.provider_id=n.provider_id and p.sport='nfl' and p.provider='nflverse' where n.player_id::text=player
 ) identities;
 select coalesce(jsonb_agg(record),'[]') into answer from (
 select jsonb_build_object('season',c.season,'week',c.round,'fixture',coalesce(mapping.mapping->>'gameId',f->>'id'),'scheduledAt',f->>'scheduledAt',
 'position',coalesce(ps.position,bp.position),'rules',j.body#>'{period,rules}',
 'revision',coalesce((source->>'revision')::int,0),'observedAt',source->>'observedAt',
 'final',j.body->>'finalisedAt' is not null,'visible',coalesce(rc.standings_visible,true),
 'source',case when not coalesce(rc.standings_visible,true) or source is null or p is null then null else
 jsonb_build_object('status',source->>'status','availability',p->>'availability','stats',p->'stats') end) record
 from sports_feed.nfl_rounds n join sports_feed.streams s on s.id=n.stream_id
 join beta_fantasy.competitions c on c.id=n.competition_id
 join lateral(select body from sports_feed.journal where stream_id=n.stream_id order by revision desc limit 1) j on true
 cross join lateral jsonb_array_elements(j.body#>'{period,fixtures}') f
 left join beta_fantasy.round_controls rc on rc.competition_id=c.id
 left join sports_feed.postgame_mapping mapping on mapping.stream_id=n.stream_id and mapping.fixture_id=f->>'id'
 left join lateral(select position from credits_sandbox.current_player_status where id=any(player_aliases) order by id limit 1) ps on true
 left join lateral(select position from beta_fantasy.players where id::text=any(player_aliases) order by id limit 1) bp on true
 left join lateral(select value source from jsonb_array_elements(j.body->'sources') with ordinality where value->>'fixtureId'=f->>'id' order by ordinality desc limit 1) latest on true
 left join lateral(select value p from jsonb_array_elements(source->'players') where value->>'playerId'=any(player_aliases) order by value->>'playerId'=player desc limit 1) stats on true
 where n.purpose='member' and s.purpose='member' and j.body->>'scope'='authorised-free-beta'
 and f->'playerIds' ?| player_aliases and coalesce(ps.position,bp.position) is not null
 and c.locks_at<=clock_timestamp()
 order by c.season desc,c.round desc,c.id limit 300
 ) records;
 return answer;
end $$;
revoke all on function sports_feed.card_player_history(text) from public,anon,authenticated,service_role,docked_app;
grant execute on function sports_feed.card_player_history(text) to docked_beta_app;
