-- PROPOSAL ONLY. Separate exact founder approval; not an automatic migration.
-- Password and LOGIN are installed securely only in the approved operator step.
do $$begin
 if current_user<>'postgres' then raise exception 'Reviewed operator required';end if;
 if not exists(select 1 from pg_roles where rolname='docked_commercial_app'
  and not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb)
 then raise exception 'Expected restricted commercial group required';end if;
 if exists(select 1 from pg_roles where rolname='docked_commercial_runtime')
 then raise exception 'Runtime already exists: inspect, never overwrite its password or permissions';end if;
 if not exists(select 1 from commercial_billing.control where id and environment='commercial'
  and not sales_enabled and not issuance_enabled and not transfers_enabled and not gameplay_enabled)
 then raise exception 'Closed Production commercial controls required';end if;
 if exists(select 1 from commercial_billing.receipts) or exists(select 1 from commercial_billing.accounts)
 then raise exception 'Initial dormant setup requires empty commercial account/receipt baseline';end if;
end$$;
create role docked_commercial_runtime nologin nosuperuser nocreatedb nocreaterole
 inherit noreplication nobypassrls connection limit 6;
grant docked_commercial_app to docked_commercial_runtime with admin false, inherit true, set false;
-- No new table/schema/function permission, ownership, RLS bypass or outbox grant.
