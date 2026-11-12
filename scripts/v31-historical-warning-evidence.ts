/** Genuine provider + original Preview correlation; all business APIs are GET.
 * No receipt token, order ID, account UUID, phone or credential leaves memory. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { googlePlayOAuth } from "../src/server/google-play-oauth";
import { GoogleCommercialVerifier } from "../src/server/google-commercial-verifier";
import { storeAccountId } from "../src/server/store-purchase-verification";
import { databaseConnectionOptions } from "../src/server/database-tls";
import { digest } from "../src/core/scoring-engine";
import { ownerDatabase } from "./owner-gameplay-db.mjs";
import { validateHistoricalWarnings } from "./lib/historical-warning-disposition";

const load = (file: string) => JSON.parse(readFileSync(file, "utf8"));
const warningManifest =
  "private-data/v31-revenue-launch-20261113/historical-notifications.private.json";
export const warningManifestSha256 =
  "e153fafab4ccc34aeb7892844a6e85fb5e10f484da8240f1088ac3881153427b";

async function main() {
  const output = process.argv[2];
  assert(
    output &&
      path.resolve(output).startsWith(path.resolve("docs/qa") + path.sep),
  );
  const bytes = readFileSync(warningManifest);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    warningManifestSha256,
  );
  const frozen = {
    rows: validateHistoricalWarnings(JSON.parse(bytes.toString("utf8")).rows),
  };
  assert.equal(frozen.rows.length, 7);
  const root = process.cwd();
  process.chdir("C:/Users/61412/Documents/ChatGPT/Docked.com.au");
  const production = ownerDatabase();
  const previewConfig = load("private-data/hosted-preview/connection.json");
  process.chdir(root);
  const previewUrl = new URL(previewConfig.databaseUrl);
  assert.equal(previewUrl.username, "postgres.bckkllmndoxzpzdqrevb");
  const preview = postgres(previewUrl.href, {
    ...databaseConnectionOptions(previewUrl.href, {
      DATABASE_SSL_CA_FILE: path.resolve("certs/supabase-prod-ca-2021.crt"),
    }),
    max: 1,
    onnotice: () => {},
  });
  const credentials = load(
    "C:/Users/61412/.docked-secrets/google-play-test-verifier.json",
  );
  assert.equal(
    credentials.client_email,
    "docked-play-test-verifier@docked-play-verification.iam.gserviceaccount.com",
  );
  const oauth = googlePlayOAuth(
    credentials.client_email,
    credentials.private_key,
  );
  const verifier = new GoogleCommercialVerifier("acceptance", oauth);
  const fixture = load(
    "C:/Users/61412/.codex/worktrees/fixed-market-live/Docked.com.au/private-data/restored-public-preview/fixture.private.json",
  );
  const binding = fixture.accountBinding;
  assert.equal(typeof binding, "string");
  const cases = [];
  try {
    for (const caseNumber of [1, 2, 3]) {
      const page = readFileSync(
        `private-data/v31-card-research-20261111/google-order-case${caseNumber}-20261112.private.txt`,
        "utf8",
      );
      const orderId =
        /The focused UI element is[^\n]+\/orders\/(GPA\.[\d.-]+)/.exec(
          page,
        )?.[1];
      assert(orderId, "Exact focused historical order reference required");
      const response = await fetch(
        "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/docked.fantasy/orders/" +
          encodeURIComponent(orderId),
        {
          headers: { Authorization: "Bearer " + (await oauth()) },
          redirect: "error",
          cache: "no-store",
          signal: AbortSignal.timeout(20000),
        },
      );
      assert(response.ok, "Historical provider order read unavailable");
      const order = await response.json();
      assert.equal(order.orderId, orderId);
      assert.equal(order.state, "REFUNDED");
      const key = createHash("sha256")
        .update("docked.fantasy\0" + order.purchaseToken)
        .digest("hex");
      const notifications = frozen.rows.filter((r) => r.receipt_key === key);
      assert.equal(notifications.length, caseNumber === 2 ? 3 : 2);
      const observed = await preview.begin(
        "isolation level repeatable read read only",
        async (tx) => {
          await tx`set local statement_timeout='30s'`;
          const rows =
            await tx`select * from commercial_billing.receipts where key=${key}`;
          assert.equal(rows.length, 1);
          const receipt = rows[0];
          assert.equal(receipt.order_id, orderId);
          assert.equal(receipt.environment, "acceptance");
          assert.equal(receipt.state, "REVOKED");
          assert.equal(
            receipt.account_binding,
            storeAccountId(receipt.member_id, binding),
          );
          const verified = await verifier.verify(
            order.purchaseToken,
            receipt.account_binding,
          );
          assert.equal(verified.environment, "acceptance");
          assert.equal(verified.state, "REVOKED");
          assert.equal(verified.key, key);
          const gross = caseNumber === 2 ? 9900 : 4900;
          assert.equal(Number(receipt.gross_cents), gross);
          assert.equal(Number(receipt.refunded_cents), gross);
          assert.equal(verified.refundedCents, gross);
          const [accounting] = await tx`select
          (select coalesce(sum(remaining),0)::int from commercial_billing.lots where receipt=${key}) remaining,
          (select count(*)::int from commercial_billing.jobs where receipt=${key} and state<>'done') outstanding_jobs,
          (select count(*)::int from (select l.journal from commercial_billing.lines l join commercial_billing.journals j on j.id=l.journal where j.receipt=${key} group by l.journal having sum(l.amount)<>0) q) unbalanced,
          (select count(*)::int from commercial_billing.journals where receipt=${key}) journals,
          (select count(*)::int from commercial_billing.recovery_cases where receipt=${key} and state='OPEN') open_holds,
          (select coalesce(sum(exposure_credits),0)::int from commercial_billing.recovery_cases where receipt=${key} and state='OPEN') exposure`;
          assert.equal(accounting.remaining, 0);
          assert.equal(accounting.outstanding_jobs, 0);
          assert.equal(accounting.unbalanced, 0);
          assert.equal(accounting.open_holds, caseNumber === 2 ? 1 : 0);
          assert.equal(accounting.exposure, caseNumber === 2 ? 5700 : 0);
          const [control] =
            await tx`select environment,sales_enabled,issuance_enabled,transfers_enabled,gameplay_enabled from commercial_billing.control where id`;
          assert.deepEqual(control, {
            environment: "acceptance",
            sales_enabled: false,
            issuance_enabled: false,
            transfers_enabled: false,
            gameplay_enabled: false,
          });
          return {
            caseNumber,
            receiptKeyDigest: key,
            providerVerified: true,
            originalMemberBindingVerified: true,
            providerOrderState: "REFUNDED",
            providerReceiptState: verified.state,
            environment: "acceptance",
            accounting,
            notificationCount: notifications.length,
            providerAt: verified.providerAt,
            receiptFingerprint: digest(receipt),
          };
        },
      );
      cases.push(observed);
    }
    const current = await production.begin(
      "isolation level repeatable read read only",
      async (tx) => {
        const rows =
          await tx`select to_jsonb(n) value from credits_sandbox.store_notifications n where id=any(${frozen.rows.map((r) => r.id)}) order by id`;
        assert.equal(digest(rows.map((r) => r.value)), digest(frozen.rows));
        return digest(rows.map((r) => r.value));
      },
    );
    const report = {
      at: new Date().toISOString(),
      verified: true,
      method:
        "Genuine Google GETs; original Preview receipt/member/refund ledger; exact Production notification readback",
      warningManifestSha256,
      notificationFingerprint: current,
      cases,
      productionWrites: 0,
      previewWrites: 0,
      providerBusinessMutations: 0,
      balanceChanges: 0,
      recoveryHoldsWaived: 0,
    };
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n", {
      flag: "wx",
    });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await Promise.allSettled([production.end(), preview.end()]);
  }
}
main().catch(() => {
  console.error(
    "Historical evidence validation failed. No business records were changed and no private provider values are included in this diagnostic.",
  );
  process.exitCode = 1;
});
