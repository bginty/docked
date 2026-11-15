/** Transaction-rolled-back source-rights acceptance in an isolated restore only. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const target = "docked-commercial-restore-20261115f";
const c = JSON.parse(
  execFileSync("docker", ["inspect", target], { windowsHide: true }),
)[0];
assert.equal(c.HostConfig.NetworkMode, "none");
assert.equal(Object.keys(c.HostConfig.PortBindings ?? {}).length, 0);
const sql = `begin;set local statement_timeout='15s';
do $$declare base int; selected beta_packs.definitions; rid text; n int; u uuid; scope text; variant text; begin
 select jsonb_array_length(beta_packs.catalogue()->'players') into base;
 if base<>1210 then raise exception 'Exact adopted isolated pool required';end if;
 select * into strict selected from beta_packs.definitions where sport='nfl' order by definition limit 1;
 select m.rights_id into strict rid from season_catalogue.members m where m.sport=selected.sport and m.season=selected.season and m.player_id=selected.player_id and m.scope='free_weekly';
 insert into season_catalogue.decisions(rights_id,player_id,blocked,reason,authority_reference)values(rid,selected.player_id,true,'Synthetic identity-specific source restriction','Isolated acceptance; entire transaction rolls back');
 if jsonb_array_length(beta_packs.catalogue()->'players')<>base-1 then raise exception 'Player restriction ignored';end if;
 insert into season_catalogue.decisions(rights_id,player_id,blocked,reason,authority_reference)values(rid,selected.player_id,false,'Synthetic reviewed source reinstatement','Isolated acceptance; entire transaction rolls back');
 if jsonb_array_length(beta_packs.catalogue()->'players')<>base then raise exception 'Latest player decision ignored';end if;
 select count(distinct player_id) into n from beta_packs.definitions where sport='nfl';
 insert into season_catalogue.decisions(rights_id,blocked,reason,authority_reference)values(rid,true,'Synthetic global retained-source restriction','Isolated acceptance; entire transaction rolls back');
 if jsonb_array_length(beta_packs.catalogue()->'players')<>base-n then raise exception 'Global restriction overridden by player reinstatement';end if;
 insert into season_catalogue.decisions(rights_id,blocked,reason,authority_reference)values(rid,false,'Synthetic global source reinstatement','Isolated acceptance; entire transaction rolls back');
 if jsonb_array_length(beta_packs.catalogue()->'players')<>base then raise exception 'Latest global decision ignored';end if;
 foreach variant in array array['expired','future'] loop
  u:=gen_random_uuid();
  foreach scope in array array['free_weekly','free_beta_packs'] loop
   rid:='isolated-rights-'||u||'-'||scope;
   insert into season_catalogue.rights values(rid,'nfl','2026',scope,
    case when scope='free_beta_packs' and variant='future' then now()+interval '1 day' else now()-interval '2 days' end,
    case when scope='free_beta_packs' and variant='expired' then now()-interval '1 day' else null end,
    '{}','Synthetic source-rights acceptance only; rolled back');
   insert into season_catalogue.members values('nfl','2026',u,scope,rid,'synthetic',u::text,'{"team":"SYNTHETIC"}',null,'{}',repeat('a',64),'Synthetic source-rights acceptance only; rolled back');
  end loop;
  insert into commercial_billing.definitions(id,player_id,sport,rarity,lifetime_cap,issued,legacy_issued,snapshot,rights_reference)
   select gen_random_uuid(),u,'nfl',rarity,lifetime_cap,0,0,'{}','Synthetic source-rights acceptance only; rolled back'
   from commercial_billing.definitions where player_id=selected.player_id and sport='nfl';
  insert into beta_packs.definitions select id,'synthetic-'||u,u,'nfl',rarity,'2026','isolated-rights-'||u||'-free_beta_packs',repeat('a',64)
   from commercial_billing.definitions where player_id=u;
  if season_catalogue.can_issue('nfl','2026',u,'free_beta_packs') or jsonb_array_length(beta_packs.catalogue()->'players')<>base
   then raise exception 'Source validity window ignored';end if;
 end loop;
end$$;
set constraints all immediate;rollback;
select jsonb_build_object('pool',jsonb_array_length(beta_packs.catalogue()->'players'),'syntheticRowsRemaining',(select count(*) from beta_packs.definitions where legacy_player like 'synthetic-%'));
`;
const output = execFileSync(
  "docker",
  [
    "exec",
    "-i",
    target,
    "psql",
    "-X",
    "-q",
    "-h",
    "/restore",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-At",
  ],
  { input: sql, windowsHide: true, maxBuffer: 1000000 },
)
  .toString()
  .trim();
assert.deepEqual(JSON.parse(output), { pool: 1210, syntheticRowsRemaining: 0 });
const report = {
  at: new Date().toISOString(),
  passed: true,
  environment:
    "Disconnected restored Production, all synthetic decisions/rows rolled back",
  checks: [
    "latest player restriction and reinstatement",
    "global restriction remains binding despite player reinstatement",
    "latest global reinstatement",
    "expired source rights",
    "future source rights",
    "unchanged 1210-player pool after rollback",
  ],
  productionWrites: 0,
};
writeFileSync(
  "docs/qa/founder-credit-packs-20261115/rights-acceptance.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
