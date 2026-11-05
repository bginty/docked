import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { ownerDatabase, projectRef } from "../../scripts/owner-gameplay-db.mjs";
import { officialTeams } from "../../src/core/official-roster-refresh";

const root = process.cwd();
const candidate = JSON.parse(
  readFileSync(
    "private-data/commercial-pool-20261105/candidate.private.json",
    "utf8",
  ),
);
const represented = [
  ...new Set<string>(
    candidate.rows
      .filter((r: any) => r.sport === "nfl")
      .map((r: any) => r.snapshot.team),
  ),
].sort();
const missing = Object.keys(officialTeams)
  .filter((t) => !represented.includes(t))
  .sort();
assert.deepEqual(missing, ["ARI", "MIA", "TEN"]);
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const result = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='30s'`;
        const [mode] =
          await tx`select current_setting('transaction_read_only') read_only,clock_timestamp() at`;
        assert.equal(mode.read_only, "on");
        const source =
          await tx`select r.player_id,r.provider_id,r.team,r.position,r.status,r.identity_verified,r.source_url,r.source_hash,r.checked_at,p.id beta_id,p.name beta_name,p.position beta_position,p.status beta_status,p.team beta_team,pp.identity permanent_identity,pp.provider_id permanent_provider_id
        from nfl_roster.current_evidence r
        left join beta_fantasy.players p on p.id::text=r.player_id and p.sport='nfl'
        left join credits_sandbox.permanent_players pp on pp.id=r.player_id and pp.sport='nfl'
        where r.team=any(${missing}) order by r.team,r.player_id`;
        const beta =
          await tx`select p.id,p.name,p.team,p.position,p.status,r.team source_team,r.status source_status,r.identity_verified,r.checked_at,r.position source_position,r.provider_id,r.source_url,r.source_hash from beta_fantasy.players p left join nfl_roster.current_evidence r on r.player_id=p.id::text where p.sport='nfl' and (p.team=any(${missing}) or r.team=any(${missing})) order by p.team,p.id`;
        const sourceCounts =
          await tx`select team,count(*)::int total,count(*) filter(where identity_verified)::int identity_verified,count(*) filter(where status='active')::int active,count(*) filter(where checked_at>clock_timestamp()-interval '72 hours')::int fresh,count(*) filter(where identity_verified and status='active' and checked_at>clock_timestamp()-interval '72 hours')::int verified_active_fresh from nfl_roster.current_evidence group by team order by team`;
        const columns =
          await tx`select table_schema,table_name,column_name,data_type from information_schema.columns where table_schema='nfl_roster' and table_name in('observations','current_evidence') order by table_name,ordinal_position`;
        const view =
          await tx`select pg_get_viewdef('nfl_roster.current_evidence'::regclass,true) definition`;
        return {
          at: new Date(mode.at).toISOString(),
          readOnly: true,
          projectRef,
          productionWrites: 0,
          represented,
          missing,
          sourceCounts,
          source,
          beta,
          columns,
          view,
        };
      },
    );
    const out = path.join(root, "docs/ops-launch-20261105/nfl-pool-omissions");
    mkdirSync(out, { recursive: true });
    writeFileSync(
      path.join(out, "readback.json"),
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(
      JSON.stringify(
        {
          at: result.at,
          missing,
          sourceCounts: result.sourceCounts.filter((r) =>
            missing.includes(r.team),
          ),
          sourceRows: result.source.length,
          betaRows: result.beta.length,
          readOnly: true,
          productionWrites: 0,
        },
        null,
        2,
      ),
    );
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(
    e.code ?? e.name,
    e instanceof assert.AssertionError
      ? e.message
      : "Read-only pool omission inspection failed",
  );
  process.exitCode = 1;
});
