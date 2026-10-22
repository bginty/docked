-- Extend the same isolated fixture registry; its historical NBA table names are
-- retained to avoid duplicate ledgers or breaking the previous review tooling.
-- No permanent rows, wallet records, runtime write grants or activation changes.
alter table credits_sandbox.nba_fixture_players drop constraint nba_fixture_players_id_check;
alter table credits_sandbox.nba_fixture_players drop constraint nba_fixture_players_check;
alter table credits_sandbox.nba_fixture_players add constraint isolated_sport_fixture_identity check(coalesce(
 identity->>'id'=id and identity->>'provider'='fixture' and identity->'synthetic'='true'::jsonb
 and identity->>'assetKind'='player' and (
  (identity->>'sport'='basketball' and id like 'nba-fixture-%' and identity->>'providerId' like 'nba-fixture-%' and identity->>'position' in ('PG','SG','SF','PF','C'))
  or (identity->>'sport'='afl' and id like 'afl-fixture-%' and identity->>'providerId' like 'afl-fixture-%' and identity->>'position' in ('DEF','MID','FWD','RUC'))
  or (identity->>'sport'='nrl' and id like 'nrl-fixture-%' and identity->>'providerId' like 'nrl-fixture-%' and identity->>'position' in ('WFB','CTR','HLF','EDG','MID'))
 ),false));

create function credits_sandbox.fixture_allocation_enabled(e jsonb,sport text) returns boolean language sql immutable set search_path='' as $$
 select coalesce(case when sport='basketball' then e->'nbaTestAllocation'->>'enabled'='true' and e->'nbaTestAllocation'->>'scope'='isolated-fixtures-v1'
 when sport in ('afl','nrl') then e->'fixtureTestAllocation'->sport->>'enabled'='true' and e->'fixtureTestAllocation'->sport->>'scope'='isolated-fixtures-v1' else false end,false)
$$;
create function credits_sandbox.assert_sport_fixture_member(member text,sport text) returns void language plpgsql security definer set search_path='' as $$begin
 perform sports_feed.private_beta_sport_identity();
 if sport is distinct from sports_feed.private_beta_sport() then raise exception 'Fixture sport context mismatch';end if;
 perform credits_sandbox.assert_nba_fixture_member(member);
end$$;

create function sports_feed.fixture_commerce_capability(sport text) returns boolean language plpgsql stable security definer set search_path='' as $$begin
 if current_setting('docked.fixture_commerce',true) is distinct from 'enabled' or sport not in ('basketball','afl','nrl') then return false;end if;
 perform sports_feed.nba_beta_identity();
 return coalesce(sport='basketball' or (current_setting('docked.sports_private_beta',true)='enabled' and exists(select 1 from sports_feed.private_beta_sports where private_beta_sports.sport=fixture_commerce_capability.sport and enabled)),false);
 exception when raise_exception then return false;
end$$;
revoke all on function sports_feed.fixture_commerce_capability(text) from public,anon,authenticated,service_role,docked_beta_app;
grant execute on function sports_feed.fixture_commerce_capability(text) to docked_beta_app;
revoke all on function credits_sandbox.fixture_allocation_enabled(jsonb,text),credits_sandbox.assert_sport_fixture_member(text,text) from public,anon,authenticated,service_role,docked_beta_app;
grant execute on function credits_sandbox.fixture_allocation_enabled(jsonb,text),credits_sandbox.assert_sport_fixture_member(text,text) to docked_beta_app;

do $$declare b text;needle text;begin
 b:=pg_get_functiondef('credits_sandbox.guard_economy_state()'::regprocedure);
 needle:='fixture boolean;begin';
 if position(needle in b)=0 then raise exception 'Unexpected fixture guard version';end if;
 b:=replace(b,needle,'fixture boolean;fixture_sport text;begin');
 needle:=' if e->>''enabled''=''true''';
 b:=replace(b,needle,' if current_user=''docked_beta_app'' and previous->''fixtureTestAllocation'' is distinct from e->''fixtureTestAllocation'' then raise exception ''Operator fixture activation required'';end if;'||needle);
 b:=replace(b,'item.value->>''sport''=''basketball''','item.value->>''sport'' in (''basketball'',''afl'',''nrl'')');
 b:=replace(b,'e->''players''->(item.value->>''playerId'')->>''sport''=''basketball''','e->''players''->(item.value->>''playerId'')->>''sport'' in (''basketball'',''afl'',''nrl'')');
 b:=replace(b,'  if fixture then','  fixture_sport:=e->''players''->(item.value->>''playerId'')->>''sport''; if fixture then');
 b:=replace(b,'e->''packs''->(item.value->>''source'')->''product''->>''sport'' is distinct from ''basketball''','e->''packs''->(item.value->>''source'')->''product''->>''sport'' is distinct from fixture_sport');
 b:=replace(b,'e->''nbaTestAllocation''->>''enabled'' is distinct from ''true''','not credits_sandbox.fixture_allocation_enabled(e,fixture_sport)');
 b:=replace(b,'credits_sandbox.assert_nba_fixture_member(new.document->''commerce''->''cards''->item.key->>''owner'')','credits_sandbox.assert_sport_fixture_member(new.document->''commerce''->''cards''->item.key->>''owner'',fixture_sport)');
 b:=replace(b,'credits_sandbox.assert_nba_fixture_member(old.document->''commerce''->''cards''->item.key->>''owner'')','credits_sandbox.assert_sport_fixture_member(old.document->''commerce''->''cards''->item.key->>''owner'',fixture_sport)');
 b:=replace(b,'  if item.value->''product''->>''sport''=''basketball'' and previous->''packs''->item.key is distinct from item.value then','  fixture_sport:=item.value->''product''->>''sport''; if fixture_sport in (''basketball'',''afl'',''nrl'') and previous->''packs''->item.key is distinct from item.value then');
 b:=replace(b,'credits_sandbox.assert_nba_fixture_member(item.value->>''member'')','credits_sandbox.assert_sport_fixture_member(item.value->>''member'',fixture_sport)');
 b:=replace(b,'item.value->''product''->>''sport''=''basketball'' and e->''players''->(e->''instances''->(d#>>''{}'')->>''playerId'')->>''sport'' is distinct from ''basketball''','fixture_sport in (''basketball'',''afl'',''nrl'') and e->''players''->(e->''instances''->(d#>>''{}'')->>''playerId'')->>''sport'' is distinct from fixture_sport');
 execute b;
end$$;
