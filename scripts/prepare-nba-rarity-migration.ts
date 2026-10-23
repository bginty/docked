import { writeFileSync } from "node:fs";
import { nbaRarityWeeklyRules } from "../src/core/nba-weekly";
const rules = nbaRarityWeeklyRules();
writeFileSync(
  "supabase/migrations/20261023130000_nba_private_beta_rarity_v2.sql",
  `-- Owner correction: NBA rarity multipliers, 23 October 2026. No permanent issuance.
-- Immutable V1 competitions and saved lineups are retained. Only unscored,
-- unlocked private-beta periods receive a new successor. No financial effects.
insert into beta_fantasy.scoring_rules(version,rules)
values ('${rules.version}', $rules$${JSON.stringify(rules)}$rules$::jsonb) on conflict do nothing;
do $migration$
declare c record; new_id uuid; successor uuid;
begin
 select id into strict new_id from beta_fantasy.scoring_rules where version='${rules.version}'
 and rules=$rules$${JSON.stringify(rules)}$rules$::jsonb;
 for c in select * from beta_fantasy.competitions where sport='basketball'
  and rules->>'nba_beta_scope'='private-test-v1'
  and rules->>'inventory_scope'='isolated-multi-sport-v1'
  and rules->>'scoring_version'='docked-nba-weekly-proposal-v1'
  and locks_at>clock_timestamp()
  and not exists(select 1 from scoring_beta.journal j where j.stream_id='sim:basketball:'||competitions.id::text)
  and not exists(select 1 from beta_fantasy.results r where r.competition_id=competitions.id)
  and not exists(select 1 from beta_fantasy.competitions v where v.rules->>'replaces_competition'=competitions.id::text)
  for update
 loop
  successor:=gen_random_uuid();
  insert into beta_fantasy.competitions(id,name,sport,season,round,opens_at,locks_at,rules,scoring_id,awards,prize)
  values(successor,c.name||' · Rarity V2',c.sport,c.season||'-RARITY-V2',c.round,c.opens_at,c.locks_at,
   jsonb_set(c.rules,'{scoring_version}','"${rules.version}"') || jsonb_build_object('replaces_competition',c.id,'rarity_authority','Owner NBA rarity correction, 23 October 2026'),new_id,c.awards,c.prize);
  insert into sports_feed.sport_rounds(competition_id,sport,fixtures)
   select successor,sport,fixtures from sports_feed.sport_rounds where competition_id=c.id;
  insert into beta_private.audit_events(actor,action,subject,details)
   values('owner-authorised-nba-rarity','nba_rarity_successor_created',successor::text,
    jsonb_build_object('predecessor',c.id,'version','${rules.version}','existingCompetitionUnchanged',true,'entrySnapshotsUnchanged',true,'resultsRecalculated',false));
 end loop;
end $migration$;
`,
);
