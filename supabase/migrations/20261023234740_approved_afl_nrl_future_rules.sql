-- Additive approved future configurations; no competition is selected or activated.
-- Existing QA units, confirmed entries, drafts, scoring rules and prizes remain unchanged.
create table sports_feed.australian_prize_rules (
 version text primary key, sport text not null check(sport in ('afl','nrl')),
 configuration jsonb not null, created_at timestamptz not null default clock_timestamp()
);
alter table sports_feed.australian_prize_rules enable row level security;
revoke all on sports_feed.australian_prize_rules from public,anon,authenticated,service_role,docked_app,docked_beta_app;
insert into beta_fantasy.lineup_configurations(version,configuration)values('docked-australian-owner-2026-10-24-v1-afl','{"version":"docked-australian-owner-2026-10-24-v1-afl","sport":"afl","inventoryScope":"isolated-multi-sport-v1","salaryCap":13800000,"salaries":{"CORE":500000,"RARE":600000,"ELITE":650000,"ULTRA_RARE":700000,"LEGENDARY":800000,"ICON":800000},"slots":[{"id":"BACK1","positions":["DEF"]},{"id":"BACK2","positions":["DEF"]},{"id":"BACK3","positions":["DEF"]},{"id":"BACK4","positions":["DEF"]},{"id":"BACK5","positions":["DEF"]},{"id":"BACK6","positions":["DEF"]},{"id":"MID1","positions":["MID"]},{"id":"MID2","positions":["MID"]},{"id":"MID3","positions":["MID"]},{"id":"MID4","positions":["MID"]},{"id":"MID5","positions":["MID"]},{"id":"MID6","positions":["MID"]},{"id":"MID7","positions":["MID"]},{"id":"MID8","positions":["MID"]},{"id":"FWD1","positions":["FWD"]},{"id":"FWD2","positions":["FWD"]},{"id":"FWD3","positions":["FWD"]},{"id":"FWD4","positions":["FWD"]},{"id":"FWD5","positions":["FWD"]},{"id":"FWD6","positions":["FWD"]},{"id":"RUCK1","positions":["RUC"]},{"id":"RUCK2","positions":["RUC"]}],"entryPolicy":"before-first-kickoff","lockPolicy":"round-wide-v1","commerciallyApproved":false,"salaryUnit":"fantasy-dollars"}'::jsonb);
insert into sports_feed.australian_prize_rules(version,sport,configuration)values('docked-australian-owner-2026-10-24-v1-afl-SALARY_CAP','afl','{"version":"docked-australian-owner-2026-10-24-v1-afl-SALARY_CAP","sport":"afl","mode":"SALARY_CAP","scope":"weekly","active":false,"tiePolicy":null,"season":"To be announced","items":[{"from":1,"to":1,"type":"credits","amount":25000,"description":"25,000 Docked Credits"},{"from":2,"to":2,"type":"credits","amount":10000,"description":"10,000 Docked Credits"},{"from":2,"to":2,"type":"pack","amount":5,"productVersion":"standard-9-afl-real-roster-beta-v1","description":"Standard 9 Pack AFL"},{"from":3,"to":3,"type":"pack","amount":5,"productVersion":"standard-9-afl-real-roster-beta-v1","description":"Standard 9 Pack AFL"}]}'::jsonb);
insert into sports_feed.australian_prize_rules(version,sport,configuration)values('docked-australian-owner-2026-10-24-v1-afl-OPEN','afl','{"version":"docked-australian-owner-2026-10-24-v1-afl-OPEN","sport":"afl","mode":"OPEN","scope":"weekly","active":false,"tiePolicy":null,"season":"To be announced","items":[{"from":1,"to":1,"type":"credits","amount":100000,"description":"100,000 Docked Credits"},{"from":2,"to":2,"type":"credits","amount":25000,"description":"25,000 Docked Credits"},{"from":2,"to":2,"type":"pack","amount":5,"productVersion":"premium-9-afl-real-roster-beta-v1","description":"Premium 9 Pack AFL"},{"from":3,"to":3,"type":"pack","amount":5,"productVersion":"premium-9-afl-real-roster-beta-v1","description":"Premium 9 Pack AFL"}]}'::jsonb);
insert into beta_fantasy.lineup_configurations(version,configuration)values('docked-australian-owner-2026-10-24-v1-nrl','{"version":"docked-australian-owner-2026-10-24-v1-nrl","sport":"nrl","inventoryScope":"isolated-multi-sport-v1","salaryCap":8200000,"salaries":{"CORE":500000,"RARE":600000,"ELITE":650000,"ULTRA_RARE":700000,"LEGENDARY":800000,"ICON":800000},"slots":[{"id":"WFB1","positions":["WFB"]},{"id":"WFB2","positions":["WFB"]},{"id":"CTR1","positions":["CTR"]},{"id":"CTR2","positions":["CTR"]},{"id":"HLF1","positions":["HLF"]},{"id":"HLF2","positions":["HLF"]},{"id":"EDG1","positions":["EDG"]},{"id":"EDG2","positions":["EDG"]},{"id":"EDG3","positions":["EDG"]},{"id":"MID1","positions":["MID"]},{"id":"MID2","positions":["MID"]},{"id":"MID3","positions":["MID"]},{"id":"FLEX1","positions":["WFB","CTR","HLF","EDG","MID"]}],"entryPolicy":"before-first-kickoff","lockPolicy":"round-wide-v1","commerciallyApproved":false,"salaryUnit":"fantasy-dollars"}'::jsonb);
insert into sports_feed.australian_prize_rules(version,sport,configuration)values('docked-australian-owner-2026-10-24-v1-nrl-SALARY_CAP','nrl','{"version":"docked-australian-owner-2026-10-24-v1-nrl-SALARY_CAP","sport":"nrl","mode":"SALARY_CAP","scope":"weekly","active":false,"tiePolicy":null,"season":"To be announced","items":[{"from":1,"to":1,"type":"credits","amount":25000,"description":"25,000 Docked Credits"},{"from":2,"to":2,"type":"credits","amount":10000,"description":"10,000 Docked Credits"},{"from":2,"to":2,"type":"pack","amount":5,"productVersion":"standard-9-nrl-real-roster-beta-v1","description":"Standard 9 Pack NRL"},{"from":3,"to":3,"type":"pack","amount":5,"productVersion":"standard-9-nrl-real-roster-beta-v1","description":"Standard 9 Pack NRL"}]}'::jsonb);
insert into sports_feed.australian_prize_rules(version,sport,configuration)values('docked-australian-owner-2026-10-24-v1-nrl-OPEN','nrl','{"version":"docked-australian-owner-2026-10-24-v1-nrl-OPEN","sport":"nrl","mode":"OPEN","scope":"weekly","active":false,"tiePolicy":null,"season":"To be announced","items":[{"from":1,"to":1,"type":"credits","amount":100000,"description":"100,000 Docked Credits"},{"from":2,"to":2,"type":"credits","amount":25000,"description":"25,000 Docked Credits"},{"from":2,"to":2,"type":"pack","amount":5,"productVersion":"premium-9-nrl-real-roster-beta-v1","description":"Premium 9 Pack NRL"},{"from":3,"to":3,"type":"pack","amount":5,"productVersion":"premium-9-nrl-real-roster-beta-v1","description":"Premium 9 Pack NRL"}]}'::jsonb);

