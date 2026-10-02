import { createHmac } from "node:crypto";
export function unsubscribeToken(
  outboxId: string,
  userId: string,
  secret: string,
) {
  if (secret.length < 32)
    throw new Error(
      "A dedicated unsubscribe secret of at least 32 characters is required",
    );
  return createHmac("sha256", secret)
    .update(JSON.stringify(["docked-unsubscribe-v1", outboxId, userId]))
    .digest("hex");
}
export function retryIsSafe(firstAttempt: Date | string, now = new Date()) {
  const at = new Date(firstAttempt).getTime();
  return (
    Number.isFinite(at) &&
    at <= now.getTime() &&
    now.getTime() - at < 23 * 60 * 60 * 1000
  );
}
