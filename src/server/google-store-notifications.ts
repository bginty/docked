import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  {
    timeoutDuration: 10000,
    cooldownDuration: 30000,
    cacheMaxAge: 3600000,
  },
);
export type GooglePushPolicy = {
  audience: string;
  serviceAccount: string;
  subscription: string;
  packageName: "docked.fantasy";
};
export type StoreNotice = {
  id: string;
  receiptKey: string | null;
  kind: "test" | "purchase" | "voided";
  occurredAt: number;
};
const tokenSchema = z
  .string()
  .min(1)
  .max(4096)
  .regex(/^[^\s\x00-\x1f]+$/);
const developerNotice = z
  .object({
    packageName: z.literal("docked.fantasy"),
    eventTimeMillis: z.string().regex(/^\d{1,16}$/),
    oneTimeProductNotification: z
      .object({
        purchaseToken: tokenSchema,
        sku: z.string().min(1),
        notificationType: z.number().int(),
      })
      .optional(),
    voidedPurchaseNotification: z
      .object({ purchaseToken: tokenSchema, productType: z.literal(2) })
      .optional(),
    testNotification: z.object({ version: z.string() }).optional(),
  })
  .refine(
    (v) =>
      [
        v.oneTimeProductNotification,
        v.voidedPurchaseNotification,
        v.testNotification,
      ].filter(Boolean).length === 1,
  );

/** A signed RTDN is only a refresh hint: never award credits from its event type.
 * Uses fixed Google keys, issuer, audience and exact push service-account email.
 * No customer session, query-string credential or client-supplied member ID.
 * TEST infrastructure may inject local signing keys; deployed callers use default keys. */
export async function verifyGooglePush(
  request: Request,
  policy: GooglePushPolicy,
  keys: JWTVerifyGetKey = googleKeys,
): Promise<StoreNotice> {
  if (
    !/^https:\/\//.test(policy.audience) ||
    !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(
      policy.serviceAccount,
    ) ||
    !/^projects\/[^/]+\/subscriptions\/[^/]+$/.test(policy.subscription)
  )
    throw Error("Push policy is not configured");
  if (
    request.method !== "POST" ||
    request.headers.has("cookie") ||
    request.headers.has("origin") ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    throw Error("Invalid push boundary");
  const auth = request.headers.get("authorization") ?? "";
  if (!/^Bearer [A-Za-z0-9_.-]{1,12000}$/.test(auth))
    throw Error("Push authentication required");
  try {
    const { payload } = await jwtVerify(auth.slice(7), keys, {
      algorithms: ["RS256"],
      issuer: ["https://accounts.google.com", "accounts.google.com"],
      audience: policy.audience,
      requiredClaims: ["exp", "iat", "sub", "email", "email_verified"],
      maxTokenAge: "1h",
      clockTolerance: 30,
    });
    if (
      payload.email !== policy.serviceAccount ||
      payload.email_verified !== true
    )
      throw Error();
  } catch {
    throw Error("Push authentication denied");
  }
  // Enforce streaming length even when Content-Length is missing or dishonest.
  const reader = request.body?.getReader();
  if (!reader) throw Error("Push body required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.length;
      if (size > 16000) {
        await reader.cancel();
        throw Error("Push body too large");
      }
      chunks.push(next.value);
    }
    const envelope = z
      .object({
        subscription: z.literal(policy.subscription),
        message: z.object({
          messageId: z.string().min(1).max(256),
          data: z
            .string()
            .max(12000)
            .regex(/^[A-Za-z0-9+/]+={0,2}$/),
        }),
      })
      .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    const decoded = Buffer.from(envelope.message.data, "base64");
    if (decoded.toString("base64") !== envelope.message.data) throw Error();
    const notice = developerNotice.parse(JSON.parse(decoded.toString("utf8")));
    const occurredAt = Number(notice.eventTimeMillis);
    if (!Number.isSafeInteger(occurredAt)) throw Error();
    const token =
      notice.oneTimeProductNotification?.purchaseToken ??
      notice.voidedPurchaseNotification?.purchaseToken;
    return {
      id: createHash("sha256")
        .update(policy.subscription + "\0" + envelope.message.messageId)
        .digest("hex"),
      receiptKey: token
        ? createHash("sha256")
            .update(policy.packageName + "\0" + token)
            .digest("hex")
        : null,
      kind: notice.testNotification
        ? "test"
        : notice.voidedPurchaseNotification
          ? "voided"
          : "purchase",
      occurredAt,
    };
  } catch {
    throw Error("Invalid store notification");
  } finally {
    reader.releaseLock();
  }
}
