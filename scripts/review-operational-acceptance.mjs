/** Read-only review of retained drill evidence. No DB, network or credential use. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const original = "docs/qa/v31-final-reconciliation-20261110/";
const output = "docs/qa/v31-operational-acceptance-20261110/";
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const hash = (data) => createHash("sha256").update(data).digest("hex");
const prior = json(original + "alerts-postgres.json");
const delivery = json(original + "email-delivery.json");
const { subsequentAcceptance, ...originalDelivery } = delivery;
assert.deepEqual(originalDelivery, prior.realDelivery);
assert.equal(prior.passed, true);
assert.equal(prior.checks.length, 18);
assert.equal(originalDelivery.providerAccepted, true);
assert.equal(originalDelivery.attempts, 1);
assert.equal(originalDelivery.inboxVerified, false);
assert.equal(originalDelivery.dispatch.deliveryVerified, false);
assert.equal(originalDelivery.recipient, "support@docked.com.au");
const attestation = json(output + "founder-email-attestation.json");
assert.equal(attestation.reference, originalDelivery.reference);
assert.equal(attestation.founderInboxReceipt, "CONFIRMED");
assert.equal(attestation.evidenceType, "founder attestation");
assert.equal(attestation.receivedDate, "2026-11-10");
assert.equal(attestation.automatedInboxVerification, false);
assert.equal(attestation.testResent, false);
assert.equal(subsequentAcceptance.founderInboxReceipt, "CONFIRMED");
const queue = json(original + "email-queue-audit.json");
assert.equal(queue.isolated, true);
assert.deepEqual(queue.outbox, [
  { state: "sent", attempts: 1, phase: "complete", outcome: "accepted" },
]);
const tail = queue.audit.slice(-4);
assert.deepEqual(
  tail.map((event) => event.action),
  [
    "billing_ops_enqueued",
    "billing_ops_claimed",
    "billing_ops_dispatch_fenced",
    "billing_ops_settled",
  ],
);
for (let index = 1; index < tail.length; index++)
  assert(
    Date.parse(tail[index].created_at) >=
      Date.parse(tail[index - 1].created_at),
  );
assert.equal(tail[1].details.attempt, 1);
assert.equal(tail[3].details.outcome, "accepted");
assert.equal(tail[3].details.deliveryVerified, false);
assert(Date.parse(originalDelivery.at) < Date.parse(tail[1].created_at));
assert(Date.parse(originalDelivery.at) >= Date.parse(tail[0].created_at));

const sources = [
  "src/server/billing-ops-alerts.mjs",
  "src/server/billing-ops-monitor.ts",
  "config/operations/billing-ops-outbox-v2.prepared.sql",
  "scripts/founder-alert-delivery-drill.mjs",
  "scripts/billing-ops-alerts-postgres.ts",
  "supabase/migrations/20261109232124_operational_incident_review.sql",
  "supabase/migrations/20261110005726_operational_incident_retention.sql",
  "tests/database/operational-incidents.test.ts",
  "tests/database/operational-final.test.ts",
];
const sourceReview = sources.map((path) => {
  const current = readFileSync(path);
  const committed = execFileSync("git", ["show", "8acae031:" + path]);
  const canonical = (buffer) =>
    buffer.toString("utf8").replaceAll("\r\n", "\n");
  assert.equal(
    canonical(current),
    canonical(committed),
    "Source drift: " + path,
  );
  return {
    path,
    sha256: hash(current),
    unchangedFrom: "8acae031",
    comparison: "canonical LF",
  };
});
const artifacts = [
  original + "alerts-postgres.json",
  original + "email-queue-audit.json",
  original + "operational-final-postgres.json",
  "docs/qa/v31-p1-p4-20261110/incidents-postgres.json",
].map((path) => {
  const raw = readFileSync(path);
  const committed = execFileSync("git", ["show", "8acae031:" + path]);
  assert.deepEqual(
    JSON.parse(raw),
    JSON.parse(committed),
    "Historical evidence changed",
  );
  return { path, sha256: hash(raw), historicalContentPreserved: true };
});
const intentPath =
  "private-data/v31-final-reconciliation-20261110/email-send-intent.private.json";
let localSendIntent = { available: false };
if (existsSync(intentPath)) {
  const raw = readFileSync(intentPath);
  const intent = JSON.parse(raw);
  assert.equal(intent.reference, originalDelivery.reference);
  assert.equal(intent.recipient, originalDelivery.recipient);
  assert(Date.parse(intent.intentAt) >= Date.parse(tail[2].created_at));
  assert(Date.parse(intent.intentAt) <= Date.parse(tail[3].created_at));
  localSendIntent = {
    available: true,
    sha256: hash(raw),
    referenceAndRecipientMatch: true,
  };
}
const report = {
  reviewedAt: new Date().toISOString(),
  method:
    "Independent retained-artifact and source review; no live provider or inbox access",
  passed: true,
  sourceReview,
  artifacts,
  receipt: attestation,
  priorAlertScenarioGroups: 18,
  realDrillStartedAt: originalDelivery.at,
  providerAcceptanceTimestampIndependentlyCaptured: false,
  queueFinalSequence: tail.map(({ action, created_at }) => ({
    action,
    at: created_at,
  })),
  lastOutboxSnapshot: queue.outbox,
  localSendIntent,
  crossRecordCorrelation:
    "Run ordering and timestamps; exported audit omits outbox subject IDs",
  fullHostedLifecycleAccepted: false,
  remaining: [
    "Approved deployment and scoped outbox admission are absent",
    "Real owner AAL2 hosted incident acknowledgement and resolution not performed",
    "Provider message trace and per-incident delivery correlation not independently inspected",
  ],
  safety: { emailsSent: 0, productionWrites: 0, credentialsRead: false },
};
writeFileSync(
  output + "alert-evidence-review.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    passed: true,
    previousScenarioGroups: 18,
    founderReceipt: "CONFIRMED",
    fullHostedLifecycleAccepted: false,
    emailsSent: 0,
  }),
);
