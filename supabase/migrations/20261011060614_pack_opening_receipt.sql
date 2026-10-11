-- Read-only receipt from the immutable allocation, including cards later swapped.
-- No client user/pack selector and no current owner's identity is exposed.
create function beta_fantasy.my_nfl_pack_receipt() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; answer jsonb; begin
 u:=beta_fantasy.production_eligible();
 if u is null or not beta_private.active_member_session() or not exists(select 1 from sports_feed.nfl_control where enabled) then raise exception 'Active NFL member required';end if;
 select jsonb_build_object('id',a.user_id::text||':nfl-starter','name','NFL starter pack','opened_at',a.created_at,'cards',(
  select jsonb_agg(jsonb_build_object(
   'id',c.id,'edition_id',e.id,'serial',c.serial,'name',p.name,'position',p.position,
   'tier',e.tier,'season',e.season,'kind',e.kind,'max_supply',e.max_supply,
   'player_id',p.id,'team',np.current_team,'edition_team',np.edition_team,
   'colour',p.colour,'shirt',p.shirt,'status',p.status,'sport',p.sport,'tradeable',c.tradeable
  ) order by x.n)
  from unnest(a.card_ids) with ordinality x(id,n)
  join beta_fantasy.cards c on c.id=x.id join beta_fantasy.editions e on e.id=c.edition_id
  join beta_fantasy.players p on p.id=e.player_id join sports_feed.nfl_players np on np.player_id=p.id
 )) into answer from sports_feed.nfl_allocations a where a.user_id=u;
 return answer;
end $$;
revoke all on function beta_fantasy.my_nfl_pack_receipt() from public,anon,authenticated,docked_app;
grant execute on function beta_fantasy.my_nfl_pack_receipt() to docked_beta_app;
