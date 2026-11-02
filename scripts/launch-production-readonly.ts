/** No writes: re-read the already-approved migration bytes and dormant gates. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
const root = process.cwd();
const previous = JSON.parse(
  readFileSync(
    path.join(root, "docs/qa/approved-production-20261102/apply.json"),
    "utf8",
  ),
);
assert.equal(previous.project, "pojoymtniryarxxunyvz");
process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
const sql = ownerDatabase();
async function main() {
  const result = await sql.begin(
    "isolation level repeatable read read only",
    async (tx) => {
      const migrations =
        await tx`select version,statements from supabase_migrations.schema_migrations where version in ('20261101120754','20261102010000','20261102010001') order by version`;
      assert.equal(migrations.length, 3);
      const verified = migrations.map((m) => {
        const approved = previous.migrations.find((p: { file: string }) =>
          p.file.startsWith(m.version + "_"),
        );
        assert(approved);
        const source = readFileSync(
          path.join(root, "supabase/migrations", approved.file),
        );
        const digest = (s: string | Buffer) =>
          createHash("sha256").update(s).digest("hex");
        assert.equal(digest(source), approved.sha256);
        assert.equal(digest(m.statements[0]), approved.sha256);
        return {
          version: m.version,
          sha256: approved.sha256,
          alreadyApplied: true,
          reapplied: false,
        };
      });
      const [state] =
        await tx`select (select enabled from private.feature_flags where key='registration') registration,(select enabled from public_gameplay.policy where id) public_enabled,(select count(*)::int from public_gameplay.rounds where enabled) public_rounds,(select count(*)::int from commercial_billing.cards) commercial_cards,(select count(*)::int from commercial_billing.receipts) commercial_receipts,(select coalesce(sum(remaining),0)::text from commercial_billing.lots) commercial_funds,(select sales_enabled or issuance_enabled or transfers_enabled or gameplay_enabled from commercial_billing.control where id) commercial_enabled,to_regclass('commercial_retention.policy')::text retention_table`;
      assert.equal(state.registration, false);
      assert.equal(state.public_enabled, false);
      assert.equal(state.public_rounds, 0);
      assert.equal(state.commercial_enabled, false);
      assert.equal(state.commercial_cards, 0);
      assert.equal(state.commercial_receipts, 0);
      assert.equal(state.commercial_funds, "0");
      const [additional] =
        await tx`select count(*)::int n from supabase_migrations.schema_migrations where version in ('20261102011703','20261102023100')`;
      assert.equal(additional.n, 0);
      const sports =
        await tx`select sport,visible,play_enabled from public_gameplay.sports order by sport`;
      assert(
        sports.every(
          (s) =>
            ["nfl", "afl", "nrl"].includes(s.sport) &&
            !s.visible &&
            !s.play_enabled,
        ),
      );
      const counts = [];
      for (const table of [
        "auth.users",
        "public.profiles",
        "beta_fantasy.cards",
        "beta_fantasy.entries",
        "beta_fantasy.ledger",
        "beta_fantasy.ownership_events",
        "beta_fantasy.pack_items",
        "cron.job",
      ]) {
        const [row] = await tx.unsafe(`select count(*)::int n from ${table}`);
        counts.push({ table, count: row.n });
      }
      return {
        project: projectRef,
        migrations: verified,
        state,
        sports,
        currentCounts: counts,
        productionMutations: 0,
        comparison:
          "Current read-only census; prior transactional preservation evidence retained separately. Legitimate customer/cron changes are not overwritten.",
      };
    },
  );
  writeFileSync(
    path.join(root, "docs/qa/launch-resolution-20261102/production-gates.json"),
    JSON.stringify({ at: new Date().toISOString(), ...result }, null, 2),
  );
  console.log(JSON.stringify(result));
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end());
