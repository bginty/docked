import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { ownerDatabase, projectRef } from "./owner-gameplay-db.mjs";
import {
  sevenPlayerPackUpgrade,
  eligibleCatalogue,
} from "../src/core/card-economy";
import { validateCredits } from "../src/core/credits-sandbox";
import { digest } from "../src/core/scoring-engine";
async function main() {
  const apply = process.argv.includes("--apply"),
    file = "20261013223206_barry_beta_review_projection.sql",
    source = readFileSync("supabase/migrations/" + file, "utf8").replaceAll(
      "\r\n",
      "\n",
    ),
    sql = ownerDatabase();
  mkdirSync("docs/qa/barry-review", { recursive: true });
  mkdirSync("private-data/barry-review", { recursive: true });
  let receipt: any;
  try {
    if (apply)
      assert.equal(
        JSON.parse(
          readFileSync("docs/qa/barry-review/migration-check.json", "utf8"),
        ).sourceHash,
        digest(source),
      );
    try {
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(71820342)`;
        const [row] =
          await tx`select revision,document from credits_sandbox.state where id for update`;
        const before = structuredClone(row.document),
          state = structuredClone(before);
        const old =
          await tx`select statements from supabase_migrations.schema_migrations where version=${file.slice(0, 14)}`;
        if (!old.length) {
          const definitions =
            await tx`select pg_get_functiondef('sports_feed.seven_inventory(uuid)'::regprocedure) inventory,pg_get_functiondef('sports_feed.nfl_standings()'::regprocedure) standings`;
          if (apply)
            writeFileSync(
              "private-data/barry-review/prior-functions.json",
              JSON.stringify(definitions),
            );
          await tx.unsafe(source);
          await tx`insert into supabase_migrations.schema_migrations(version,name,statements) values(${file.slice(0, 14)},'barry_beta_review_projection',${[source]})`;
        } else
          assert.equal(
            digest(old[0].statements[0].replaceAll("\r\n", "\n")),
            digest(source),
          );
        const [{ now }] =
          await tx`select (extract(epoch from clock_timestamp())*1000)::bigint now`;
        sevenPlayerPackUpgrade(state.economy, Number(now));
        validateCredits(state);
        const strip = (v: any) => {
          const x = structuredClone(v);
          delete x.economy.products;
          delete x.economy.activeProductVersions;
          return x;
        };
        assert.equal(
          digest(strip(state)),
          digest(strip(before)),
          "No cards, balances, grants, supply, pack receipts or historical records may change",
        );
        for (const id of state.economy.activeProductVersions) {
          const p = state.economy.products[id];
          await tx`insert into credits_sandbox.pack_configuration values(${id},${tx.json(p)}) on conflict do nothing`;
          const [saved] =
            await tx`select document from credits_sandbox.pack_configuration where version=${id}`;
          assert.deepEqual(saved.document, p);
        }
        if (digest(state) !== digest(before)) {
          const revision = Number(row.revision) + 1;
          await tx`insert into credits_sandbox.history(revision,actor,request,document) values(${revision},'owner-authorised-product-update','seven-pack-v2',${tx.json(state)})`;
          await tx`update credits_sandbox.state set revision=${revision},document=${tx.json(state)} where id`;
        }
        // Unknown/ordinary Data API callers cannot call the privileged read-model directly.
        for (const role of ["anon", "authenticated", "service_role"])
          assert.equal(
            (
              await tx`select has_function_privilege(${role},'sports_feed.member_review_context()','execute') allowed`
            )[0].allowed,
            false,
          );
        // Validate function execution and own-state projection through existing synthetic member context.
        const qa = JSON.parse(
          readFileSync("private-data/customer-hosted-qa/identity.json", "utf8"),
        );
        const ownInventory = (
          await tx`select sports_feed.seven_inventory(${qa.id}::uuid) inventory`
        )[0].inventory;
        assert.ok(Array.isArray(ownInventory));
        receipt = {
          at: new Date().toISOString(),
          projectRef,
          sourceHash: digest(source),
          migration: file,
          passed: true,
          applied: apply,
          protectedAssetsUnchanged: true,
          products: state.economy.activeProductVersions.map((id: string) => ({
            id,
            positions: state.economy.products[id].positions,
            eligiblePlayers: eligibleCatalogue(
              state.economy,
              state.economy.products[id],
              Number(now),
            ).length,
            weights: state.economy.products[id].weights,
          })),
          priorRevision: row.revision,
        };
        await tx`insert into beta_private.audit_events(actor,action,subject,details) values('owner-authorised-operator','barry_review_release',${file},${tx.json(receipt)})`;
        if (!apply) throw Error("EXPECTED_REVIEW_ROLLBACK");
      });
    } catch (e) {
      if (
        apply ||
        !(e instanceof Error) ||
        e.message !== "EXPECTED_REVIEW_ROLLBACK"
      )
        throw e;
    }
    writeFileSync(
      `docs/qa/barry-review/migration-${apply ? "applied" : "check"}.json`,
      JSON.stringify(receipt, null, 2),
    );
    console.log(receipt);
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
