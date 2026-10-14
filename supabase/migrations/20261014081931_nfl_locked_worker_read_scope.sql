-- The seven-slot worker reads saved rule/entry snapshots after the round locks.
-- Existing grants covered slot_locks but omitted schema/competition/entry access.
-- Read-only, column-limited and RLS-limited to registered locked NFL rounds.
-- No gameplay, ownership, credit, admission or scoring-rule write privilege.
grant usage on schema beta_fantasy to docked_nfl_worker;
grant select(id,rules) on beta_fantasy.competitions to docked_nfl_worker;
grant select(competition_id,user_id,snapshot) on beta_fantasy.entries to docked_nfl_worker;
create policy nfl_worker_locked_competition on beta_fantasy.competitions for select to docked_nfl_worker
 using(exists(select 1 from sports_feed.nfl_rounds n where n.competition_id=id and n.locked_at is not null));
create policy nfl_worker_locked_entry on beta_fantasy.entries for select to docked_nfl_worker
 using(exists(select 1 from sports_feed.nfl_rounds n where n.competition_id=entries.competition_id and n.locked_at is not null));
