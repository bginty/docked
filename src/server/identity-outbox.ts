import type { IdentityNotice } from "../core/manual-identity";
export function identityNotification(n: IdentityNotice, origin: string) {
  const u = new URL(origin);
  if (u.protocol !== "https:" || u.origin !== "https://docked.com.au")
    throw Error("Approved review origin required");
  return {
    to: "support@docked.com.au",
    subject: `Identity verification ${n.reference}`,
    text: `Case: ${n.reference}\nSubmitted: ${new Date(n.submittedAt).toISOString()}\nReview: ${u.origin}/admin/identity-verification?case=${encodeURIComponent(n.reference)}`,
    idempotencyKey: n.id,
  };
}
/** Caller must hold the durable queue-row lock when claiming/completing a lease. */
export function claimIdentityNotice(n: IdentityNotice, now: number) {
  if (
    n.status === "sent" ||
    n.nextAttempt > now ||
    (n.status === "sending" && (n.leaseUntil ?? 0) > now)
  )
    return false;
  n.status = "sending";
  n.leaseUntil = now + 60000;
  n.attempts++;
  return true;
}
export function completeIdentityNotice(
  n: IdentityNotice,
  attempt: number,
  now: number,
  success: boolean,
) {
  if (n.status !== "sending" || n.attempts !== attempt)
    throw Error("Stale notification attempt");
  n.status = success ? "sent" : "failed";
  n.deliveryError = success ? undefined : "Delivery failed; retry scheduled";
  n.leaseUntil = undefined;
  n.nextAttempt = now + Math.min(3600000, 30000 * 2 ** Math.min(n.attempts, 7));
}

/** Implementations must claim atomically under the existing durable state/row lock.
 * Transport must honour the submission-version idempotency key. No default email
 * provider or production cron is enabled by this provider-independent worker. */
export interface IdentityNoticeQueue {
  claim(now: number): Promise<IdentityNotice | null>;
  finish(
    id: string,
    attempt: number,
    now: number,
    sent: boolean,
  ): Promise<void>;
}
export async function deliverIdentityNotice(
  queue: IdentityNoticeQueue,
  transport: {
    send(message: ReturnType<typeof identityNotification>): Promise<void>;
  },
  now = Date.now(),
) {
  const notice = await queue.claim(now);
  if (!notice) return false;
  try {
    await transport.send(identityNotification(notice, "https://docked.com.au"));
  } catch {
    await queue.finish(notice.id, notice.attempts, now, false);
    return false;
  }
  await queue.finish(notice.id, notice.attempts, now, true);
  return true;
}
