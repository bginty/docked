-- Catalogue identities for community tags only. No feed, price, settlement,
-- fantasy inventory, region policy or publication authority is granted.
insert into private.sports(id,name,enabled)
values('nfl','American football',false) on conflict(id) do nothing;

insert into private.competitions(id,sport_id,enabled,rules)
values('americanfootball_nfl','nfl',false,
  '{"catalogueOnly":true,"marketScope":"fixtures_only"}'::jsonb)
on conflict(id) do nothing;

do $$ begin
  if not exists(select 1 from private.competitions
    where id='americanfootball_nfl' and sport_id='nfl') then
    raise exception 'NFL catalogue identity mismatch';
  end if;
end $$;
