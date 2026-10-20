-- Run only after configuring the server worker and securely storing CRON_SECRET
-- as Vault secret docked_sale_push_cron. Never paste a secret into this script.
-- The existing in-app receipt job is independent and must remain enabled.
do $$
begin
 if not exists(select 1 from pg_extension where extname='pg_net') then raise exception 'pg_net is required'; end if;
 if not exists(select 1 from vault.decrypted_secrets where name='docked_sale_push_cron') then raise exception 'Missing Vault cron credential'; end if;
 perform cron.schedule('docked-sale-push','* * * * *', $job$
  select net.http_get(
   url := 'https://docked.com.au/api/internal/sale-push',
   headers := jsonb_build_object('Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='docked_sale_push_cron')),
   timeout_milliseconds := 50000
  );
 $job$);
end $$;
