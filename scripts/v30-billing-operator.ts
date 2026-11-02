/** Scoped acceptance operator. Never accepts a Production URL or arbitrary order. */
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { CommercialLedger } from "../src/server/commercial-ledger";
import { GoogleCommercialVerifier } from "../src/server/google-commercial-verifier";
import { googlePlayOAuth } from "../src/server/google-play-oauth";
const dir = "private-data/restored-public-preview";
const f = JSON.parse(readFileSync(dir + "/fixture.private.json", "utf8"));
const b = JSON.parse(readFileSync(dir + "/billing.private.json", "utf8"));
assert.equal(f.projectRef, "bckkllmndoxzpzdqrevb");
assert.equal(b.projectRef, f.projectRef);
assert(new URL(f.commerce).username.endsWith("." + f.projectRef));
const sql = postgres(f.commerce, {
  max: 1,
  ssl: {
    rejectUnauthorized: true,
    ca: readFileSync("certs/supabase-prod-ca-2021.crt", "utf8"),
  },
  onnotice: () => {},
});
const ledger = new CommercialLedger(sql, "acceptance", {
  active: "v1",
  values: { v1: Buffer.from(f.referenceKey, "hex") },
});
const key = JSON.parse(
  readFileSync(
    "C:/Users/61412/.docked-secrets/google-play-test-verifier.json",
    "utf8",
  ),
);
assert.equal(
  key.client_email,
  "docked-play-test-verifier@docked-play-verification.iam.gserviceaccount.com",
);
const oauth = googlePlayOAuth(key.client_email, key.private_key);
const verifier = new GoogleCommercialVerifier("acceptance", oauth);
const env = JSON.parse(
  readFileSync(
    "C:/Users/61412/.codex/worktrees/v30-transport/Docked.com.au/private-data/v30-transport/env.private.json",
    "utf8",
  ),
);
const mode = process.argv[2];
async function main() {
  try {
    const [c] =
      await sql`select environment from commercial_billing.control where id`;
    assert.equal(c.environment, "acceptance");
    if (mode === "worker") {
      const r = await fetch(
        env.DOCKED_V30_TRANSPORT_TARGET +
          "/api/store/google/commercial/reconcile",
        {
          method: "POST",
          headers: {
            authorization: "Bearer " + f.accountBinding,
            "x-vercel-trusted-oidc-idp-token": env.DOCKED_V30_TRANSPORT_OIDC,
          },
          redirect: "error",
          signal: AbortSignal.timeout(55000),
        },
      );
      assert.equal(r.status, 200);
      console.log(JSON.stringify({ worker: await r.json() }));
    } else if (mode === "refund") {
      const product = process.argv[3];
      assert(
        ["docked_credits_4900_v1", "docked_credits_9900_v1"].includes(product),
      );
      const rows =
        await sql`select key from commercial_billing.receipts where member_id=${b.member} and product->>'id'=${product} order by created_at desc`;
      assert.equal(
        rows.length,
        1,
        "Exactly one current acceptance purchase required",
      );
      const ref = await ledger.reference(rows[0].key);
      assert(ref && ref.member_id === b.member);
      const r = await verifier.verify(ref.token, ref.account_binding);
      assert.equal(r.environment, "acceptance");
      assert.equal(r.product.id, product);
      assert.equal(r.state, "PURCHASED");
      assert(
        r.orderId && r.consumed,
        "Consume acknowledgement must precede refund test",
      );
      const res = await fetch(
        "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/docked.fantasy/orders/" +
          encodeURIComponent(r.orderId) +
          ":refund?revoke=true",
        {
          method: "POST",
          headers: { authorization: "Bearer " + (await oauth()) },
          redirect: "error",
          signal: AbortSignal.timeout(20000),
        },
      );
      assert(res.ok, "Google test refund request failed");
      console.log(
        JSON.stringify({
          refundRequested: true,
          product,
          orderId: r.orderId,
          testOnly: true,
        }),
      );
    } else assert.equal(mode, "read");
    const receipts =
      await sql`select key,product,state,gross_cents,refunded_cents,created_at,updated_at from commercial_billing.receipts where member_id=${b.member} order by created_at`;
    const jobs =
      await sql`select id,kind,state,attempts,created_at,completed_at,last_error from commercial_billing.jobs order by created_at`;
    const [counts] =
      await sql`select (select count(*)::int from commercial_billing.cards where owner_id=${b.member}) cards,(select count(*)::int from commercial_billing.packs where member_id=${b.member}) packs`;
    const data = {
      at: new Date().toISOString(),
      wallet: await ledger.wallet(b.member),
      receipts,
      jobs,
      counts,
    };
    writeFileSync(
      "docs/qa/v30-customer-billing-20261102/ledger-latest.json",
      JSON.stringify(data, null, 2),
    );
    console.log(JSON.stringify(data));
  } finally {
    await sql.end();
  }
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : "Acceptance operation failed");
  process.exitCode = 1;
});
