/** Whole-database read-only drift evidence. No grants, locks, migrations or resets. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createDecipheriv } from "node:crypto";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import {
  tableListQuery,
  checksumQuery,
  custodyQuery,
} from "./lib/reviewed-inventory";
import { v31SchemaFingerprintSql } from "./lib/v31-schema-fingerprint";
import { digest } from "../src/core/scoring-engine";
import { validateCredits } from "../src/core/credits-sandbox";
const docs = "docs/qa/batch1-production-execution-20261116";
const root = process.cwd();
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
process.chdir(root);
async function main() {
  try {
    const key = Buffer.from(
      readFileSync(
        "C:/Users/61412/.docked-secrets/launch-migration-backup-key.hex",
        "utf8",
      ).trim(),
      "hex",
    );
    const encrypted = readFileSync(
      "private-data/commercial-restore-20261116b/manifest.aes",
    );
    const c = createDecipheriv("aes-256-gcm", key, encrypted.subarray(0, 12));
    c.setAuthTag(encrypted.subarray(12, 28));
    const manifest = JSON.parse(
      Buffer.concat([c.update(encrypted.subarray(28)), c.final()]).toString(),
    );
    key.fill(0);
    assert.equal(manifest.project, "pojoymtniryarxxunyvz");
    const value = await sql.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        await tx`set local statement_timeout='90s'`;
        const tables = (await tx.unsafe(tableListQuery))[0].value as string[];
        const sums: Record<string, any> = {};
        for (let i = 0; i < tables.length; i += 20) {
          const rows = await tx.unsafe(
            tables
              .slice(i, i + 20)
              .map(checksumQuery)
              .join(" union all "),
          );
          for (const { value: v } of rows)
            sums[v.table] = { count: v.count, hash: v.hash };
        }
        const schema = (await tx.unsafe(v31SchemaFingerprintSql))[0];
        const custody = (await tx.unsafe(custodyQuery))[0].value;
        const [wallet] =
          await tx`select document from credits_sandbox.state where id`;
        validateCredits(wallet.document);
        const [integrity] =
          await tx`select (select count(*)::int from commercial_billing.definitions d where d.issued<>d.legacy_issued+(select count(*) from beta_packs.issued b where b.definition=d.id)+(select count(*) from commercial_billing.cards c where c.definition=d.id)) lifetime_mismatches,(select count(*)::int from (select definition,serial,count(*) from (select definition,serial from beta_packs.issued union all select definition,serial from commercial_billing.cards)a group by 1,2 having count(*)>1)b) duplicate_later_serials,(select count(*)::int from (select journal,sum(amount) from commercial_billing.lines group by journal having sum(amount)<>0)j) unbalanced_commercial_journals`;
        assert(Object.values(integrity).every((v) => v === 0));
        const operations =
          await tx`select status,detail->>'task' task,count(*)::int records,min(id) first_id,max(id) last_id from sports_feed.nfl_worker_runs where started_at>${manifest.at}::timestamptz group by 1,2 order by 1,2`;
        return {
          sums,
          schema,
          integrity,
          custodyRecords: custody.length,
          custodyDigest: digest(custody),
          operationsSincePreviousBackup: operations,
        };
      },
    );
    const old = Object.fromEntries(
      Object.entries(manifest.sums).map(([k, v]) => [k.replaceAll('"', ""), v]),
    );
    const changes = Object.entries(value.sums).flatMap(([table, now]) => {
      const previous = old[table] as any;
      return previous?.count === now.count && previous?.hash === now.hash
        ? []
        : [{ table, previous: previous ?? null, current: now }];
    });
    const result = {
      at: new Date().toISOString(),
      previousBackupAt: manifest.at,
      productionWrites: 0,
      ...value,
      changes,
    };
    writeFileSync(
      docs + "/full-readonly-drift.json",
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(
      JSON.stringify({
        ...result,
        sums: undefined,
        protectedTables: Object.keys(value.sums).length,
      }),
    );
  } finally {
    await sql.end({ timeout: 3 });
  }
}
main().catch((e) => {
  console.error(
    "Read-only drift check failed",
    e instanceof assert.AssertionError
      ? "ASSERTION"
      : (e.code ?? "UNAVAILABLE"),
  );
  process.exitCode = 1;
});
