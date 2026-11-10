/** Read only: check the independent NFL provider-to-catalogue mapping table.
 * Persists public player identifiers only, never customer identity or secrets. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
assert.equal(process.argv[2], "--production-read-only");
const root = process.cwd();
const data = JSON.parse(
  readFileSync(
    "docs/qa/v31-operational-acceptance-20261110/card-founder-decisions.json",
    "utf8",
  ),
);
const ids = data.records
  .filter((r: any) => !r.proposedCanonicalPlayerId)
  .map((r: any) => r.providerId);
assert.equal(
  ids.length,
  23,
  "Review changed mapping scope before another lookup",
);
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const capture = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const rows =
          await tx`select n.provider_id,n.player_id,p.name,p.sport,p.position from sports_feed.nfl_players n join beta_fantasy.players p on p.id=n.player_id where n.provider_id=any(${ids}::text[]) order by n.provider_id`;
        return {
          capturedAt: new Date().toISOString(),
          productionWrites: 0,
          requestedProviderIds: ids,
          rows,
        };
      },
    );
    writeFileSync(
      "docs/qa/v31-operational-acceptance-20261110/card-catalogue-lookup.json",
      JSON.stringify(capture, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(
      JSON.stringify({ matches: capture.rows.length, productionWrites: 0 }),
    );
  } finally {
    await sql.end();
  }
}
void main().catch(() => {
  console.error(
    "Read-only catalogue lookup failed; no Production mutation performed.",
  );
  process.exitCode = 1;
});
