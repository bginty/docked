-- Read-only owner diagnostics. This does not approve real rosters, supply or feeds.
create function beta_private.sport_private_beta_report() returns jsonb
language plpgsql security definer set search_path='' as $$
declare d jsonb; e jsonb; answer jsonb;begin
 perform beta_private.sport_readiness_owner();
 select document into d from credits_sandbox.state where id;
 e:=d->'economy';
 with sports(sport) as (values('basketball'),('afl'),('nrl'))
 select jsonb_agg(jsonb_build_object(
  'sport',s.sport,
  'databaseEnabled',coalesce((select enabled from sports_feed.nba_beta_control where id),false)
    and (s.sport='basketball' or coalesce((select enabled from sports_feed.private_beta_sports where sport=s.sport),false)),
  'allocationEnabled',credits_sandbox.fixture_allocation_enabled(e,s.sport),
  'fictionalPlayers',(select count(*) from credits_sandbox.nba_fixture_players p where p.identity->>'sport'=s.sport),
  'freeInventoryCards',(select count(*) from sports_feed.sport_sandbox_inventory i,jsonb_array_elements(i.cards) card where i.sport=s.sport and card->>'inventory_source' is distinct from 'credits-fixture-v1'),
  'issuedTestCards',(select count(*) from credits_sandbox.nba_fixture_instances i join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId' where p.identity->>'sport'=s.sport),
  'products',(select count(*) from jsonb_each(coalesce(e->'products','{}')) p where p.value->>'sport'=s.sport and coalesce(e->'activeProductVersions','[]') ? p.key),
  'packsPurchased',(select count(*) from jsonb_each(coalesce(e->'packs','{}')) p where p.value#>>'{product,sport}'=s.sport),
  'packsOpened',(select count(*) from jsonb_each(coalesce(e->'packs','{}')) p where p.value#>>'{product,sport}'=s.sport and p.value->>'openedAt' is not null),
  'openListings',(select count(*) from jsonb_each(coalesce(d->'listings','{}')) l join credits_sandbox.nba_fixture_instances i on i.id::text=l.value->>'card' join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId' where p.identity->>'sport'=s.sport and l.value->>'status'='OPEN'),
  'settledSales',(select count(*) from jsonb_each(coalesce(d->'listings','{}')) l join credits_sandbox.nba_fixture_instances i on i.id::text=l.value->>'card' join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId' where p.identity->>'sport'=s.sport and l.value->>'status'='SOLD'),
  'recordedFees',(select coalesce(sum((l.value#>>'{receipt,fee}')::numeric),0) from jsonb_each(coalesce(d->'listings','{}')) l join credits_sandbox.nba_fixture_instances i on i.id::text=l.value->>'card' join credits_sandbox.nba_fixture_players p on p.id=i.document->>'playerId' where p.identity->>'sport'=s.sport and l.value->>'status'='SOLD'),
  'competitions',(select count(*) from beta_fantasy.competitions c where c.sport=s.sport and coalesce(c.rules->>'nba_beta_scope',c.rules->>'sport_beta_scope')='private-test-v1'),
  'entries',(select count(*) from beta_fantasy.entries x join beta_fantasy.competitions c on c.id=x.competition_id where c.sport=s.sport and coalesce(c.rules->>'nba_beta_scope',c.rules->>'sport_beta_scope')='private-test-v1')
 ) order by s.sport) into answer from sports s;
 return answer;
end$$;
revoke all on function beta_private.sport_private_beta_report() from public,anon,authenticated,service_role,docked_app,docked_beta_app;
grant execute on function beta_private.sport_private_beta_report() to docked_beta_app;
