import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";

// Reads the explicit existing target inside a server-enforced read-only transaction.
// The output is private, local audit input, never an application credential export.
async function main() {
  const sql = ownerDatabase();
  const directory = "private-data/nfl-roster-audit";
  await mkdir(directory, { recursive: true });
  try {
    const snapshot = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const tables: Record<string, unknown> = {};
        for (const name of [
          "players",
          "editions",
          "cards",
          "ownership_events",
          "pack_items",
          "packs",
          "listings",
          "trades",
          "trade_items",
          "entries",
          "entry_revisions",
          "replacements",
          "swaps",
          "swap_reserve_packs",
          "round_drafts",
          "slot_locks",
          "round_scores",
          "members",
          "ledger",
          "journals",
          "requests",
        ]) {
          tables[`beta_fantasy.${name}`] =
            await tx`select * from ${tx("beta_fantasy")}.${tx(name)}`;
        }
        for (const name of [
          "state",
          "card_definitions",
          "card_instances",
          "pack_receipts",
          "permanent_players",
        ])
          tables[`credits_sandbox.${name}`] =
            await tx`select * from ${tx("credits_sandbox")}.${tx(name)}`;
        for (const name of [
          "nfl_players",
          "nfl_allocations",
          "nfl_starter_entitlements",
          "weekly_core_packs",
        ])
          tables[`sports_feed.${name}`] =
            await tx`select * from ${tx("sports_feed")}.${tx(name)}`;
        const source =
          await tx`select r.id,r.body,c.checked_at from sports_feed.postgame_cache c join sports_feed.raw_revisions r on r.id=c.raw_id where r.body->>'dataset'='rosters' order by c.checked_at desc limit 1`;
        return {
          scope: "local-audit-copy-only",
          at: new Date().toISOString(),
          tables,
          source,
        };
      },
    );
    const body = JSON.stringify(snapshot, null, 2);
    const file = `${directory}/snapshot-${Date.now()}.json`;
    await writeFile(file, body, { flag: "wx", mode: 0o600 });
    await writeFile(
      `${directory}/latest.json`,
      JSON.stringify({
        file,
        sha256: createHash("sha256").update(body).digest("hex"),
      }),
    );
    console.log(
      JSON.stringify({
        file,
        sha256: createHash("sha256").update(body).digest("hex"),
        counts: Object.fromEntries(
          Object.entries(snapshot.tables).map(([k, v]) => [
            k,
            (v as unknown[]).length,
          ]),
        ),
      }),
    );
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(
    "Read-only snapshot failed; no cleanup performed.",
    e.code ?? e.name,
  );
  process.exitCode = 1;
});
