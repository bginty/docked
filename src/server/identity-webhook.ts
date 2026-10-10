import { createHmac, timingSafeEqual } from "node:crypto";
/** Raw-body authenticity boundary for a Veriff test integration. No documents stored.
 * Session-to-member binding and monotonic revisions are enforced by the ledger.
 * Provider status mapping must be contract-tested before a hosted adapter is enabled. */
export function verifyIdentitySignature(
  raw: string,
  signature: string,
  secret: string,
) {
  if (
    !secret ||
    !/^[a-f0-9]{64}$/i.test(signature) ||
    Buffer.byteLength(raw) > 65536
  )
    throw Error("Identity signature required");
  const expected = createHmac("sha256", secret).update(raw).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex")))
    throw Error("Invalid identity signature");
  return JSON.parse(raw) as unknown;
}
