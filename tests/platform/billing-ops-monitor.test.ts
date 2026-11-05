import test from "node:test";
import assert from "node:assert/strict";
import type { Sql } from "postgres";
import {
  BillingOpsMonitor,
  billingFailureSignal,
} from "../../src/server/billing-ops-monitor";
import { billingOpsAlertMessage } from "../../src/server/billing-ops-alerts.mjs";

test("member observer is default-off and has no mail credentials or database side effect", async () => {
  let calls = 0;
  const sql = (async () => {
    calls++;
    throw Error("must not run");
  }) as unknown as Sql;
  const monitor = new BillingOpsMonitor(sql, {});
  const failure = Error("isolated private details");
  await monitor.record("purchase_fulfilment_failed");
  assert.equal(await monitor.run("fulfilment", async () => 42), 42);
  await assert.rejects(
    monitor.run("fulfilment", async () => {
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.equal(calls, 0);
  assert.equal(
    await monitor.isKnownReceiptReplay("not-logged", "member", "binding"),
    false,
  );
  assert.equal(calls, 0);
});

test("classification distinguishes replay, expected rejection, supply failure and unknown stages", () => {
  assert.equal(
    billingFailureSignal(
      "fulfilment",
      Error("Receipt already bound to another account or product"),
    ),
    "receipt_replay_rejected",
  );
  assert.equal(
    billingFailureSignal("pack", Error("Insufficient Docked Credits")),
    null,
  );
  assert.equal(
    billingFailureSignal(
      "pack",
      Error("Pack supply unavailable; no charge or substitution"),
    ),
    "pack_supply_unavailable",
  );
  for (const [stage, code] of [
    ["verification", "receipt_verification_failed"],
    ["fulfilment", "purchase_fulfilment_failed"],
    ["pack", "pack_issuance_failed"],
    ["refund", "refund_reconciliation_failed"],
    ["acknowledgement", "acknowledgement_failed"],
    ["reconciliation", "reconciliation_failed"],
  ] as const)
    assert.equal(
      billingFailureSignal(stage, Error("untrusted raw provider details")),
      code,
    );
});

test("monitoring and logger outages cannot change original success/error identity", async () => {
  const sql = (async () => {
    throw Error("isolated audit outage");
  }) as unknown as Sql;
  const monitor = new BillingOpsMonitor(
    sql,
    { DOCKED_BILLING_OPS_SIGNALS: "true" },
    () => {
      throw Error("isolated logger outage");
    },
  );
  const success = { ok: true },
    failure = Error("original transaction error");
  await monitor.record("reconciliation_failed");
  assert.equal(await monitor.run("fulfilment", async () => success), success);
  await assert.rejects(
    monitor.run("refund", async () => {
      throw failure;
    }),
    (error) => error === failure,
  );
  assert.equal(
    await monitor.isKnownReceiptReplay("fixture", "member", "binding"),
    false,
  );
});

test("incident writes contain only approved enum and random attempt UUID, never raw identity/error", async () => {
  const writes: unknown[][] = [];
  const sql = (async (_strings: TemplateStringsArray, ...values: unknown[]) => {
    writes.push(values);
    return [];
  }) as unknown as Sql;
  const monitor = new BillingOpsMonitor(sql, {
    DOCKED_BILLING_OPS_SIGNALS: "true",
  });
  await assert.rejects(
    monitor.run("fulfilment", async () => {
      throw Error("private@example.invalid token-secret customer-details");
    }),
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "purchase_fulfilment_failed");
  assert.match(String(writes[0][1]), /^[0-9a-f-]{36}$/);
  assert(
    !JSON.stringify(writes).match(
      /private@example|token-secret|customer-details/,
    ),
  );
});

test("v2 observations expose explicit category counts; successful retries alone are informational", () => {
  const names = [
    "commercialAttention",
    "commercialOverdue",
    "openRecoveryCases",
    "testAttention",
    "testOverdue",
    "authMailFailures",
    "authMailPending",
    "authMailOverdue",
    "purchaseFulfilmentFailures",
    "duplicateReceiptAttempts",
    "receiptReplayRejections",
    "refundReconciliationFailures",
    "walletLedgerMismatches",
    "ledgerIntegrityFailures",
    "packIssuanceFailures",
    "opsNotificationFailures",
    "reconciliationStaleReceipts",
    "receiptAcknowledgementFailures",
    "reconciliationFailures",
    "receiptVerificationFailures",
  ];
  const counts = Object.fromEntries(names.map((name) => [name, 0]));
  counts.duplicateReceiptAttempts = 3;
  counts.opsNotificationFailures = 1;
  assert.equal(billingOpsAlertMessage(counts, "2026-11-06T00:00:00Z"), null);
  counts.receiptReplayRejections = 1;
  const alert = billingOpsAlertMessage(counts, "2026-11-06T00:00:00Z")!;
  assert.match(alert.key, /^billing-ops-v2:/);
  assert.equal(
    billingOpsAlertMessage(
      { ...counts, opsNotificationFailures: 2 },
      "2026-11-06T00:00:00Z",
    )!.key,
    alert.key,
  );
  assert(
    alert.message.body.content.includes("Rejected receipt replay signals: 1"),
  );
  assert.throws(() =>
    billingOpsAlertMessage(
      { ...counts, walletLedgerMismatches: undefined },
      "2026-11-06T00:00:00Z",
    ),
  );
});

test("known replay probe uses a hash and boolean only, never persists a raw token", async () => {
  const reads: unknown[][] = [];
  const sql = (async (_strings: TemplateStringsArray, ...values: unknown[]) => {
    reads.push(values);
    return [{ replay: true }];
  }) as unknown as Sql;
  const monitor = new BillingOpsMonitor(sql, {
    DOCKED_BILLING_OPS_SIGNALS: "true",
  });
  assert.equal(
    await monitor.isKnownReceiptReplay(
      "raw-token-never-recorded",
      "synthetic-member",
      "synthetic-binding",
    ),
    true,
  );
  assert.match(String(reads[0][0]), /^[0-9a-f]{64}$/);
  assert(!JSON.stringify(reads).includes("raw-token-never-recorded"));
});
