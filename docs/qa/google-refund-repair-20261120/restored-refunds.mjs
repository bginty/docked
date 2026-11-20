// Run inside the loopback namespace of the network-disabled, authenticated restore.
// Google transport, SMS and customer identities never leave this disposable fixture.
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  createHash,
  randomUUID,
  randomBytes,
  generateKeyPairSync,
} from "node:crypto";
import postgres from "postgres";
import { POST as subscribedCallback } from "../../../src/app/api/store/google/notifications/route";
import { GET as scheduled } from "../../../src/app/api/store/google/scheduled/route";
import { commercialRuntime } from "../../../src/server/commercial-runtime";
import { CommercialReconciliation } from "../../../src/server/commercial-reconciliation";
import {
  commercialPack,
  commercialPolicyVersion,
  commercialProducts,
} from "../../../src/core/commercial-billing";
import { googleNotificationRequest } from "../../../src/server/google-reconciliation-http";
import { verifyGooglePush } from "../../../src/server/google-store-notifications";
import { SignJWT, createLocalJWKSet, exportJWK } from "jose";

const native = process.env.REFUND_FIXTURE_PORT !== undefined;
const port = native ? Number(process.env.REFUND_FIXTURE_PORT) : 5432;
const dir = native ? process.env.REFUND_FIXTURE_INPUT : "/fixture";
if (native) {
  assert(Number.isInteger(port) && port >= 1024 && port <= 65535);
  assert.match(process.env.REFUND_FIXTURE_PASSWORD, /^[0-9a-f]{64}$/);
}
const dbName = native ? "docked_refund_fixture_20261120" : "postgres";
const local = (role) =>
  "postgres://" +
  role +
  (native ? ":" + process.env.REFUND_FIXTURE_PASSWORD : "") +
  "@127.0.0.1:" +
  port +
  "/" +
  dbName;
const customerStates = [],
  checks = [],
  fee = { currencyCode: "AUD", units: "49" };
