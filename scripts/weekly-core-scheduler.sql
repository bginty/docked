-- Operator script, NOT an automatic migration. Run only on the approved target
-- after recovery verification. Creates an INACTIVE job; issues no entitlements.
-- pg_cron is already available on Docked's Supabase production project.
do $$begin
 if not exists(select 1 from pg_extension where extname='pg_cron') then
  raise exception 'Enable the existing Supabase Cron integration before scheduling';
 end if;
end$$;
begin;
select cron.schedule('docked-weekly-core-entitlements','* * * * *','select sports_feed.weekly_core_job();');
select cron.alter_job(job_id := (select jobid from cron.job where jobname='docked-weekly-core-entitlements'),active := false);
commit;
-- Separate approved activation transaction:
--   update sports_feed.weekly_core_control set enabled=true where id;
--   select sports_feed.weekly_core_job();
--   select cron.alter_job(job_id := (...same job...),active := true);
-- Also set DOCKED_WEEKLY_CORE_ENABLED=true on the approved app deployment.
-- Verify cron.job_run_details succeeded AND weekly_core_job_runs completed.
-- Pausing the job/control never deletes schedules, history, cards or receipts.
