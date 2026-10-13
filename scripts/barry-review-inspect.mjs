import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
const sql = ownerDatabase();
try {
  const players =
    await sql`select p.id,p.identity->>'name' name,p.provider_id,r.position,r.status,r.team,r.checked_at from credits_sandbox.permanent_players p left join credits_sandbox.current_player_status r on r.id=p.id where p.identity->>'name' ilike '%Juszczyk%'`;
  const native =
    await sql`select p.name,p.position,n.source_status,n.current_team,n.observed_at from beta_fantasy.players p join sports_feed.nfl_players n on n.player_id=p.id where p.name ilike '%Juszczyk%'`;
  const functions =
    await sql`select pg_get_functiondef('sports_feed.nfl_standings()'::regprocedure) definition`;
  const baseline =
    await sql`select revision,md5(document::text) hash from credits_sandbox.state where id`;
  const rounds =
    await sql`select name,season,round,locks_at,rules->>'mode' mode from beta_fantasy.competitions where rules->>'lineup_version' is not null`;
  mkdirSync("docs/qa/barry-review", { recursive: true });
  writeFileSync(
    "docs/qa/barry-review/before.json",
    JSON.stringify(
      { at: new Date().toISOString(), players, native, baseline, rounds },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      players,
      native,
      baseline,
      rounds,
      standingsDefinition: functions[0].definition,
    }),
  );
} finally {
  await sql.end();
}
