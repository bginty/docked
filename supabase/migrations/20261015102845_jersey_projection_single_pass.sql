-- Parse each retained roster once, rather than once per catalogue player.
-- Same current-source, name/team, freshness and conflicting-number rules.
-- Presentation only: no member, wallet, edition or scoring writes.
create or replace view credits_sandbox.current_player_jerseys with (security_barrier=true) as
with current_players as materialized (
 select c.id,c.team,c.name,c.checked_at,c.raw_id,p.provider_id
 from credits_sandbox.current_player_status c
 join credits_sandbox.permanent_players p on p.id=c.id and p.provider='nflverse' and p.sport='nfl'
 where c.checked_at<=clock_timestamp() and c.checked_at>clock_timestamp()-interval '72 hours'
), sources as materialized (
 select r.id::text raw_id,r.body
 from sports_feed.raw_revisions r
 join (select distinct raw_id from current_players) c on c.raw_id=r.id::text
 where r.provider='nflverse' and r.body->>'dataset'='rosters' and r.expires_at>clock_timestamp()
), observations as materialized (
 select s.raw_id,v.gsis_id,v.team,v.full_name,
 case when v.jersey_number ~ '^[0-9]{1,2}$' then v.jersey_number::int end value
 from sources s cross join lateral jsonb_to_recordset(s.body->'rows')
 v(gsis_id text,team text,full_name text,jersey_number text)
)
select c.id,c.team,c.checked_at,
 case when count(*)=count(n.value) and count(distinct n.value)=1 then min(n.value) else null end verified_jersey_number
from current_players c join observations n
 on n.raw_id=c.raw_id and n.gsis_id=c.provider_id and n.team=c.team and n.full_name=c.name
group by c.id,c.team,c.checked_at;
-- CREATE OR REPLACE preserves existing narrow view grants and owner.
-- Roll back the application before reverting this query; no data restore is needed.
