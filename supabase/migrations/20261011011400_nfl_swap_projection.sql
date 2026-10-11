-- Preserve archived inventory/history; real NFL beta swaps cannot issue legacy packs.
alter function beta_fantasy.swap_command(text,jsonb,uuid) rename to swap_command_before_nfl;
alter function beta_fantasy.swap_read_state() rename to swap_read_state_before_nfl;
revoke all on function beta_fantasy.swap_command_before_nfl(text,jsonb,uuid),beta_fantasy.swap_read_state_before_nfl() from public,anon,authenticated,docked_app,docked_beta_app;
create function beta_fantasy.swap_command(a text,p jsonb,req uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare s beta_fantasy.swaps; ids uuid[];begin
 perform pg_advisory_xact_lock(71820341);
 perform pg_advisory_xact_lock(71820342);
 perform beta_fantasy.swap_actor();
 if exists(select 1 from sports_feed.nfl_control where enabled) then
  if a in('reserve_pack','practice_credit','fee_mode') then raise exception 'Extra packs and balances unavailable in the free NFL beta';end if;
  if a='offer' then ids:=array[(p->>'give_card')::uuid,(p->>'take_card')::uuid];
  elsif a='accept' then select * into s from beta_fantasy.swaps where id=(p->>'swap_id')::uuid;ids:=array[s.give_card,s.take_card];end if;
  if a in('offer','accept') and (select count(*) from beta_fantasy.cards c join sports_feed.nfl_players n on n.edition_id=c.edition_id where c.id=any(ids))<>2 then raise exception 'Only real NFL beta cards can be swapped';end if;
 end if;
 return beta_fantasy.swap_command_before_nfl(a,p,req);
end$$;
create function beta_fantasy.swap_read_state() returns jsonb language plpgsql security definer set search_path='' as $$declare s jsonb;begin
 s:=beta_fantasy.swap_read_state_before_nfl();
 if exists(select 1 from sports_feed.nfl_control where enabled) then
  s:=s||jsonb_build_object('reserves_granted',true,'cards',(select coalesce(jsonb_agg(x),'[]') from jsonb_array_elements(s->'cards') x where exists(select 1 from beta_fantasy.cards c join sports_feed.nfl_players n on n.edition_id=c.edition_id where c.id=(x->>'id')::uuid)));
 end if;return s;
end$$;
revoke all on function beta_fantasy.swap_command(text,jsonb,uuid),beta_fantasy.swap_read_state() from public,anon,authenticated,docked_app;
grant execute on function beta_fantasy.swap_command(text,jsonb,uuid),beta_fantasy.swap_read_state() to docked_beta_app;
