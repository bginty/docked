-- Hourly bounded cleanup of new isolated NFL source payloads only. Immutable
-- guards preserve hashes, licence evidence, source identity and scoring history.
select cron.schedule('docked-beta-nfl-raw-expiry','17 * * * *',
 $job$update sports_feed.raw_revisions set body=null,purged_at=clock_timestamp()
 where provider='nflverse' and body is not null and expires_at<=clock_timestamp()$job$);
