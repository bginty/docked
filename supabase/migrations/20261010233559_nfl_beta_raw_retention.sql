-- Hourly bounded cleanup of new isolated NFL source payloads only. Immutable
-- guards preserve hashes, licence evidence, source identity and scoring history.
do $$begin
-- Embedded test databases lack pg_cron. Hosted installations must separately
-- verify the installed job; this does not claim a local scheduler exists.
if to_regnamespace('cron') is not null then
perform cron.schedule('docked-beta-nfl-raw-expiry','17 * * * *',
 $job$update sports_feed.raw_revisions set body=null,purged_at=clock_timestamp()
 where provider='nflverse' and body is not null and expires_at<=clock_timestamp()$job$);
end if;end$$;
