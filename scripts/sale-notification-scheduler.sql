-- Run on the reviewed deployment target after applying member_platform_updates.
-- Delivers existing settled receipts only. No purchases, transfers or wallet changes.
-- Remains inactive until release activation; no additional service is required.
begin;
do $$begin
 if not exists(select 1 from pg_extension where extname='pg_cron') then
  raise exception 'Existing Supabase Cron integration is required';
 end if;
end$$;
select cron.schedule('docked-sale-receipts','* * * * *','select credits_sandbox.deliver_sale_receipts();');
select cron.alter_job(job_id := (select jobid from cron.job where jobname='docked-sale-receipts'),active := false);
commit;
-- At release: enable this job; verify job_run_details and outbox delivered_at.
-- Member notification reads also reconcile that member's outstanding receipts.
