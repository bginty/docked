-- Real roster facts, isolated ownership. No permanent issuance or member activation.
-- Registry insertion remains operator-only. Existing synthetic identities/history stay immutable.
create function credits_sandbox.is_roster_beta_player(p jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(p->>'inventoryClass'='real-roster-beta-v1' and p->'synthetic'='false'::jsonb
  and p->>'sport' in ('basketball','afl','nrl') and p->>'provider'='wikimedia'
  and p->>'assetKind'='player'
  and p->'rosterBeta'->>'wikidataId' ~ '^Q[1-9][0-9]*$'
  and p->>'id'=(case when p->>'sport'='basketball' then 'nba' else p->>'sport' end)||'-roster-beta-'||(p->'rosterBeta'->>'wikidataId')
  and p->>'providerId'=(p->>'sport')||':'||(p->'rosterBeta'->>'wikidataId')
  and p->>'fixturePlayerId'=p->'rosterBeta'->>'canonicalPlayerId'
  and p->>'fixturePlayerId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and p->'rosterBeta'->>'sourceHash' ~ '^[0-9a-f]{64}$'
  and p->'rosterBeta'->>'license'='CC-BY-SA-4.0'
  and p->'rosterBeta'->>'verification'='roster-and-profile-agreement'
  and p->'rosterBeta'->'permanentIssuanceEligible'='false'::jsonb
  and p->'rosterBeta'->>'rosterSource' like 'https://en.wikipedia.org/%'
  and p->'rosterBeta'->>'profileSource' like 'https://en.wikipedia.org/%'
  and p->'rosterBeta'->>'verifiedAt' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T'
  and p->>'position'=any(case p->>'sport' when 'basketball' then array['PG','SG','SF','PF','C'] when 'afl' then array['DEF','MID','FWD','RUC'] else array['WFB','CTR','HLF','EDG','MID'] end),false)
$$;
revoke all on function credits_sandbox.is_roster_beta_player(jsonb) from public,anon,authenticated,service_role;
grant execute on function credits_sandbox.is_roster_beta_player(jsonb) to docked_beta_app;

do $$declare definition text;begin
 select pg_get_constraintdef(oid) into definition from pg_constraint
 where conrelid='credits_sandbox.nba_fixture_players'::regclass and conname='isolated_sport_fixture_identity';
 if definition is null then raise exception 'Expected isolated player registry';end if;
 alter table credits_sandbox.nba_fixture_players drop constraint isolated_sport_fixture_identity;
 execute 'alter table credits_sandbox.nba_fixture_players add constraint isolated_sport_fixture_identity CHECK ('||substring(definition from 7)||' OR (identity->>''id''=id AND credits_sandbox.is_roster_beta_player(identity)))';
end$$;

-- Owner counts distinguish real source-verified rosters from earlier fictional test records.
do $$declare b text;needle text;begin
 b:=pg_get_functiondef('beta_private.sport_private_beta_report()'::regprocedure);
 needle:='''fictionalPlayers'',(select count(*) from credits_sandbox.nba_fixture_players p where p.identity->>''sport''=s.sport)';
 if position(needle in b)=0 then raise exception 'Unexpected private beta report';end if;
 b:=replace(b,needle,'''fictionalPlayers'',(select count(*) from credits_sandbox.nba_fixture_players p where p.identity->>''sport''=s.sport and p.identity->''synthetic''=''true''::jsonb),''realRosterPlayers'',(select count(*) from credits_sandbox.nba_fixture_players p where p.identity->>''sport''=s.sport and credits_sandbox.is_roster_beta_player(p.identity)),''verifiedRosterTeams'',(select count(distinct p.identity->>''currentTeam'') from credits_sandbox.nba_fixture_players p where p.identity->>''sport''=s.sport and credits_sandbox.is_roster_beta_player(p.identity))');
 execute b;
end$$;
alter table credits_sandbox.permanent_players add constraint no_roster_beta_permanent_identity
 check(identity->>'inventoryClass' is distinct from 'real-roster-beta-v1');

do $$declare b text;needle text;begin
 b:=pg_get_functiondef('credits_sandbox.guard_economy_state()'::regprocedure);
 needle:='item.value->''synthetic''=''true''::jsonb';
 if position(needle in b)=0 then raise exception 'Unexpected player registry route';end if;
 b:=replace(b,needle,'(item.value->''synthetic''=''true''::jsonb or credits_sandbox.is_roster_beta_player(item.value))');
 needle:='e->''players''->(item.value->>''playerId'')->''synthetic''=''true''::jsonb';
 if position(needle in b)=0 then raise exception 'Unexpected allocation registry route';end if;
 b:=replace(b,needle,'(e->''players''->(item.value->>''playerId'')->''synthetic''=''true''::jsonb or credits_sandbox.is_roster_beta_player(e->''players''->(item.value->>''playerId'')))');
 b:=replace(b,'Registered synthetic NBA identity required','Registered isolated player identity required');
 needle:='if (coalesce(e->''retiredTestInstances'',''{}'') || (e->''instances''))->(d#>>''{}'')->>''source''';
 if position(needle in b)=0 then raise exception 'Unexpected pack allocation verification';end if;
 b:=replace(b,needle,'if item.value->''product''->>''inventoryScope''=''real-roster-beta-v1'' and not credits_sandbox.is_roster_beta_player(e->''players''->(e->''instances''->(d#>>''{}'')->>''playerId'')) then raise exception ''Real-roster test pack requires verified isolated inventory'';end if; '||needle);
 execute b;

 b:=pg_get_functiondef('credits_sandbox.project_fixture_inventory()'::regprocedure);
 needle:='''season'',''SYNTHETIC TEST''';
 if position(needle in b)=0 then raise exception 'Unexpected inventory projection';end if;
 b:=replace(b,needle,'''season'',case when credits_sandbox.is_roster_beta_player(p.identity) then ''REAL PLAYER · BETA INVENTORY'' else ''SYNTHETIC TEST'' end,''inventory_class'',p.identity->>''inventoryClass'',''roster_source'',p.identity->''rosterBeta''');
 execute b;

 b:=pg_get_functiondef('credits_sandbox.fixture_trade_allowed(jsonb,jsonb,text[])'::regprocedure);
 needle:='p->''synthetic'' is distinct from ''true''::jsonb';
 if position(needle in b)=0 then raise exception 'Unexpected test trade boundary';end if;
 b:=replace(b,needle,'(p->''synthetic'' is distinct from ''true''::jsonb and not credits_sandbox.is_roster_beta_player(p))');
 execute b;
end$$;
