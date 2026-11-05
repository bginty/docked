import { createHash } from "node:crypto";
import {
  projectUrl,
  sendGraph,
} from "../../supabase/functions/docked-auth-email/mail.mjs";

const recipient = "support@docked.com.au";
const countNames = [
  "commercialAttention",
  "commercialOverdue",
  "openRecoveryCases",
  "testAttention",
  "testOverdue",
  "authMailFailures",
  "authMailPending",
  "authMailOverdue",
];

/** No route, scheduler, credential loading or production queue binding is added.
 * Auth-email permission alone must not enable operational messages. */
export function billingOpsAlertPolicy(env, now = Date.now()) {
  if (env.DOCKED_BILLING_OPS_ALERTS !== "true") return null;
  if (
    env.SUPABASE_URL !== projectUrl ||
    env.DOCKED_GRAPH_MAIL_ENABLED !== "true" ||
    env.DOCKED_BILLING_OPS_RECIPIENT !== recipient ||
    typeof env.DOCKED_BILLING_OPS_AUTHORITY !== "string" ||
    env.DOCKED_BILLING_OPS_AUTHORITY.trim().length < 20 ||
    !Number.isFinite(Date.parse(env.DOCKED_BILLING_OPS_UNTIL ?? "")) ||
    Date.parse(env.DOCKED_BILLING_OPS_UNTIL) <= now
  )
    throw Error("Operational alert configuration is not approved");
  return { recipient };
}

/** Only aggregate counters and a timestamp enter email. Arbitrary error text,
 * customer identity, receipt references, tokens and extra fields are excluded. */
export function billingOpsAlertMessage(health, observedAt) {
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp))
    throw Error("Valid observation time required");
  const counts = {};
  for (const name of countNames) {
    if (!Number.isSafeInteger(health?.[name]) || health[name] < 0)
      throw Error("Complete aggregate health counters required");
    counts[name] = health[name];
  }
  if (
    countNames.every((name) => name === "authMailPending" || counts[name] === 0)
  )
    return null;
  const window = new Date(
    Math.floor(timestamp / 3600000) * 3600000,
  ).toISOString();
  const key = `billing-ops-v1:${window}:${createHash("sha256")
    .update(countNames.map((name) => counts[name]).join(","))
    .digest("hex")}`;
  return {
    key,
    message: {
      subject: "Docked billing operations require attention",
      body: {
        contentType: "Text",
        content: [
          `Observed: ${new Date(timestamp).toISOString()}`,
          `Commercial attention jobs: ${counts.commercialAttention}`,
          `Commercial overdue jobs: ${counts.commercialOverdue}`,
          `Open recovery cases: ${counts.openRecoveryCases}`,
          `TEST attention notifications: ${counts.testAttention}`,
          `TEST overdue notifications: ${counts.testOverdue}`,
          `Auth mail failures: ${counts.authMailFailures}`,
          `Auth mail pending: ${counts.authMailPending}`,
          `Auth mail overdue: ${counts.authMailOverdue}`,
          "Review with an authorised staff session:",
          "https://docked.com.au/admin/commercial-billing",
          "https://docked.com.au/admin/operations",
          "No customer record, payment or recovery hold was changed by this notice.",
        ].join("\n"),
      },
      toRecipients: [{ emailAddress: { address: recipient } }],
    },
  };
}

/** Queue MUST persist an atomic purpose-filtered claim, a pre-send dispatch fence
 * and settlement. An expired fenced lease is held for operator review, never
 * blindly resent: Graph sendMail has no exactly-once idempotency guarantee.
 * This contract is intentionally unbound until the existing outbox permissions
 * and dispatch-fence implementation are reviewed; no in-memory production queue.
 */
export async function dispatchBillingOpsAlert(
  queue,
  env,
  { send = sendGraph, now = Date.now() } = {},
) {
  if (!billingOpsAlertPolicy(env, now)) return { status: "disabled" };
  const job = await queue.claim(now);
  if (!job) return { status: "empty" };
  let prepared;
  try {
    prepared = billingOpsAlertMessage(job.health, job.observedAt);
  } catch {
    await queue.finish(job.id, job.lease, "invalid");
    return { status: "invalid" };
  }
  if (!prepared) {
    await queue.finish(job.id, job.lease, "healthy");
    return { status: "healthy" };
  }
  if (!(await queue.fence(job.id, job.lease, prepared.key)))
    return { status: "not-dispatched" };
  try {
    await send([prepared.message], env);
  } catch {
    await queue.finish(job.id, job.lease, "unknown");
    return { status: "unknown", deliveryVerified: false };
  }
  // If settlement fails after Graph acceptance, propagate without retrying send.
  // A durable fenced lease remains recoverable as an uncertain operation.
  await queue.finish(job.id, job.lease, "accepted");
  return { status: "accepted", deliveryVerified: false };
}
