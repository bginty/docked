import fs from "node:fs/promises";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
const rows: Record<string, unknown>[] = [];
try {
  await sql.begin("read only", async (tx) => {
    await tx`set local statement_timeout='25s'`;
    for (const a of await tx`select user_id,label from credits_sandbox.access where enabled order by label`) {
      const times: number[] = [];
      let count = 0;
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        count = (
          await tx`select jsonb_array_length(sports_feed.seven_inventory(${a.user_id}::uuid)) n`
        )[0].n;
        times.push(Math.round(performance.now() - start));
      }
      rows.push({ account: a.label, nflCards: count, inventoryMs: times });
    }
  });
  await fs.writeFile(
    root + "/docs/qa/play-owned/release/nfl-performance.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        scope:
          "Read-only Production SQL; full seven-card inventory query, not authenticated page timings",
        rows,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(rows));
} finally {
  await sql.end();
}
