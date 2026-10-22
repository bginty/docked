// Read-only application recovery snapshot. Never reads Auth secrets or changes hosted data.
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
assert.equal(projectRef, "pojoymtniryarxxunyvz");
const dir = "private-data/multisport-private-beta-live";
await mkdir(dir, { recursive: true });
const sql = ownerDatabase();
try {
  const snapshot = await sql.begin(
    "isolation level repeatable read read only",
    async (tx) => {
      const tables: Record<string, unknown> = {};
      for (const table of [
        "credits_sandbox.state",
        "credits_sandbox.permanent_players",
        "credits_sandbox.card_definitions",
        "credits_sandbox.card_instances",
        "credits_sandbox.pack_configuration",
        "credits_sandbox.pack_receipts",
        "credits_sandbox.journal",
        "beta_fantasy.cards",
        "beta_fantasy.players",
        "beta_fantasy.entries",
        "beta_fantasy.results",
        "beta_fantasy.competitions",
        "beta_fantasy.lineup_configurations",
        "beta_fantasy.scoring_rules",
        "beta_fantasy.ownership_events",
        "beta_fantasy.sales",
        "sports_feed.nfl_control",
        "sports_feed.nfl_rounds",
        "sports_feed.nba_beta_control",
        "sports_feed.nba_beta_access",
        "sports_feed.sport_sandbox_inventory",
        "sports_feed.sport_rounds",
        "supabase_migrations.schema_migrations",
      ])
        tables[table] = await tx.unsafe(
          `select to_jsonb(t) row from ${table} t`,
        );
      const functions =
        await tx`select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('credits_sandbox','sports_feed','beta_private') and p.prokind='f'`;
      return { at: new Date().toISOString(), projectRef, tables, functions };
    },
  );
  const file = dir + `/application-recovery-${Date.now()}.private.json`;
  const bytes = JSON.stringify(snapshot);
  await writeFile(file, bytes, { flag: "wx", mode: 0o600 });
  assert.deepEqual(JSON.parse(await readFile(file, "utf8")), JSON.parse(bytes));
  const report = {
    at: snapshot.at,
    projectRef,
    bytes: Buffer.byteLength(bytes),
    sha256: createHash("sha256").update(bytes).digest("hex"),
    tables: Object.keys(snapshot.tables),
    readbackVerified: true,
    fullDatabaseBackup: false,
    restorationTested: false,
    recovery:
      "Private application rows plus prior function definitions retained. Additive migration recovery uses previous application deployment and disabled sport flags, preserving all new audit records. This is not a full Auth/Storage backup or a tested disaster recovery archive.",
  };
  await writeFile(
    root + "/docs/qa/overnight-multisport/release/recovery-snapshot.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await sql.end({ timeout: 3 });
}
