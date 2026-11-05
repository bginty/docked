/** Read-projection regression only. All mutations are synthetic setup/concurrent
 * writers in the existing disposable loopback PostgreSQL runner. No Google,
 * hosted database, customer account, permanent inventory or email access. */
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import postgres, { type Sql } from "postgres";
import { CommercialLedger } from "../src/server/commercial-ledger";
import {
  commercialPolicyVersion,
  commercialProducts,
  type CommercialReceipt,
} from "../src/core/commercial-billing";

const url = new URL(process.env.COMMERCIAL_ACCEPTANCE_DB ?? "");
assert.equal(
  url.hostname,
  "127.0.0.1",
  "Disposable loopback database required",
);
assert.equal(url.pathname, "/commercial_acceptance");
const sql = postgres(url.toString(), { max: 6, onnotice: () => {} });
const keyring = { active: "fixture", values: { fixture: randomBytes(32) } };
const ledger = new CommercialLedger(sql, "acceptance", keyring);
const member = randomUUID();
const peer = randomUUID();
const checks: string[] = [];
const modes: { isolation: string; readOnly: string }[] = [];
let receiptSequence = 0;
const receipt = (credits: 4900 | 9900, account: string) => {
  const token = `isolated-report-fixture-${++receiptSequence}`;
  const product = commercialProducts.find((p) => p.credits === credits)!;
  const r: CommercialReceipt = {
    key: createHash("sha256").update(`docked.fantasy\0${token}`).digest("hex"),
    account,
    environment: "acceptance",
    product,
    state: "PURCHASED",
    paid: true,
    consumed: false,
    orderId: `GPA.REPORT-FIXTURE-${receiptSequence}`,
    grossCents: product.audCents,
    refundedCents: 0,
    taxCents: null,
    providerAt: new Date().toISOString(),
  };
  return { r, token };
};
const accept = (value: ReturnType<typeof receipt>, user: string) =>
  ledger.accept(value.r, user, value.token, async () => {});

/** This observes actual queries/results, never substitutes a result. A separate
 * real connection commits the writer immediately after one aggregate completes. */
