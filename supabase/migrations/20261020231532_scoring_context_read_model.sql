-- Additive read projection only. Preserve every existing visibility/session guard,
-- locked snapshot join and authoritative journal value. No result backfill.
do $$declare source text; begin
 source:=replace(pg_get_functiondef('sports_feed.game_day_standings()'::regprocedure),chr(13),'');
 if position('''competitionId'',c.id,''label'',c.name' in source)=0
 or position('''serial'',card.value->''serial''' in source)=0 then
   raise exception 'Unexpected standings projection';
 end if;
 source:=replace(source,'sports_feed.game_day_standings()', 'sports_feed.game_day_standings_scoring()');
 source:=replace(source,'''competitionId'',c.id,''label'',c.name',
 '''scoringVersion'',coalesce(j.body#>>''{period,rules,version}'',sr.rules->>''version''),
 ''receptionCentipoints'',coalesce(j.body#>''{period,rules,weights,receptions}'',sr.rules#>''{weights,receptions}''),
 ''rarityVersion'',coalesce(j.body#>>''{period,rules,rarityVersion}'',sr.rules->>''rarityVersion''),
 ''competitionId'',c.id,''label'',c.name');
 source:=replace(source,'''serial'',card.value->''serial''',
 '''cardId'',coalesce(card.value->>''card_id'',card.value->>''id''),
 ''playerId'',card.value->>''player_id'',
 ''scoreUpdatedAt'',case when coalesce(rc.standings_visible,true) then (select max(m->>''updatedAt'') from jsonb_array_elements(player.value->''matches'')m) else null end,
 ''serial'',card.value->''serial''');
 source:=replace(source,
 '''multiplier'',coalesce((card.value->>''multiplierTenths'')::numeric/10,(card.value->>''multiplier'')::numeric)',
 '''multiplier'',case when coalesce(j.body#>>''{period,rules,rarityVersion}'',sr.rules->>''rarityVersion'') is not null then player.value->''multiplier'' else null end');
 execute source;
end $$;
revoke all on function sports_feed.game_day_standings_scoring() from public,anon,authenticated,service_role,docked_app;
grant execute on function sports_feed.game_day_standings_scoring() to docked_beta_app;
