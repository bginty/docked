-- New catalogue rows are inert until a separately approved SKU activation.
insert into commercial_billing.products(id,credits,aud_cents,version,approved)
values ('docked_credits_700_v1',700,700,'au-affordable-credits-2026-11-21-v1',false),
       ('docked_credits_1900_v1',1900,1900,'au-affordable-credits-2026-11-21-v1',false)
on conflict (id) do nothing;
do $$
begin
  if (select count(*) from commercial_billing.products p
      join (values ('docked_credits_700_v1',700),('docked_credits_1900_v1',1900)) expected(id,n)
        on p.id=expected.id and p.credits=expected.n and p.aud_cents=expected.n
      where p.version='au-affordable-credits-2026-11-21-v1' and not p.approved) <> 2 then
    raise exception 'Affordable product baseline differs from inactive reviewed configuration';
  end if;
end $$;
