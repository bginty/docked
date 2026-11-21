-- Presentation aggregates for the verified public Owner. No customer-level output.
create function private.owner_commercial_summary(p_start timestamptz, p_end timestamptz)
returns jsonb language plpgsql stable security definer set search_path='' set statement_timeout='5s' as $$
declare result jsonb;
begin
  perform private.public_owner_actor();
  if p_start is null or p_end is null or p_start >= p_end or p_end-p_start > interval '367 days' then
    raise exception 'Invalid reporting period';
  end if;
  if not exists(select 1 from commercial_billing.control where id and environment='commercial') then
    raise exception 'Commercial reporting environment required';
  end if;
  with customers as (
    select p.id, p.created_at from public.profiles p
    where launch_transition.identity_allowed(p.id)
      and not exists (select 1 from private.roles r where r.user_id=p.id)
  ), cash as (
    select j.created_at, l.amount, r.tax_cents, r.gross_cents
    from commercial_billing.journals j
    join commercial_billing.lines l on l.journal=j.id and l.account='provider:google:receivable'
    join commercial_billing.receipts r on r.key=j.receipt and r.environment='commercial' and r.money_recorded
    where j.unit='AUD_CENTS' and j.created_at>=p_start and j.created_at<p_end
  ), days as (
    select d::date as business_day from generate_series((p_start at time zone 'Australia/Sydney')::date::timestamp,
      ((p_end - interval '1 microsecond') at time zone 'Australia/Sydney')::date::timestamp, interval '1 day') d
  ), growth as (
    select (created_at at time zone 'Australia/Sydney')::date as business_day,count(*) n from customers
    where created_at>=p_start and created_at<p_end group by 1
  ), sales as (
    select (created_at at time zone 'Australia/Sydney')::date as business_day,
      sum(greatest(amount,0)) gross, sum(greatest(-amount,0)) refunds from cash group by 1
  )
  select jsonb_build_object(
    'days',(select jsonb_agg(jsonb_build_object('day',d.business_day,'customers',coalesce(g.n,0),
      'sales',coalesce(s.gross,0),'refunds',coalesce(s.refunds,0)) order by d.business_day)
      from days d left join growth g using(business_day) left join sales s using(business_day)),
    'verified',(select count(*) from customers c where private.public_phone_verified(c.id)),
    'outstanding',(select coalesce(sum(l.remaining),0) from commercial_billing.lots l
      join commercial_billing.receipts r on r.key=l.receipt where r.environment='commercial' and r.money_recorded),
    'chargeTax',(select case when count(*)=count(tax_cents) then coalesce(sum(tax_cents),0) end from cash where amount>0),
    'pending',(select count(*) from commercial_billing.receipts where environment='commercial' and state='PENDING'),
    'packs',(select coalesce(jsonb_agg(to_jsonb(x) order by x.sport,x.type),'[]'::jsonb) from
      (select product->>'sport' sport,product->>'type' type,count(*) total from commercial_billing.packs
       where created_at>=p_start and created_at<p_end group by 1,2) x),
    'support',(select count(*) from private.owner_support_events where created_at>=p_start and created_at<p_end),
    'moderation',(select count(*) from private.social_reports where created_at>=p_start and created_at<p_end),
    'sms',(select jsonb_build_object('budget',budget_aud_cents,'reserved',reserved_aud_cents,'expires',expires_at)
      from sms_delivery.windows where enabled and allowlist is null and starts_at<=statement_timestamp()
      and expires_at>statement_timestamp() order by starts_at desc limit 1)
  ) into result;
  return result;
end$$;
revoke all on function private.owner_commercial_summary(timestamptz,timestamptz) from public, anon, authenticated, service_role, docked_beta_app, docked_commercial_app;
grant execute on function private.owner_commercial_summary(timestamptz,timestamptz) to docked_app;
