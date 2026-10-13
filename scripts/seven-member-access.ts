// Read-only human-account eligibility/coverage. Never transact for owner or Barry.
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { nflCoverage } from "../src/core/fantasy-play";
async function main() {
  const sql = ownerDatabase();
  try {
    const { competition } = JSON.parse(
      readFileSync("docs/qa/seven-round/preparation.json", "utf8"),
    )[0];
    const [comp] =
      await sql`select c.*, (select jsonb_agg(distinct p) from sports_feed.nfl_rounds n,jsonb_array_elements(n.fixtures)f,jsonb_array_elements(f->'playerIds')p where n.competition_id=c.id) eligible_player_ids from beta_fantasy.competitions c where id=${competition}`;
    const accounts = [];
    for (const [name, id] of [
      ["Owner", "623d1e69-d0f3-493f-9713-108e8c21469a"],
      ["Barry", "ef641248-67be-4c32-9b12-9205bfcee15b"],
    ]) {
      const [access] =
        await sql`select beta_private.admitted(${id}::uuid) admitted,(select enabled from credits_sandbox.access where user_id=${id}::uuid) wallet_enabled,sports_feed.rarity_inventory(${id}::uuid) limited`;
      const core =
        await sql`select a.id,a.owner_id,e.season,e.tier,p.id player_id,cp.id canonical_player_id,p.position,p.sport,case when n.source_status='ACT' and n.observed_at>clock_timestamp()-interval '72 hours' then 'active' else 'unavailable' end status,exists(select 1 from beta_fantasy.listings l where l.card_id=a.id and l.state='active') listed from beta_fantasy.cards a join beta_fantasy.editions e on e.id=a.edition_id join beta_fantasy.players p on p.id=e.player_id join sports_feed.nfl_players n on n.player_id=p.id join credits_sandbox.permanent_players cp on cp.provider_id=n.provider_id where a.owner_id=${id}::uuid and e.tier='CORE'`;
      accounts.push({
        name,
        admitted: access.admitted,
        walletEnabled: access.wallet_enabled,
        openedLimited: access.limited.length,
        core: core.length,
        coverage: nflCoverage(
          [...core, ...access.limited] as any,
          comp as any,
          id,
        ),
        note: "Read-only coverage with canonical identity; no purchase, grant, pack opening, team or trade performed.",
      });
    }
    const report = { at: new Date().toISOString(), competition, accounts };
    writeFileSync(
      "docs/qa/seven-round/member-access.json",
      JSON.stringify(report, null, 2),
    );
    console.log(report);
  } finally {
    await sql.end();
  }
}
void main();
