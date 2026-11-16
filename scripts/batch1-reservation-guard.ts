/** PostgreSQL trigger equivalence fixture, not hosted lineup acceptance. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { batch1Database } from "./lib/batch1-isolated-db";

async function main() {
  const sql = batch1Database("postgres");
  const rollback = Error("isolated rollback");
  const results: any[] = [];
  try {
    await sql
      .begin(async (tx) => {
        const [original] =
          await tx`select pg_get_functiondef('sports_feed.rarity_transfer_guard()'::regprocedure) body`;
        for (const file of [
          "20261115113306_batch_private_pack_issuance_validation.sql",
          "20261115211545_batch1_pack_guard_batching.sql",
          "20261115235000_batch1_persistence_subdocuments.sql",
        ])
          await tx.unsafe(readFileSync(`supabase/migrations/${file}`, "utf8"));
        const [candidate] =
          await tx`select pg_get_functiondef('sports_feed.rarity_transfer_guard()'::regprocedure) body`;
        // Mock ONLY the unchanged reservation oracle to exercise both outcomes. The
        // trigger, PostgreSQL generic/custom planners and locking are actual code.
        await tx.unsafe(`create or replace function sports_feed.card_entry_reserved(cid text) returns boolean language sql security definer set search_path='' as $$select cid='reserved-fixture'$$;
    create temporary table batch1_transfer_fixture(document jsonb);
    create trigger reserved_check before update on batch1_transfer_fixture for each row execute function sports_feed.rarity_transfer_guard();`);
        const old = {
          commerce: {
            cards: {
              "reserved-fixture": { owner: "member-a" },
              "unreserved-fixture": { owner: "member-a" },
            },
          },
        };
        for (const [version, body] of [
          ["before", original.body],
          ["candidate", candidate.body],
        ]) {
          await tx.unsafe(body);
          for (const mode of ["force_custom_plan", "force_generic_plan"]) {
            await tx`select set_config('plan_cache_mode',${mode},true)`;
            for (const [scenario, change, rejected] of [
              ["unchanged", {}, false],
              ["new allocation", { "new-card": { owner: "member-a" } }, false],
              [
                "unreserved transfer",
                { "unreserved-fixture": { owner: "member-b" } },
                false,
              ],
              [
                "reserved transfer",
                { "reserved-fixture": { owner: "member-b" } },
                true,
              ],
              ["reserved removal", { "reserved-fixture": null }, true],
            ] as const) {
              await tx`truncate batch1_transfer_fixture`;
              await tx`insert into batch1_transfer_fixture values(${tx.json(old)})`;
              const next = structuredClone(old) as any;
              Object.assign(next.commerce.cards, change);
              if (next.commerce.cards["reserved-fixture"] === null)
                delete next.commerce.cards["reserved-fixture"];
              const write = () =>
                tx.savepoint(
                  (child) =>
                    child`update batch1_transfer_fixture set document=${child.json(next)}`,
                );
              if (rejected)
                await assert.rejects(
                  write,
                  /Card is in an unlocked submitted team/,
                );
              else await write();
              results.push({ version, mode, scenario, rejected });
            }
          }
        }
        throw rollback;
      })
      .catch((e) => {
        if (e !== rollback) throw e;
      });
    writeFileSync(
      "docs/qa/batch1-pack-phone-20261116/reservation-guard.json",
      JSON.stringify(
        {
          passed: true,
          scope:
            "Actual PostgreSQL trigger and plans; synthetic reservation oracle; all DDL/data rolled back",
          checks: results,
        },
        null,
        2,
      ),
    );
    console.log(JSON.stringify({ passed: true, checks: results.length }));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
void main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