-- Explicit future-round adoption, never triggered by a UI read or migration install.
-- Populated drafts/entries require a separate reviewed transition, not silent invalidation.
create function sports_feed.adopt_australian_salary(cid uuid, reason text) returns void
language plpgsql security definer set search_path='' as $$
declare c beta_fantasy.competitions; v text;
begin
 if not beta_private.active_member_session() or auth.jwt()->>'aal' is distinct from 'aal2'
 or not exists(select 1 from beta_private.roles where user_id=auth.uid() and role='owner')
 then raise exception 'Owner MFA required' using errcode='42501';end if;
 if length(trim(reason))<12 then raise exception 'Explicit review reason required';end if;
 perform pg_advisory_xact_lock(71820342);
 select * into strict c from beta_fantasy.competitions where id=cid for update;
 if c.sport not in ('afl','nrl') or c.locks_at<=clock_timestamp() or c.scored_at is not null
 or exists(select 1 from beta_fantasy.entries where competition_id=cid)
 or exists(select 1 from beta_fantasy.round_drafts where competition_id=cid)
 or exists(select 1 from beta_fantasy.slot_locks where competition_id=cid)
 then raise exception 'Only empty future AFL/NRL competitions may adopt salaries; existing entries and drafts require review';end if;
 v:='docked-australian-owner-2026-10-24-v1-'||c.sport;
 if not exists(select 1 from beta_fantasy.lineup_configurations where version=v) then raise exception 'Configuration missing';end if;
 perform set_config('docked.australian_salary_reason',reason,true);
 update beta_fantasy.competitions set rules=jsonb_set(rules,'{lineup_version}',to_jsonb(v)) where id=cid;
 perform set_config('docked.australian_salary_reason','',true);
 insert into beta_private.audit_events(actor,action,subject,details) values(auth.uid()::text,'future_salary_adopted',cid::text,jsonb_build_object('previous',c.rules->>'lineup_version','version',v,'reason',reason));
end$$;
revoke all on function sports_feed.adopt_australian_salary(uuid,text) from public,anon,authenticated,service_role,docked_app;
grant execute on function sports_feed.adopt_australian_salary(uuid,text) to docked_beta_app;
