-- Current roster is a separate projection from immutable printed edition identity.
alter function beta_fantasy.production_read_state() rename to production_read_state_nfl_initial;
revoke all on function beta_fantasy.production_read_state_nfl_initial() from public,anon,authenticated,docked_beta_app;
create function beta_fantasy.production_read_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare s jsonb;begin
 s:=beta_fantasy.production_read_state_nfl_initial();
 if not coalesce((s->>'nfl_beta')::boolean,false) then return s;end if;
 return s||jsonb_build_object('my_championship_points',0,'leaderboard',jsonb_build_object('rows','[]'::jsonb),
 'cards',coalesce((select jsonb_agg(c||jsonb_build_object('team',p.current_team,'edition_team',p.edition_team,'provider_id',p.provider_id,'status',case when p.source_status='ACT' and p.observed_at>clock_timestamp()-interval '72 hours' then 'active' else 'unavailable' end)) from jsonb_array_elements(s->'cards')c join sports_feed.nfl_players p on p.player_id=(c->>'player_id')::uuid),'[]'));
end$$;
revoke all on function beta_fantasy.production_read_state() from public,anon,authenticated;
grant execute on function beta_fantasy.production_read_state() to docked_beta_app;
