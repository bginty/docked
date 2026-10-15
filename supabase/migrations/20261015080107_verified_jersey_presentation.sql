-- Presentation only. No identity, ownership, edition, entry or scoring writes.
-- Reuse the approved roster observation and its existing 72-hour freshness rule.
create view credits_sandbox.current_player_jerseys with (security_barrier=true) as
select c.id,c.team,c.checked_at,
 case when count(*)=count(n.value) and count(distinct n.value)=1 then min(n.value) else null end verified_jersey_number
from credits_sandbox.current_player_status c
join credits_sandbox.permanent_players p on p.id=c.id and p.provider='nflverse' and p.sport='nfl'
join sports_feed.raw_revisions r on r.id::text=c.raw_id and r.provider='nflverse' and r.body->>'dataset'='rosters' and r.expires_at>clock_timestamp()
cross join lateral jsonb_array_elements(r.body->'rows') row
cross join lateral (select case when row->>'jersey_number' ~ '^[0-9]{1,2}$' then (row->>'jersey_number')::int end value) n
where row->>'gsis_id'=p.provider_id and row->>'team'=c.team and row->>'full_name'=c.name
 and c.checked_at<=clock_timestamp() and c.checked_at>clock_timestamp()-interval '72 hours'
group by c.id,c.team,c.checked_at;
revoke all on credits_sandbox.current_player_jerseys from public,anon,authenticated,service_role;
grant select on credits_sandbox.current_player_jerseys to docked_beta_app;
-- Rollback: remove the presentation reads first, then drop this view. No data restoration.