const sha = (s) => createHash("sha256").update(s).digest("hex");
const report = () => ({
  at: new Date().toISOString(),
  checks,
  network: native
    ? "loopback database, intercepted offline Google transport"
    : "none",
  backend:
    "actual commercial scheduler route, verifier, restricted SQL runtime and ledger",
  provider: "synthetic Google order responses",
  hosted: false,
  externalTransactions: 0,
  productionWrites: 0,
});
const ok = (name) => {
  checks.push(name);
  console.log("PASS " + name);
};
const admin = postgres(local("postgres"), { max: 1, prepare: false });
async function main() {
  const modes = JSON.parse(fs.readFileSync(dir + "/environments.json", "utf8"));
  Object.assign(
    process.env,
    modes.find((v) => v.name === "closed").projection,
    {
      DATABASE_URL: local("docked_app"),
      DOCKED_COMMERCIAL_DATABASE_URL: local("docked_commercial_runtime"),
      DOCKED_COMMERCIAL_REFERENCE_KEY: randomBytes(32).toString("hex"),
      DOCKED_COMMERCIAL_REFERENCE_KEY_ID: "v1",
      CRON_SECRET: randomBytes(32).toString("hex"),
      DOCKED_GOOGLE_COMMERCIAL_SERVICE_EMAIL:
        "fixture@synthetic.iam.gserviceaccount.com",
      DOCKED_GOOGLE_COMMERCIAL_PRIVATE_KEY: generateKeyPairSync("rsa", {
        modulusLength: 2048,
      })
        .privateKey.export({ format: "pem", type: "pkcs8" })
        .toString(),
    },
  );
  const [control] =
    await admin`select current_database() db,current_setting('cron.launch_active_jobs') cron,current_setting('docked.refund_fixture',true) marker,inet_server_addr()::text address,(select count(*)::int from commercial_billing.receipts) receipts`;
  assert.equal(control.db, dbName);
  assert.equal(control.marker, "refund-repair-20261120");
  assert.equal(control.cron, "off");
  assert.match(control.address, /^127\.0\.0\.1/);
  assert.equal(control.receipts, 0);
  const histTables = native
    ? ["fixture.archived_history"]
    : [
        "credits_sandbox.store_receipts",
        "credits_sandbox.state",
        "beta_packs.issued",
        "launch_transition.accounts",
      ];
  const fingerprints = async (tables) => {
    const out = {};
    for (const t of tables) {
      const [v] = await admin.unsafe(
        "select md5(coalesce(string_agg(h,'' order by h),'')) digest from(select md5(to_jsonb(x)::text) h from " +
          t +
          " x)s",
      );
      out[t] = v.digest;
    }
    return out;
  };
  const history = await fingerprints(histTables);
  const [hist] = native
    ? await admin`select google_count as n from fixture.archived_history where relation_name='credits_sandbox.store_receipts'`
    : await admin`select count(*)::int n from credits_sandbox.store_receipts where provider='google'`;
  assert(hist.n >= 3);
  let runtime, ledger;
  const pack = commercialPack("afl", "PREMIUM", 1),
    product = commercialProducts.find((p) => p.credits === 4900);
  const flags = async (open) => {
    await admin`update commercial_billing.control set sales_enabled=${open},issuance_enabled=${open} where id`;
  };
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
    ].map((k) => [k, "isolated-only-fixture"]),
  );
  Object.assign(approvals, {
    validUntil: new Date(Date.now() + 3600000).toISOString(),
    withdrawals: false,
    prizes: false,
    paidEntry: false,
    nba: false,
  });
  const ids = JSON.parse(fs.readFileSync(dir + "/eligible.json"));
  assert.equal(
    sha(JSON.stringify([...ids].sort())),
    "1956d1715dcd2ef494dad469f8b272951853d5d76773fe9ae39f5537996e6830",
  );
  await admin`update commercial_billing.control set policy_version=${commercialPolicyVersion},approvals=${admin.json(approvals)} where id`;
  await admin`update commercial_billing.products set approved=true`;
  await admin`update commercial_billing.definitions set approved=true where sport='afl' and id=any(${ids}::uuid[])`;
  const allowed = async () => {};
  const buy = (f) =>
    ledger.buyPack(
      f.member,
      randomUUID(),
      {
        sport: "afl",
        family: "PREMIUM",
        size: 1,
        confirmed: true,
        configurationHash: pack.configurationHash,
      },
      allowed,
    );
  let clock = Date.now(),
    reads = 0,
    outage = false;
  globalThis.fetch = async (input, init = {}) => {
    const u = new URL(String(input));
    if (
      u.href === "https://oauth2.googleapis.com/token" &&
      init.method === "POST"
    )
      return Response.json({
        access_token: "disposable-offline",
        expires_in: 3600,
      });
    assert.equal(init.method, "GET");
    assert.equal(u.origin, "https://androidpublisher.googleapis.com");
    assert.equal(init.headers.Authorization, "Bearer disposable-offline");
    reads++;
    if (outage) return new Response(null, { status: 503 });
    const id = decodeURIComponent(u.pathname.split("/").at(-1));
    const f = customerStates.find((v) => id === v.token || id === v.order);
    assert(f);
    if (id === f.token)
      return Response.json({
        orderId: f.order,
        purchaseStateContext: {
          purchaseState: f.refunded ? "CANCELLED" : "PURCHASED",
        },
        obfuscatedExternalAccountId: f.account,
        regionCode: "AU",
        productLineItem: [
          {
            productId: product.id,
            productOfferDetails: {
              quantity: 1,
              refundableQuantity: f.refunded ? 0 : 1,
              purchaseOptionId: "buy-au",
              consumptionState: "CONSUMPTION_STATE_CONSUMED",
            },
          },
        ],
      });
    return Response.json({
      purchaseToken: f.token,
      orderId: f.order,
      state: f.refunded ? "REFUNDED" : "PROCESSED",
      lastEventTime: f.updated,
      total: fee,
      lineItems: [
        {
          productId: product.id,
          oneTimePurchaseDetails: { quantity: 1, purchaseOptionId: "buy-au" },
        },
      ],
      orderHistory: f.refunded
        ? { refundEvent: { refundDetails: { total: fee } } }
        : {},
    });
  };
  runtime = await commercialRuntime();
  ({ ledger } = runtime);
  const seedWorker = new CommercialReconciliation(
    ledger,
    runtime.verifier,
    async (member) => customerStates.some((f) => f.member === member),
  );
  // The reviewed launch preparation closes both historical private grant flags first.
  if (!native)
    await admin`update beta_packs.control set enabled=false,grants_enabled=false where id`;
  await flags(true);
  for (const [idx, packs] of [0, 1, 7, 0].entries()) {
    const f = {
      member: randomUUID(),
      token: randomUUID(),
      order: "GPA.0000-0000-" + idx,
      account: sha(randomUUID()),
      updated: new Date(++clock).toISOString(),
      refunded: false,
      spent: packs * 700,
    };
    customerStates.push(f);
    f.key = sha("docked.fantasy\0" + f.token);
    const receipt = await runtime.verifier.verify(f.token, f.account);
    assert(receipt.consumed);
    await ledger.accept(receipt, f.member, f.token, allowed);
    assert(await seedWorker.acknowledgeReceipt(f.key, f.member));
    for (let i = 0; i < packs; i++) await buy(f);
    assert.equal((await ledger.wallet(f.member)).spendable, 4900 - f.spent);
  }
  await flags(false);
  // The four newly bound, consumed receipts represent the normal six-hour polling interval.
  // Later move only the missed-notification case to its next due time.
  await admin`update commercial_billing.receipts set next_reconcile_at=clock_timestamp()+interval '6 hours'`;
  const ownership = await fingerprints([
    "commercial_billing.cards",
    "commercial_billing.ownership_events",
    "commercial_billing.definitions",
    "commercial_billing.packs",
  ]);
  const [ownerCounts] =
    await admin`select count(*)::int cards from commercial_billing.cards`;
  assert.equal(ownerCounts.cards, 8);
  const tick = async (expectedStatus = 200) => {
    const res = await scheduled(
      new Request("https://docked.com.au/api/store/google/scheduled", {
        headers: { authorization: "Bearer " + process.env.CRON_SECRET },
      }),
    );
    assert.equal(res.status, expectedStatus);
    const b = await res.json();
    assert.deepEqual(Object.keys(b.services), ["commercial"]);
    return b.services.commercial;
  };
  for (const mode of modes) {
    Object.assign(process.env, mode.projection);
    const baselineHealth = await tick();
    assert.equal(baselineHealth.attentionRequired, false);
    const rejection = await subscribedCallback(
      new Request(mode.projection.DOCKED_GOOGLE_COMMERCIAL_PUSH_AUDIENCE, {
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
    assert.equal(rejection.status, 401);
  }
  ok(
    "All three effective environments invoke the real scheduled commercial worker with retired beta excluded",
  );
  const policy = {
    audience:
      "https://subscription.example.invalid/api/store/google/notifications",
    serviceAccount: "fixture@synthetic.iam.gserviceaccount.com",
    subscription: "projects/synthetic/subscriptions/synthetic",
    packageName: "docked.fantasy",
  };
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = await exportJWK(publicKey);
  const keyset = createLocalJWKSet({
    keys: [{ ...jwk, kid: "fixture", alg: "RS256" }],
  });
  const jwt = await new SignJWT({
    email: policy.serviceAccount,
    email_verified: true,
  })
    .setProtectedHeader({ alg: "RS256", kid: "fixture" })
    .setSubject("synthetic-user")
    .setIssuedAt()
    .setExpirationTime("5m")
    .setAudience(policy.audience)
    .setIssuer("https://accounts.google.com")
    .sign(privateKey);
  async function notify(f, id, kind = "void", canWrite = true, signed = true) {
    const notice =
      kind === "void"
        ? {
            voidedPurchaseNotification: {
              purchaseToken: f.token,
              productType: 2,
            },
          }
        : {
            oneTimeProductNotification: {
              purchaseToken: f.token,
              sku: product.id,
              notificationType: 1,
            },
          };
    const msg = {
      packageName: policy.packageName,
      eventTimeMillis: String(clock - (kind === "purchase" ? 20000 : 0)),
      ...notice,
    };
    return googleNotificationRequest(
      new Request(policy.audience, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(signed ? { authorization: "Bearer " + jwt } : {}),
        },
        body: JSON.stringify({
          subscription: policy.subscription,
          message: {
            messageId: id,
            data: Buffer.from(JSON.stringify(msg)).toString("base64"),
          },
        }),
      }),
      {
        policy,
        verify: (req, p) => verifyGooglePush(req, p, keyset),
        enqueue: async (n) => {
          if (!canWrite) throw Error("isolated persistence failure");
          return runtime.worker.enqueue(n);
        },
      },
    );
  }
  const [unspent, partial, full, nonrefunded] = customerStates;
  for (const f of [unspent, partial, full]) {
    f.refunded = true;
    f.updated = new Date(++clock).toISOString();
  }
  assert.equal(
    (await notify(unspent, "first", "void", true, false)).status,
    401,
  );
  assert.equal((await notify(unspent, "first", "void", false)).status, 503);
  const beforeReads = reads;
  assert.equal((await notify(unspent, "first")).status, 204);
  const [pending] =
    await admin`select count(*)::int n from commercial_billing.jobs where kind='verify' and receipt=${unspent.key} and state='pending'`;
  assert.equal(pending.n, 1);
  assert.equal((await ledger.wallet(unspent.member)).spendable, 4900);
  assert.equal((await notify(unspent, "first")).status, 204);
  assert.equal(reads, beforeReads);
  ok(
    "Signed fixture persisted before 204, duplicate acknowledged once, unsigned denied and failed persistence retryable; push alone cannot adjust credits",
  );
  await tick();
  assert(reads >= beforeReads + 2);
  assert.equal((await ledger.wallet(unspent.member)).spendable, 0);
  assert.equal((await ledger.wallet(unspent.member)).reviewRequired, false);
  ok("Unspent refund authoritatively verified and reversed");
  assert.equal((await notify(partial, "partial")).status, 204);
  outage = true;
  const failed = await tick(503);
  assert(failed.retrying >= 1 && failed.attentionRequired);
  const [job] =
    await admin`select state,attempts,next_attempt_at>clock_timestamp() backoff from commercial_billing.jobs where receipt=${partial.key} and kind='verify'`;
  assert.equal(job.state, "pending");
  assert(job.backoff && job.attempts === 1);
  assert.equal((await ledger.wallet(partial.member)).spendable, 4200);
  outage = false;
  await admin`update commercial_billing.jobs set next_attempt_at=clock_timestamp() where receipt=${partial.key} and state='pending'`;
  await tick();
  ok(
    "Provider outage retained the leased job with backoff, reported attention, and recovered on the retry",
  );
  await admin`update commercial_billing.receipts set next_reconcile_at=clock_timestamp() where key=${full.key}`;
  const polled = await tick();
  assert(polled.scheduled >= 1);
  ok(
    "Missed push recovered from the scheduled recheck of an already consumed and fully spent purchase",
  );
  assert.equal((await notify(unspent, "old-purchase", "purchase")).status, 204);
  await tick();
  for (const f of [unspent, partial, full]) {
    const [j] =
      await admin`select (select count(*)::int from commercial_billing.journals where receipt=${f.key} and reason like 'Verified provider refund%') n, (select coalesce(max(exposure_credits),0)::int from commercial_billing.recovery_cases where receipt=${f.key} and state='OPEN') exposure`;
    assert.equal(j.n, 1);
    assert.equal(j.exposure, f.spent);
    assert.equal((await ledger.wallet(f.member)).spendable, 0);
  }
  await flags(true);
  for (const f of [partial, full])
    await assert.rejects(buy(f), /Account review/);
  await flags(false);
  assert.equal((await ledger.wallet(nonrefunded.member)).spendable, 4900);
  ok(
    "Partial and fully spent refunds give 700 and 4900 credit holds; retries and stale notifications never recredit; unrelated balance preserved",
  );
  assert.deepEqual(await fingerprints(histTables), history);
  assert.deepEqual(await fingerprints(Object.keys(ownership)), ownership);
  const [imbal] =
    await admin`select count(*)::int n from(select journal from commercial_billing.lines group by journal having sum(amount)<>0)t`;
  assert.equal(imbal.n, 0);
  ok(
    "Archived history fingerprints preserved, commercial ownership and lifetime counters unchanged by refunds, all journals balanced",
  );
  console.log(
    "EVIDENCE " +
      JSON.stringify({
        ...report(),
        historicalGoogleRows: hist.n,
        fixtureCardsRetained: ownerCounts.cards,
        providerFixtureReads: reads,
        holdExposures: [700, 4900],
        zeroSpendableForRefundedCustomers: 3,
        unrelatedSpendable: 4900,
      }),
  );
}
main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
