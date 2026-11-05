/** Real PostgreSQL, loopback only. No hosted writes, customer inventory or funds. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import postgres from "postgres";
import { importDormantCommercialPool } from "./commercial-pool-import";
import type { DormantPoolDefinition } from "../src/core/commercial-pool-plan";
const url = new URL(process.env.COMMERCIAL_ACCEPTANCE_DB ?? "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/commercial_acceptance");
const sql = postgres(url.href, { max: 1, onnotice: () => {} });
const plan = JSON.parse(
  readFileSync(
    "private-data/commercial-pool-20261105/candidate.private.json",
    "utf8",
  ),
);
assert.equal(plan.projectRef, "pojoymtniryarxxunyvz");
const rows = plan.rows as DormantPoolDefinition[];
const checks: string[] = [];
async function main() {
  try {
    await sql.unsafe(
      "create role anon;create role authenticated;create role service_role;",
    );
    await sql.unsafe(
      readFileSync(
        "supabase/migrations/20261101120754_commercial_google_ledger.sql",
        "utf8",
      ),
    );
    const first = await importDormantCommercialPool(sql, rows);
    assert.equal(first.inserted, rows.length);
    checks.push("real-player candidate imports only dormant definitions");
    const again = await importDormantCommercialPool(sql, rows);
    assert.equal(again.inserted, 0);
    assert.equal(again.unchanged, rows.length);
    checks.push("exact retry preserves identifiers and snapshots");
    await assert.rejects(
      importDormantCommercialPool(sql, [
        { ...rows[0], lifetime_cap: rows[0].lifetime_cap + 1 },
      ]),
      /differs/,
    );
    checks.push("immutable cap/snapshot conflict rejected");
    await assert.rejects(
      importDormantCommercialPool(sql, [
        { ...rows[0], approved: true } as never,
      ]),
    );
    checks.push("approval cannot be smuggled through importer");
    await sql`update commercial_billing.control set sales_enabled=true where id`;
    await assert.rejects(importDormantCommercialPool(sql, rows), /gates/);
    await sql`update commercial_billing.control set sales_enabled=false where id`;
    checks.push("active economy rejects dormant import");
    const [integrity] =
      await sql`select (select count(*)::int from commercial_billing.definitions where approved or issued<>0 or legacy_issued<>0) invalid,(select count(*)::int from commercial_billing.accounts) accounts,(select count(*)::int from commercial_billing.receipts) receipts,(select count(*)::int from commercial_billing.cards) cards,(select count(*)::int from commercial_billing.packs) packs,(select count(*)::int from commercial_billing.journals) journals,(select count(*)::int from commercial_billing.products where approved) approved_products`;
    assert(Object.values(integrity).every((v) => v === 0));
    checks.push(
      "no cards, wallets, receipts, packs, journals or approved products created",
    );
    await sql`set role docked_commercial_app`;
    await assert.rejects(
      sql`insert into commercial_billing.definitions(player_id,sport,rarity,lifetime_cap,rights_reference,snapshot) values(${rows[0].player_id},'nrl','ICON',1,'unauthorised','{}')`,
      /permission denied/,
    );
    await sql`reset role`;
    checks.push("runtime role cannot provision or approve pool definitions");
    mkdirSync("docs/qa/commercial-pool-20261105", { recursive: true });
    const result = {
      at: new Date().toISOString(),
      engine: (await sql`select version()`)[0].version,
      definitions: rows.length,
      checks,
      passed: true,
      productionWrites: 0,
      inventoryIssued: 0,
      integrity,
    };
    writeFileSync(
      "docs/qa/commercial-pool-20261105/postgres.json",
      JSON.stringify(result, null, 2) + "\n",
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(
    e instanceof Error ? e.message : "Dormant pool rehearsal failed",
  );
  process.exitCode = 1;
});