function observedSql(
  database: Sql,
  checkpoint: "receipts" | "lots",
  writer: () => Promise<unknown>,
) {
  let fired = false;
  const wrap = (connection: Sql): Sql =>
    new Proxy(connection, {
      apply(target, thisArg, args) {
        const result = Reflect.apply(target, thisArg, args);
        const text = Array.isArray(args[0]) ? args[0].join("?") : "";
        if (fired || !text.includes(`from commercial_billing.${checkpoint}`))
          return result;
        fired = true;
        return Promise.resolve(result).then(async (rows) => {
          await writer();
          return rows;
        });
      },
      get(target, property, receiver) {
        if (property !== "begin")
          return Reflect.get(target, property, receiver);
        return (options: string, run: (tx: Sql) => Promise<unknown>) =>
          target.begin(options, async (transaction) => {
            const tx = transaction as unknown as Sql;
            const [mode] =
              await tx`select current_setting('transaction_isolation') isolation,current_setting('transaction_read_only') read_only`;
            modes.push({ isolation: mode.isolation, readOnly: mode.read_only });
            return run(wrap(tx));
          });
      },
    }) as Sql;
  return { sql: wrap(database), fired: () => fired };
}
async function checkpointReport(
  checkpoint: "receipts" | "lots",
  writer: () => Promise<unknown>,
) {
  const observed = observedSql(sql, checkpoint, writer);
  const report = await new CommercialLedger(
    observed.sql,
    "acceptance",
    keyring,
  ).financialReport();
  assert.equal(observed.fired(), true, "Concurrent writer checkpoint reached");
  return report;
}
async function check(name: string, run: () => Promise<void>) {
  await run();
  checks.push(name);
  console.log(`PASS ${name}`);
}
async function fingerprint() {
  const [r] =
    await sql`select md5(jsonb_build_object('accounts',(select jsonb_agg(t order by member_id) from commercial_billing.accounts t),'receipts',(select jsonb_agg(t order by key) from commercial_billing.receipts t),'lots',(select jsonb_agg(t order by id) from commercial_billing.lots t),'journals',(select jsonb_agg(t order by id) from commercial_billing.journals t),'lines',(select jsonb_agg(t order by journal,n) from commercial_billing.lines t),'cases',(select jsonb_agg(t order by id) from commercial_billing.recovery_cases t),'audit',(select jsonb_agg(t order by id) from commercial_billing.audit t))::text) fingerprint`;
  return r.fingerprint;
}
async function main() {
  await sql.unsafe(
    "create role anon; create role authenticated; create role service_role;",
  );
  await sql.unsafe(
    readFileSync(
      "supabase/migrations/20261101120754_commercial_google_ledger.sql",
      "utf8",
    ),
  );
  const fixtureApprovals = {
    owner: "isolated-report-fixture",
    legal: "isolated-report-fixture",
    googlePlay: "isolated-report-fixture",
    privacy: "isolated-report-fixture",
    retention: "isolated-report-fixture",
    refundRecovery: "isolated-report-fixture",
    playerRights: "isolated-report-fixture",
    supplyReconciliation: "isolated-report-fixture",
    validUntil: "2099-01-01T00:00:00Z",
    withdrawals: false,
    prizes: false,
    paidEntry: false,
    nba: false,
  };
  await sql`update commercial_billing.control set environment='acceptance',sales_enabled=true,policy_version=${commercialPolicyVersion},approvals=${sql.json(fixtureApprovals)}`;
  await sql`update commercial_billing.products set approved=true`;
  const first = receipt(4900, "a".repeat(64));
  const second = receipt(9900, "b".repeat(64));
  await accept(first, member);
  await check(
    "concurrent purchase cannot mix receipt totals with newer wallet totals",
    async () => {
      const report = await checkpointReport("receipts", () =>
        accept(second, peer),
      );
      assert.equal(Number(report.gross_cents), 4900);
      assert.equal(report.outstandingCredits, 4900);
      assert.equal(Number(report.purchases), 1);
      assert.equal(Number(report.open_cases), 0);
      const current = await ledger.financialReport();
      assert.equal(Number(current.gross_cents), 14800);
      assert.equal(current.outstandingCredits, 14800);
    },
  );
  await check(
    "concurrent refund appears together in the next financial snapshot",
    async () => {
      const report = await checkpointReport("receipts", async () => {
        first.r = { ...first.r, state: "REVOKED", refundedCents: 4900 };
        return accept(first, member);
      });
      assert.equal(Number(report.refund_cents), 0);
      assert.equal(report.outstandingCredits, 14800);
      const current = await ledger.financialReport();
      assert.equal(Number(current.refund_cents), 4900);
      assert.equal(current.outstandingCredits, 9900);
      assert.equal((await ledger.wallet(peer)).balance, 9900);
    },
  );
  await check(
    "concurrent provider review cannot add a newer recovery case to older totals",
    async () => {
      const report = await checkpointReport("lots", async () => {
        second.r = { ...second.r, state: "REVIEW", refundedCents: 4950 };
        return accept(second, peer);
      });
      assert.equal(Number(report.review), 0);
      assert.equal(Number(report.open_cases), 0);
      const current = await ledger.financialReport();
      assert.equal(Number(current.review), 1);
      assert.equal(Number(current.open_cases), 1);
    },
  );
  await check(
    "report is read-only and reports its snapshot time without claiming provider settlement",
    async () => {
      const before = await fingerprint();
      const report = await ledger.financialReport();
      assert.equal(await fingerprint(), before);
      assert.ok(Number.isFinite(Date.parse(report.asOf)));
      assert.ok(Date.now() - Date.parse(report.asOf) < 60000);
      assert.equal(report.providerPayoutReconciled, false);
      assert.equal(report.providerFees, null);
      assert.equal(report.recognizedRevenue, null);
      assert.ok(modes.length >= 3);
      assert.ok(
        modes.every(
          (m) => m.isolation === "repeatable read" && m.readOnly === "on",
        ),
      );
      assert.equal(
        (await sql`select count(*)::int n from commercial_billing.cards`)[0].n,
        0,
      );
      assert.equal(
        (await sql`select count(*)::int n from commercial_billing.packs`)[0].n,
        0,
      );
    },
  );
  const report = {
    at: new Date().toISOString(),
    scope: "Disposable PostgreSQL only; no network provider/customer mutation",
    checks,
    modes,
    permanentInventoryIssued: 0,
    providerCalls: 0,
    hostedWrites: 0,
    snapshotReportingOnly: true,
  };
  const out = "docs/ops-launch-20261105/financial-report-snapshot";
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/postgres.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => sql.end({ timeout: 5 }));
