-- Read-only assertions; run inside the reviewed transaction before new DDL.
do $$declare f text; expected text;begin
 for f,expected in select * from (values
 ('sports_feed.open_weekly_core(uuid,uuid)','33a0aaac30ad023af4a2d4b8db1a8755'),
 ('sports_feed.open_weekly_core(uuid,uuid,text)','bf061bf7061ff4810da178abcdd01880'),
 ('nfl_roster.guard_mint()','5ddbd6f7413e2adc41edf6f4fe00fb07'),
 ('beta_fantasy.card_guard()','5c1ea3ad3ca5d529df0cac81affcc57d')) v(f,h) loop
  if md5(pg_get_functiondef(f::regprocedure))<>expected then raise exception 'Reviewed function drift: %',f;end if;
 end loop;
 if to_regnamespace('season_catalogue') is not null then raise exception 'Catalogue already present; stop, do not repeat';end if;
 if not exists(select 1 from commercial_billing.control where id and not sales_enabled and not issuance_enabled and not transfers_enabled and not gameplay_enabled)
 or exists(select 1 from commercial_billing.products where approved)
 or exists(select 1 from commercial_billing.definitions where approved)
 then raise exception 'Commercial controls must stay closed';end if;
 if (select count(*) from commercial_billing.definitions)<>6540 or (select sum(issued) from commercial_billing.definitions)<>888
 then raise exception 'Lifetime baseline differs';end if;
 if exists(select 1 from commercial_billing.definitions d where d.issued<>d.legacy_issued+(select count(*) from commercial_billing.cards c where c.definition=d.id)) then raise exception 'Lifetime issuance reconciliation failed';end if;
end$$;
