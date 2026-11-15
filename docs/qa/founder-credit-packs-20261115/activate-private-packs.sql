-- Only the exact reviewed private-beta package. Execute in the approved operator
-- transaction after application promotion, drift checks and frozen adoption.
select pg_advisory_xact_lock(71820342);
do $$begin
 if coalesce(length(current_setting('docked.beta_pack_approval',true)),0)<21 then raise exception 'Exact founder deployment approval reference required';end if;
 if (select count(*) from beta_packs.members)<>4 or (select count(*) from beta_packs.definitions)<>6050
 or (select count(*) from beta_packs.products)<>18 or exists(select 1 from beta_packs.issued)
 or exists(select 1 from commercial_billing.control where sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled)
 or exists(select 1 from commercial_billing.definitions where approved)
 or (select sum(issued) from commercial_billing.definitions)<>888
 then raise exception 'Reviewed private-beta activation baseline drift';end if;
 if (select count(*) from beta_packs.members m where beta_packs.member_allowed(m.member_id))<>4
 then raise exception 'Existing beta admission changed';end if;
end$$;
update beta_packs.control set enabled=true,grants_enabled=true,
 authority_reference=current_setting('docked.beta_pack_approval',true) where id;
-- No grant, purchase, card, payment, registration or trade is executed here.
