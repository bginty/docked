/** Reuse genuine historical evidence with the current verifier; GET/read-only only. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { googlePlayOAuth } from "../src/server/google-play-oauth";
import { GoogleCommercialVerifier } from "../src/server/google-commercial-verifier";
import { storeAccountId } from "../src/server/store-purchase-verification";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const previous = read(
  "docs/qa/v31-revenue-launch-20261113/historical-provider-evidence-final.json",
);
const connection = read(
  "C:/Users/61412/Documents/ChatGPT/Docked.com.au/private-data/hosted-preview/connection.json",
);
assert.equal(connection.projectRef, "bckkllmndoxzpzdqrevb");
const credential = read(
  "C:/Users/61412/.docked-secrets/google-play-test-verifier.json",
);
assert.equal(
  credential.client_email,
  "docked-play-test-verifier@docked-play-verification.iam.gserviceaccount.com",
);
const binding = read(
  "C:/Users/61412/.codex/worktrees/fixed-market-live/Docked.com.au/private-data/restored-public-preview/fixture.private.json",
).accountBinding;
const oauth = googlePlayOAuth(credential.client_email, credential.private_key);
const verifier = new GoogleCommercialVerifier("acceptance", oauth);
const sql = postgres(connection.databaseUrl, {
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
async function main() {
  try {
    const cases = [];
    for (const prior of previous.cases) {
      const observed = await sql.begin(
        "isolation level repeatable read read only",
        async (tx) => {
          await tx`set local statement_timeout='30s'`;
          const [receipt] =
            await tx`select * from commercial_billing.receipts where key=${prior.receiptKeyDigest}`;
          assert(
            receipt &&
              receipt.environment === "acceptance" &&
              receipt.state === "REVOKED",
          );
          assert.equal(
            receipt.account_binding,
            storeAccountId(receipt.member_id, binding),
          );
          const response = await fetch(
            "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/docked.fantasy/orders/" +
              encodeURIComponent(receipt.order_id),
            {
              headers: { Authorization: "Bearer " + (await oauth()) },
              redirect: "error",
              cache: "no-store",
              signal: AbortSignal.timeout(20000),
            },
          );
          assert(response.ok);
          const order = await response.json();
          assert.equal(order.orderId, receipt.order_id);
          assert.equal(order.state, "REFUNDED");
          const verified = await verifier.verify(
            order.purchaseToken,
            receipt.account_binding,
          );
          assert.equal(verified.key, receipt.key);
          assert.equal(verified.state, "REVOKED");
          assert.equal(verified.environment, "acceptance");
          assert.equal(verified.refundedCents, Number(receipt.refunded_cents));
          const [accounting] = await tx`select
          (select coalesce(sum(remaining),0)::int from commercial_billing.lots where receipt=${receipt.key}) remaining,
          (select count(*)::int from commercial_billing.jobs where receipt=${receipt.key} and state<>'done') unfinished_jobs,
          (select count(*)::int from (select l.journal from commercial_billing.lines l join commercial_billing.journals j on j.id=l.journal where j.receipt=${receipt.key} group by l.journal having sum(l.amount)<>0) q) unbalanced,
          (select coalesce(sum(exposure_credits),0)::int from commercial_billing.recovery_cases where receipt=${receipt.key} and state='OPEN') recovery_exposure`;
          assert.equal(accounting.remaining, 0);
          assert.equal(accounting.unfinished_jobs, 0);
          assert.equal(accounting.unbalanced, 0);
          assert.equal(
            accounting.recovery_exposure,
            prior.caseNumber === 2 ? 5700 : 0,
          );
          return {
            caseNumber: prior.caseNumber,
            receiptDigest: receipt.key,
            product: verified.product.id,
            grossCents: verified.grossCents,
            refundedCents: verified.refundedCents,
            providerState: order.state,
            currentVerifierState: verified.state,
            consumed: verified.consumed,
            bindingVerified: true,
            accounting,
          };
        },
      );
      cases.push(observed);
    }
    assert.equal(cases.length, 3);
    const result = {
      at: new Date().toISOString(),
      currentSource: "76df44ba1adef012c5ec2119563cbc05ff9e3c0b",
      cases,
      actualHistoricalGoogleTestsAccepted: true,
      newPurchases: 0,
      newRefunds: 0,
      databaseWrites: 0,
      providerBusinessMutations: 0,
      productionAccess: false,
      note: "Fresh provider GETs through the deployed verifier. Retains earlier device/consume/notification evidence; does not manufacture a new checkout or Production settlement.",
    };
    writeFileSync(
      "docs/qa/final-release-decision-20261117/historical-google-revalidated.json",
      JSON.stringify(result, null, 2) + "\n",
      { flag: "wx" },
    );
    console.log(JSON.stringify(result));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch(() => {
  console.error(
    "Historical read-only evidence review failed; private provider and account values suppressed.",
  );
  process.exitCode = 1;
});
