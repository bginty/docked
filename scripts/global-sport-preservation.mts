import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const root = process.cwd(),
  out = root + "/docs/qa/global-sport/release";
await fs.mkdir(out, { recursive: true });
const mode = process.argv[2];
assert(["before", "after"].includes(mode));
assert.equal(projectRef, "pojoymtniryarxxunyvz");
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
try {
  const protectedRecords = await sql.begin(
    "isolation level repeatable read read only",
    async (tx) => {
      const data: Record<string, unknown> = {};
      for (const table of [
        "credits_sandbox.state",
        "beta_fantasy.cards",
        "beta_fantasy.ownership_events",
        "beta_fantasy.entries",
        "beta_fantasy.results",
        "beta_fantasy.competitions",
        "beta_fantasy.sales",
        "beta_fantasy.packs",
        "sports_feed.sport_sandbox_inventory",
        "sports_feed.nfl_control",
      ])
        data[table] = (
          await tx.unsafe(
            `select count(*) count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) hash from ${table} t`,
          )
        )[0];
      return data;
    },
  );
  let unchanged: boolean | null = null;
  if (mode === "after") {
    const before = JSON.parse(
      await fs.readFile(out + "/preservation-before.json", "utf8"),
    );
    unchanged =
      JSON.stringify(before.protectedRecords) ===
      JSON.stringify(protectedRecords);
  }
  await fs.writeFile(
    out + `/preservation-${mode}.json`,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        projectRef,
        mode,
        protectedRecords,
        unchanged,
        writes: 0,
        scope:
          "Read-only owner diagnostic; not an authenticated member journey",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ mode, unchanged, writes: 0 }));
} finally {
  await sql.end();
}
