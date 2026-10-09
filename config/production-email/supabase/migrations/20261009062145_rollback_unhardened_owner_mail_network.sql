-- Roll back only this task's unused pg_net installation after its managed
-- request-queue permissions failed the owner email acceptance check.
-- No CASCADE: dependencies stop rollback rather than removing user objects.
-- The preflight requires a disabled scheduler, no cron jobs and an empty queue.
do $$ begin
 if (select enabled from private.docked_mail_scheduler)
 or exists(select 1 from cron.job)
 or exists(select 1 from net.http_request_queue)
 then raise exception 'Unused extension rollback preconditions failed'; end if;
end $$;
drop extension pg_net restrict;
