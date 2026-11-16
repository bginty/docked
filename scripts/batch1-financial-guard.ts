/** Actual financial trigger before/after, synthetic rows in a rolled-back temp table. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { batch1Database } from "./lib/batch1-isolated-db";
async function main() {
  const sql = batch1Database("postgres"),
    rollback = Error("rollback");
  const rows: object[] = [];
  const base = {
    lots: { lot: { credits: 100 } },
    withdrawals: {
      request: {
        member: "synthetic",
        amount: 20,
        parts: [1],
        status: "review",
        manual: {
          requestedAt: 1,
          policy: "fixed",
          destination: "synthetic-only",
          rate: 1,
          audCents: 20,
        },
      },
    },
  };
  const changed = (fn: (d: any) => void) => {
    const d = structuredClone(base);
    fn(d);
    return d;
  };
  const cases = [
    { name: "unchanged", old: base, next: base, denied: false },
    {
      name: "ordinary credit balance mutation",
      old: base,
      next: changed((d) => {
        d.lots.lot.credits = 80;
      }),
      denied: false,
    },
    {
      name: "review status may advance",
      old: base,
      next: changed((d) => {
        d.withdrawals.request.status = "checked";
      }),
      denied: false,
    },
    {
      name: "cash eligibility cannot be introduced",
      old: base,
      next: changed((d) => {
        d.lots.lot.cashEligibility = {};
      }),
      denied: true,
    },
    {
      name: "historical funding classification cannot be removed",
      old: changed((d) => {
        d.lots.lot.cashEligibility = {};
      }),
      next: base,
      denied: true,
    },
    ...["member", "amount", "parts"].map((key) => ({
      name: "withdrawal " + key + " immutable",
      old: base,
      next: changed((d) => {
        d.withdrawals.request[key] =
          key === "parts" ? [2] : key === "amount" ? 21 : "other";
      }),
      denied: true,
    })),
    ...["requestedAt", "policy", "destination", "rate", "audCents"].map(
      (key) => ({
        name: "manual " + key + " immutable",
        old: base,
        next: changed((d) => {
          d.withdrawals.request.manual[key] = "changed";
        }),
        denied: true,
      }),
    ),
    {
      name: "withdrawal cannot disappear",
      old: base,
      next: changed((d) => {
        delete d.withdrawals.request;
      }),
      denied: true,
    },
    {
      name: "real documents remain excluded",
      old: base,
      next: changed((d) => {
        d.redemption = {
          scope: "local-fixtures-only",
          realDocumentsEnabled: true,
        };
      }),
      denied: true,
    },
    {
      name: "redemption cannot be activated outside dedicated QA",
      old: base,
      next: changed((d) => {
        d.redemption = {
          scope: "local-fixtures-only",
          realDocumentsEnabled: false,
          enabled: true,
        };
      }),
      denied: true,
    },
  ];
  try {
    for (const phase of ["baseline", "candidate"])
      await sql
        .begin(async (tx) => {
          if (phase === "candidate")
            for (const name of [
              "20261115113306_batch_private_pack_issuance_validation.sql",
              "20261115211545_batch1_pack_guard_batching.sql",
              "20261115235000_batch1_persistence_subdocuments.sql",
            ])
              await tx.unsafe(
                readFileSync(`supabase/migrations/${name}`, "utf8"),
              );
          const [{ identical }] =
            await tx`select bool_and((d::text::jsonb) is not distinct from (d #> '{}'::text[])) identical
            from (select document d from credits_sandbox.state union all
              select x.d from (values(null::jsonb),('null'::jsonb),('true'::jsonb),('false'::jsonb),
              ('0'::jsonb),('1.234567890123456789'::jsonb),('"text"'::jsonb),('[]'::jsonb),
              ('{}'::jsonb),('[1,null,{"a":[true,"ü"]}]'::jsonb)) x(d)) inputs`;
          assert.equal(
            identical,
            true,
            "Binary cache must preserve every JSON type and the full restored state",
          );
          await tx`create temporary table batch1_financial_guard(document jsonb) on commit drop`;
          for (const scenario of cases) {
            await tx.unsafe(
              "drop trigger if exists guard on batch1_financial_guard;truncate batch1_financial_guard",
            );
            await tx`insert into batch1_financial_guard values(${tx.json(scenario.old)})`;
            await tx.unsafe(
              "create trigger guard before insert or update on batch1_financial_guard for each row execute function credits_sandbox.guard_redemption()",
            );
            let denied = false;
            try {
              await tx.savepoint(async (child) => {
                await child`update batch1_financial_guard set document=${child.json(scenario.next)}`;
              });
            } catch (error) {
              assert.equal((error as { code: string }).code, "P0001");
              denied = true;
            }
            assert.equal(denied, scenario.denied, phase + ": " + scenario.name);
            assert.deepEqual(
              (await tx`select document from batch1_financial_guard`)[0]
                .document,
              denied ? scenario.old : scenario.next,
            );
            rows.push({ phase, name: scenario.name, denied });
          }
          throw rollback;
        })
        .catch((error) => {
          if (error !== rollback) throw error;
        });
    const result = {
      at: new Date().toISOString(),
      passed: true,
      scope:
        "Restored PostgreSQL financial trigger; synthetic temporary rows; all work rolled back",
      checks: rows,
      productionWrites: 0,
    };
    writeFileSync(
      "docs/qa/batch1-pack-phone-20261116/financial-guard.json",
      JSON.stringify(result, null, 2),
    );
    console.log(JSON.stringify({ passed: rows.length }));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
void main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
