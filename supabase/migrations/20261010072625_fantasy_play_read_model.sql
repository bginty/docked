-- Additive owner Preview read model only. No ownership, scoring, Auth or fee changes.
alter function beta_fantasy.production_read_state() rename to production_read_state_before_field;
revoke all on function beta_fantasy.production_read_state_before_field() from public,anon,authenticated,docked_beta_app;
create function beta_fantasy.production_read_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare state jsonb; u uuid; detail jsonb;
begin
  -- Retain exact owner, verified session, MFA, release and visibility gates.
  state:=beta_fantasy.production_read_state_before_field();
  u:=(state->>'user_id')::uuid;
  select coalesce(jsonb_agg(jsonb_build_object(
    'competition_id',en.competition_id,
    'cards',coalesce((select jsonb_agg(jsonb_build_object(
      'id',a.id,'edition_id',a.edition_id,'owner_id',en.user_id,
      'serial',a.serial,'tradeable',a.tradeable,'created_at',a.created_at,'acquired_at',en.updated_at,
      'name',pl.name,'team',pl.team,'colour',pl.colour,'shirt',pl.shirt,'sport',pl.sport,'status',pl.status,
      'position',snap->>'position','player_id',snap->>'player_id','tier',snap->>'tier',
      'season',snap->>'season','kind',snap->>'kind','max_supply',ed.max_supply,'listed',false
    ) order by snap->>'card_id') from jsonb_array_elements(en.snapshot) snap
      join beta_fantasy.cards a on a.id=(snap->>'card_id')::uuid
      join beta_fantasy.editions ed on ed.id=a.edition_id
      join beta_fantasy.players pl on pl.id=(snap->>'player_id')::uuid),'[]'::jsonb),
    'scores',coalesce((select jsonb_agg(jsonb_build_object('player_id',rs.player_id,'score',rs.score,'stats',rs.stats,'scoring_version',sr.version,'rules',sr.rules) order by rs.player_id)
      from beta_fantasy.round_scores rs join beta_fantasy.scoring_rules sr on sr.id=rs.scoring_id
      where rs.competition_id=en.competition_id and exists(select 1 from jsonb_array_elements(en.snapshot) snap where (snap->>'player_id')::uuid=rs.player_id)),'[]'::jsonb)
  ) order by en.updated_at desc),'[]'::jsonb) into detail
  from beta_fantasy.entries en
  where en.user_id=u and exists(select 1 from jsonb_array_elements(state->'competitions') co where (co->>'id')::uuid=en.competition_id);
  return state||jsonb_build_object('server_time',clock_timestamp(),'round_details',detail);
end $$;
revoke all on function beta_fantasy.production_read_state() from public,anon,authenticated;
grant execute on function beta_fantasy.production_read_state() to docked_beta_app;
