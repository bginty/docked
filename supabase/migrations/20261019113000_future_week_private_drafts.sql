-- A draft is planning, not an entry. Permit private drafts for an already
-- published/verified future round before entry opening. All kickoff, ownership,
-- revision, admission, salary and privacy checks in the existing command remain.
-- No rounds, entries, cards, credits or reservations are created by this migration.
begin;
do $$
declare source text; old_clause text := 'or c.opens_at>now_at or exists';
new_clause text := 'or (c.opens_at>now_at and action<>''seven_draft'') or exists';
begin
  source := pg_get_functiondef('sports_feed.seven_command(text,jsonb,uuid)'::regprocedure);
  if position(new_clause in source)>0 then return; end if;
  if position(old_clause in source)=0 or
     (length(source)-length(replace(source,old_clause,'')))/length(old_clause)<>1 then
    raise exception 'Unexpected seven_command definition; review future draft migration';
  end if;
  execute replace(source,old_clause,new_clause);
end $$;
commit;
