-- Scheduled worker may refresh only previously reviewed identities. It cannot
-- create player identities, alter policy, mint cards, or overwrite observations.
create function nfl_roster.refresh_candidates() returns table(player_id text,provider_id text,team text,"position" text,name text,fantasy_position text) language sql stable security definer set search_path='' as $$
 select r.player_id,r.provider_id,r.team,r.position,p.identity->>'name',p.identity->>'position'
 from nfl_roster.current_evidence r join credits_sandbox.permanent_players p on p.id=r.player_id
 where p.sport='nfl' and exists(select 1 from nfl_roster.observations o where o.player_id=r.player_id and o.identity_verified)
$$;
create function nfl_roster.record_refresh(observations jsonb) returns void language plpgsql security definer set search_path='' as $$
declare x jsonb; prior nfl_roster.observations; checked timestamptz;
begin
 if jsonb_typeof(observations)<>'array' or jsonb_array_length(observations)>110 then raise exception 'Invalid roster batch';end if;
 for x in select * from jsonb_array_elements(observations) loop
  select * into prior from nfl_roster.current_evidence where player_id=x->>'playerId';
  checked:=(x->>'checkedAt')::timestamptz;
  if prior.player_id is null or prior.provider_id is distinct from x->>'providerId' or prior.team is distinct from x->>'team'
   or prior.source_url is distinct from x->>'sourceUrl'
   or checked>clock_timestamp() or checked<clock_timestamp()-interval '10 minutes'
   or not exists(select 1 from nfl_roster.observations o where o.player_id=prior.player_id and o.identity_verified)
   or x->>'status' not in('active','reserve','practice-squad','unknown') then raise exception 'Previously verified identity and recent official source required';end if;
  insert into nfl_roster.observations(player_id,provider_id,team,position,status,identity_verified,source_url,source_hash,checked_at,evidence)
   values(prior.player_id,prior.provider_id,prior.team,x->>'position',x->>'status',(x->>'identityVerified')::boolean,prior.source_url,x->>'sourceHash',checked,x||jsonb_build_object('policy','official-nfl-roster-v1','refresh','known-identity-v1'))
   on conflict(player_id,checked_at) do nothing;
 end loop;
end $$;
revoke all on function nfl_roster.refresh_candidates(),nfl_roster.record_refresh(jsonb) from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant usage on schema nfl_roster to docked_nfl_worker;
grant execute on function nfl_roster.refresh_candidates(),nfl_roster.record_refresh(jsonb) to docked_nfl_worker;

create function nfl_roster.scoring_positions(players jsonb,observed_before timestamptz) returns table(provider_id text,"position" text) language sql stable security definer set search_path='' as $$
 select distinct on(o.provider_id) o.provider_id,o.position from nfl_roster.observations o
 join jsonb_array_elements(players) p on p->>'playerId'=o.player_id and p->>'gsisId'=o.provider_id and p->>'team'=o.team
 where o.identity_verified and o.checked_at<=observed_before and o.position like '%/%'
 order by o.provider_id,o.checked_at desc
$$;
revoke all on function nfl_roster.scoring_positions(jsonb,timestamptz) from public,anon,authenticated,service_role,docked_app;
grant execute on function nfl_roster.scoring_positions(jsonb,timestamptz) to docked_nfl_worker,docked_beta_app;
