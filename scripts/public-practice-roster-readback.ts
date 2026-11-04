/** Fresh READ ONLY extraction from existing verified Production facts. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const rows = await sql.begin(
      "read only",
      async (tx) =>
        tx`select p.id,p.name,p.sport,p.position,r.team,p.colour,p.shirt,p.first_season,p.status,r.source_url,r.source_hash,r.checked_at from beta_fantasy.players p join nfl_roster.current_evidence r on r.player_id=p.id::text where p.sport='nfl' and p.status='active' and r.identity_verified and r.status='active' and r.checked_at>clock_timestamp()-interval '72 hours' and p.position in ('QB','RB','WR','TE') and (p.position=any(string_to_array(r.position,'/')) or (p.position='RB' and r.position in ('HB','FB'))) order by p.id`,
    );
    assert(rows.length > 100, "Fresh verified NFL evidence required");
    writeFileSync(
      "private-data/restored-public-preview/nfl-verified-readonly.json",
      JSON.stringify(rows),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        count: rows.length,
        source: "existing verified roster observations",
        productionWrites: 0,
      }),
    );
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error("Read-only verified roster export failed");
  process.exitCode = 1;
});
