-- Read-only projection. No scoring journal, entry, lock or final result writes.
-- A completed game alone does not prove an absent player's participation.
do $$
declare definition text; old_predicate text; new_predicate text;
begin
 definition:=pg_get_functiondef('sports_feed.game_day_standings_scoring()'::regprocedure);
 old_predicate:='m->>''sourceStatus'' is distinct from ''completed'' or m->''score'' is null or m->''score''=''null''::jsonb';
 new_predicate:=old_predicate||' or m->>''availability'' not in (''complete'',''confirmed-dnp'',''bye'')';
 if position(new_predicate in definition)=0 then
   if (length(definition)-length(replace(definition,old_predicate,'')))/length(old_predicate)<>2 then
     raise exception 'Unexpected NFL completion projection';
   end if;
   execute replace(definition,old_predicate,new_predicate);
 end if;
end $$;
-- Existing session, ownership, publication and MFA policies remain intact.
revoke all on function sports_feed.game_day_standings_scoring() from public,anon,authenticated,service_role,docked_app;
grant execute on function sports_feed.game_day_standings_scoring() to docked_beta_app;
