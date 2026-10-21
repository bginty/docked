-- Isolated proposed formats only. Existing football/EPL rows are never replaced.
insert into beta_fantasy.sports(id,positions,team_size) values
 ('nrl','{"WFB":2,"CTR":2,"HLF":2,"EDG":3,"MID":3,"FLEX":1}',13),
 ('basketball','{"PG":1,"SG":1,"SF":1,"PF":1,"C":1,"FLEX":3}',8)
on conflict do nothing;
alter table sports_feed.sport_rounds drop constraint sport_rounds_sport_check;
alter table sports_feed.sport_rounds add constraint sport_rounds_sport_check check(sport in('afl','nrl','basketball','football'));
alter table sports_feed.sport_sandbox_inventory drop constraint sport_sandbox_inventory_sport_check;
alter table sports_feed.sport_sandbox_inventory add constraint sport_sandbox_inventory_sport_check check(sport in('afl','nrl','basketball','football'));
do $$declare b text;begin
 b:=pg_get_functiondef('sports_feed.round_wide_registration_guard()'::regprocedure);
 b:=replace(b,'new.sport=''afl''','new.sport in (''afl'',''nrl'',''basketball'',''football'')');execute b;
end$$;

-- A frozen period can include multiple NBA games or EPL double-gameweek games.
-- Earliest included game locks selection; every included fixture identity is saved.
create function sports_feed.lineup_player_fixture(cid uuid,pid text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare games jsonb;sid text;first_game jsonb;begin
 select sport into sid from beta_fantasy.competitions where id=cid;
 select jsonb_agg(f order by f->>'scheduledAt',f->>'fixtureId') into games from jsonb_array_elements(sports_feed.lineup_fixtures(cid)) f where f->'playerIds' ? pid;
 if games is null then return null;end if;
 if sid not in ('basketball','football') and jsonb_array_length(games)<>1 then return null;end if;
 if (select count(distinct f->>'fixtureId') from jsonb_array_elements(games)f)<>jsonb_array_length(games) then return null;end if;
 first_game:=games->0;
 if sid in ('basketball','football') then
  if exists(select 1 from jsonb_array_elements(games)f where f->>'scheduledAt' is null or coalesce(f->>'status','scheduled')<>'scheduled') then return null;end if;
  first_game:=first_game||jsonb_build_object('fixture_ids',(select jsonb_agg(f->>'fixtureId') from jsonb_array_elements(games)f));
 end if;
 return first_game;
end$$;
revoke all on function sports_feed.lineup_player_fixture(uuid,text) from public,anon,authenticated,service_role,docked_beta_app;
do $$declare b text;needle text;begin
 b:=pg_get_functiondef('sports_feed.seven_command(text,jsonb,uuid)'::regprocedure);
 needle:='if (select count(*) from jsonb_array_elements(sports_feed.lineup_fixtures(c.id)) x where x->''playerIds'' ? (card->>''player_id''))<>1 then raise exception ''Reliable unique fixture mapping required'';end if;';
 if position(needle in b)=0 then raise exception 'Unexpected fixture mapping implementation';end if;
 b:=replace(b,needle,'f:=sports_feed.lineup_player_fixture(c.id,card->>''player_id'');if f is null then raise exception ''Reliable unique fixture mapping required'';end if;');
 b:=replace(b,'select x into f from jsonb_array_elements(sports_feed.lineup_fixtures(c.id)) x where x->''playerIds'' ? (card->>''player_id'');','');
 needle:='''rules_version'',c.rules->>''scoring_version'');';
 if position(needle in b)=0 then raise exception 'Unexpected snapshot implementation';end if;
 b:=replace(b,needle,needle||'if c.sport<>''nfl'' then card:=card||jsonb_build_object(''fixture_ids'',coalesce(f->''fixture_ids'',jsonb_build_array(f->>''fixtureId'')));end if;');
 execute b;
 -- Rollover uses identical mapping rules; missing/exceptional fixtures are flagged.
 b:=pg_get_functiondef('sports_feed.seven_continue_teams()'::regprocedure);
 b:=replace(b,'(select count(*) from jsonb_array_elements(sports_feed.lineup_fixtures(target.id)) f where f->''playerIds'' ? (card->>''player_id''))<>1','sports_feed.lineup_player_fixture(target.id,card->>''player_id'') is null');
 b:=replace(b,'select f into fixture from jsonb_array_elements(sports_feed.lineup_fixtures(target.id)) f where f->''playerIds'' ? (card->>''player_id'');','fixture:=sports_feed.lineup_player_fixture(target.id,card->>''player_id'');');
 execute b;
end$$;
-- Extend the existing private simulation journal; keep its immutable chain,
-- simulated-only constraint and all existing role restrictions.
alter table scoring_beta.rules drop constraint rules_sport_check;
alter table scoring_beta.rules add constraint rules_sport_check check (sport in ('epl','nfl','afl','nrl','basketball'));
alter table scoring_beta.streams drop constraint streams_sport_check;
alter table scoring_beta.streams add constraint streams_sport_check check (sport in ('epl','nfl','afl','nrl','basketball'));
