import { writeFileSync } from "node:fs";
import {
  approvedAustralianLineup,
  approvedAustralianPrizes,
} from "../src/core/approved-australian-rules";
// Generates a reviewed migration ONLY. Never connects to a database.
const literal = (value: unknown) =>
  `'${JSON.stringify(value).replaceAll("'", "''")}'::jsonb`;
let sql = `-- Additive approved future configurations; no competition is selected or activated.
-- Existing QA units, confirmed entries, drafts, scoring rules and prizes remain unchanged.
create table sports_feed.australian_prize_rules (
 version text primary key, sport text not null check(sport in ('afl','nrl')),
 configuration jsonb not null, created_at timestamptz not null default clock_timestamp()
);
alter table sports_feed.australian_prize_rules enable row level security;
revoke all on sports_feed.australian_prize_rules from public,anon,authenticated,service_role,docked_app,docked_beta_app;
`;
for (const sport of ["afl", "nrl"] as const) {
  const c = approvedAustralianLineup(sport);
  sql += `insert into beta_fantasy.lineup_configurations(version,configuration)values('${c.version}',${literal(c)});\n`;
  for (const mode of ["SALARY_CAP", "OPEN"] as const) {
    const p = approvedAustralianPrizes(sport, mode);
    sql += `insert into sports_feed.australian_prize_rules(version,sport,configuration)values('${p.version}','${sport}',${literal(p)});\n`;
  }
}
sql += `
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
`;
writeFileSync(
  "supabase/migrations/20261023234740_approved_afl_nrl_future_rules.sql",
  sql,
);
