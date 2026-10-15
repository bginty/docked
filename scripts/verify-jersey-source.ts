// Public provider fetch only. Does not load hosted credentials or write a database.
import { mkdirSync, writeFileSync } from "node:fs";
import { fetchNflDataset } from "../src/server/nflverse-bundle";
async function main() {
  const result = await fetchNflDataset("rosters", 2026, {});
  if (result.notModified) throw Error("Unexpected cache response");
  const names = new Set([
    "Aaron Rodgers",
    "Michael Burton",
    "Ameer Abdullah",
    "Davante Adams",
    "Brandin Cooks",
  ]);
  const report = {
    at: new Date().toISOString(),
    projection: result.body.projectionVersion,
    source: result.body.source,
    modified: result.modified,
    sourceSha256: result.body.sourceSha256,
    rows: result.body.rows
      .filter((r) => names.has(r.full_name))
      .map((r) => ({
        name: r.full_name,
        team: r.team,
        number: r.jersey_number,
        week: r.week,
      })),
    hostedWrites: 0,
  };
  mkdirSync("docs/qa/jersey-refinement", { recursive: true });
  writeFileSync(
    "docs/qa/jersey-refinement/provider.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
}
void main();
