/** Real PostgreSQL, loopback only. No hosted writes, customer inventory or funds. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import postgres from "postgres";
import { importDormantCommercialPool } from "./commercial-pool-import";
import type { DormantPoolDefinition } from "../src/core/commercial-pool-plan";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { CommercialLedger } from "../src/server/commercial-ledger";
import { commercialCardSnapshot } from "../src/core/commercial-presentation";
import {
  commercialPack,
  commercialPolicyVersion,
  commercialProducts,
  commercialSports,
  type CommercialReceipt,
} from "../src/core/commercial-billing";
function option(flag: string, fallback: string) {
  const at = process.argv.indexOf(flag);
  if (at < 0) return fallback;
  const value = process.argv[at + 1];
  assert(value && !value.startsWith("--"), `${flag} requires a path`);
  return value;
}
const candidateFile = path.resolve(
  option(
    "--candidate",
    "private-data/commercial-pool-20261105/candidate.private.json",
  ),
);
const evidenceDir = path.resolve(
  option("--evidence", "docs/qa/commercial-pool-20261105"),
);
assert(candidateFile.startsWith(path.resolve("private-data") + path.sep));
assert(evidenceDir.startsWith(path.resolve("docs") + path.sep));
const url = new URL(process.env.COMMERCIAL_ACCEPTANCE_DB ?? "");
assert.equal(url.hostname, "127.0.0.1");
assert.equal(url.pathname, "/commercial_acceptance");
const sql = postgres(url.href, { max: 1, onnotice: () => {} });
const plan = JSON.parse(readFileSync(candidateFile, "utf8"));
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
    await sql`reset role`;
    // Trusted provider result fixtures exercise the commercial SQL path with the
    // exact verified real-player snapshot. This is NOT a Google charge/receipt
    // verification or an approval to mint those cards outside this local DB.
    const approvals = Object.fromEntries(
      [
        "owner",
        "legal",
        "googlePlay",
        "privacy",
        "retention",
        "refundRecovery",
        "playerRights",
        "supplyReconciliation",
      ].map((key) => [key, "ISOLATED DATABASE FIXTURE ONLY"]),
    );
    Object.assign(approvals, {
      validUntil: "2099-01-01T00:00:00Z",
      withdrawals: false,
      prizes: false,
      paidEntry: false,
      nba: false,
    });
    await sql`update commercial_billing.control set sales_enabled=true,issuance_enabled=true,policy_version=${commercialPolicyVersion},approvals=${sql.json(approvals)} where id`;
    await sql`update commercial_billing.products set approved=true`;
    await sql`update commercial_billing.definitions set approved=true`;
    const ledger = new CommercialLedger(sql, "commercial", {
      active: "isolated",
      values: { isolated: randomBytes(32) },
    });
    const authorize = async () => {};
    let fixtureCards = 0;
    for (const sport of commercialSports)
      for (const family of ["STANDARD", "PREMIUM"] as const) {
        const member = randomUUID(),
          token = `isolated-source-pool-${member}`;
        const product = commercialProducts.find((p) => p.credits === 9900)!;
        const receipt: CommercialReceipt = {
          key: createHash("sha256")
            .update("docked.fantasy\0" + token)
            .digest("hex"),
          account: "f".repeat(64),
          environment: "commercial",
          product,
          state: "PURCHASED",
          consumed: false,
          paid: true,
          orderId: `ISOLATED-${member}`,
          grossCents: product.audCents,
          taxCents: null,
          refundedCents: 0,
          providerAt: new Date().toISOString(),
        };
        await ledger.accept(receipt, member, token, authorize);
        const p = commercialPack(sport, family, 9),
          request = randomUUID();
        const input = {
          sport,
          family,
          size: 9 as const,
          confirmed: true as const,
          configurationHash: p.configurationHash,
        };
        const bought = await ledger.buyPack(member, request, input, authorize);
        assert.deepEqual(
          await ledger.buyPack(member, request, input, authorize),
          bought,
        );
        const opened = await ledger.openPack(member, bought.id, authorize);
        assert.equal(opened.cards.length, 9);
        assert.equal(new Set(opened.cards.map((c) => c.player_id)).size, 9);
        assert(
          opened.cards.every(
            (c) =>
              c.sport === sport &&
              c.rarity !== "CORE" &&
              commercialCardSnapshot.parse(c.snapshot).synthetic === false,
          ),
        );
        fixtureCards += opened.cards.length;
        const [before] =
          await sql`select md5(string_agg(c::text,',' order by c.id)) h from commercial_billing.cards c where pack=${bought.id}`;
        await ledger.accept(
          {
            ...receipt,
            state: "REVOKED",
            refundedCents: product.audCents,
            providerAt: new Date(Date.now() + 1000).toISOString(),
          },
          member,
          token,
          authorize,
        );
        assert.equal((await ledger.wallet(member)).balance, 0);
        assert.equal((await ledger.wallet(member)).spendable, 0);
        assert.equal((await ledger.wallet(member)).reviewRequired, true);
        assert.equal(
          (
            await sql`select md5(string_agg(c::text,',' order by c.id)) h from commercial_billing.cards c where pack=${bought.id}`
          )[0].h,
          before.h,
        );
        assert.deepEqual(
          await ledger.openPack(member, bought.id, authorize),
          opened,
        );
      }
    checks.push(
      "exact source snapshot supports six Standard/Premium nine-card commercial-like fixture purchases and refunded inventory preservation",
    );
    await sql`update commercial_billing.control set sales_enabled=false,issuance_enabled=false where id`;
    await sql`update commercial_billing.products set approved=false`;
    const [beforeReset] =
      await sql`select md5(string_agg(d::text,',' order by d.id)) h from commercial_billing.definitions d`;
    await assert.rejects(importDormantCommercialPool(sql, rows), /differs/);
    assert.equal(
      (
        await sql`select md5(string_agg(d::text,',' order by d.id)) h from commercial_billing.definitions d`
      )[0].h,
      beforeReset.h,
    );
    assert.equal(
      (await sql`select count(*)::int n from commercial_billing.cards`)[0].n,
      fixtureCards,
    );
    checks.push(
      "a dormant retry cannot reset already issued lifetime counters or rewrite preserved cards",
    );
    mkdirSync(evidenceDir, { recursive: true });
    const result = {
      at: new Date().toISOString(),
      engine: (await sql`select version()`)[0].version,
      definitions: rows.length,
      checks,
      passed: true,
      productionWrites: 0,
      productionInventoryIssued: 0,
      providerCalls: 0,
      realPayments: 0,
      fixtureCards,
      dormantImportIntegrity: integrity,
      candidateSha256: createHash("sha256")
        .update(readFileSync(candidateFile))
        .digest("hex"),
    };
    writeFileSync(
      path.join(evidenceDir, "postgres.json"),
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
