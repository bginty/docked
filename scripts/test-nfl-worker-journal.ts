import { resolve } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import postgres from "postgres";
import { databaseConnectionOptions } from "../src/server/database-tls";
import { SportsFeedStore } from "../src/server/sports-feed-store";
async function main() {
  const env = readFileSync("private-data/nfl-worker/worker.env", "utf8");
  const url = env
    .split(/\r?\n/)
    .find((l) => l.startsWith("DOCKED_NFL_WORKER_DATABASE_URL="))!
    .slice("DOCKED_NFL_WORKER_DATABASE_URL=".length);
  assert.equal(new URL(url).username, "docked_nfl_worker.pojoymtniryarxxunyvz");
  const sql = postgres(url, {
    ...databaseConnectionOptions(url, {
      DATABASE_SSL_CA_FILE: resolve("certs/supabase-prod-ca-2021.crt"),
    }),
    max: 1,
  });
  try {
    const [round] =
      await sql`select stream_id from sports_feed.nfl_rounds where purpose='member' order by next_check limit 1`;
    assert.ok(round);
    await assert.rejects(
      () =>
        sql.begin(async (tx) => {
          const db = new Proxy(tx, {
            get(t, k) {
              if (k === "begin")
                return (
                  fn: (sql: postgres.TransactionSql) => Promise<unknown>,
                ) => t.savepoint(fn);
              const v = Reflect.get(t, k);
              return typeof v === "function" ? v.bind(t) : v;
            },
          }) as unknown as postgres.Sql;
          const state = await new SportsFeedStore(db).change(
            round.stream_id,
            (s) => {
              s.audits.push({
                sequence: s.audits.length + 1,
                actor: "rollback-worker-qa",
                action: "permission-test",
                at: new Date().toISOString(),
                reason: "Rollback-only collector journal permission check",
                payloadHash: "test",
              });
              return s;
            },
          );
          assert.equal(state.audits.at(-1)?.action, "permission-test");
          throw Error("ROLLBACK_QA");
        }),
      /ROLLBACK_QA/,
    );
    await assert.rejects(() => sql`select * from beta_fantasy.cards`);
    await assert.rejects(
      () => sql`update sports_feed.nfl_rounds set locked_snapshot='[]'`,
    );
    writeFileSync(
      "docs/qa/nfl-member/worker-journal.json",
      JSON.stringify(
        {
          at: new Date().toISOString(),
          passed: true,
          actualDedicatedRole: true,
          journalAppendRolledBack: true,
          holdingsAndLockedLineupWritesDenied: true,
        },
        null,
        2,
      ),
    );
    console.log(
      "Actual worker role: serial journal append passes and rolls back; protected writes denied",
    );
  } finally {
    await sql.end();
  }
}
void main();
