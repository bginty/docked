-- Transaction-page exclusions (released/waived evidence) require the existing
-- reviewed audit. Do not mix them into a roster-page refresh batch.
create or replace function nfl_roster.refresh_candidates() returns table(player_id text,provider_id text,team text,"position" text,name text,fantasy_position text) language sql stable security definer set search_path='' as $$
 select r.player_id,r.provider_id,r.team,r.position,p.identity->>'name',p.identity->>'position'
 from nfl_roster.current_evidence r join credits_sandbox.permanent_players p on p.id=r.player_id
 where p.sport='nfl' and r.source_url like '%/team/players-roster/'
 and exists(select 1 from nfl_roster.observations o where o.player_id=r.player_id and o.identity_verified)
$$;
