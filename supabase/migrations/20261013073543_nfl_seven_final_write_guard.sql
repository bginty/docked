-- Recheck at the write boundary, after any time spent validating the payload.
-- Entry_guard first materialises already-selected locks. A newly started card
-- can never enter through a request that crossed kickoff during validation.
create function sports_feed.seven_final_write_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from beta_fantasy.competitions where id=new.competition_id and rules->>'lineup_version' is not null) and exists(
  select 1 from jsonb_array_elements(new.snapshot) s
  where (s->>'kickoff')::timestamptz<=clock_timestamp() and not exists(
   select 1 from beta_fantasy.slot_locks l where l.competition_id=new.competition_id and l.user_id=new.user_id and l.slot=s->>'slot' and l.snapshot=s
  )
 ) then raise exception 'Kickoff crossed during save. Refresh: newly started players cannot be added';end if;
 return new;
end$$;
create trigger zz_seven_final_write before insert or update on beta_fantasy.entries for each row execute function sports_feed.seven_final_write_guard();
revoke all on function sports_feed.seven_final_write_guard() from public,anon,authenticated,service_role,docked_beta_app;
