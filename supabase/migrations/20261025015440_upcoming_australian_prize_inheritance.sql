-- New future rounds only. Existing QA rounds, entries and prize snapshots are untouched.
-- The inherited schedule stays INACTIVE and has no tie policy: no publication/award.
create function sports_feed.inherit_australian_prize_rules() returns trigger
language plpgsql security definer set search_path='' as $$
declare template jsonb;
begin
 if new.sport not in ('afl','nrl') or new.scored_at is not null
 or new.locks_at<=clock_timestamp()
 or new.rules->>'lineup_version' is distinct from 'docked-australian-owner-2026-10-24-v1-'||new.sport
 or new.rules ? 'round_reward_policy' then return new;end if;
 select configuration into template from sports_feed.australian_prize_rules
 where version='docked-australian-owner-2026-10-24-v1-'||new.sport||'-'||(new.rules->>'mode');
 if template is null then raise exception 'Approved future prize template missing';end if;
 if coalesce((template->>'active')::boolean,false) or template->>'tiePolicy' is not null then
  raise exception 'Future preparation expects inactive template; activation requires separate review';
 end if;
 new.rules:=new.rules||jsonb_build_object('round_reward_policy',template);
 return new;
end$$;
revoke all on function sports_feed.inherit_australian_prize_rules() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
create trigger australian_future_prize_rules before insert on beta_fantasy.competitions
for each row execute function sports_feed.inherit_australian_prize_rules();
