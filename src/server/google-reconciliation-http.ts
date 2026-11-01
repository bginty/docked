import { timingSafeEqual } from "node:crypto";
import {
  verifyGooglePush,
  type GooglePushPolicy,
  type StoreNotice,
} from "./google-store-notifications";

const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const reply = (status: number, value: unknown) =>
  Response.json(value, { status, headers });
type PushDependencies = {
  policy: GooglePushPolicy;
  enqueue: (notice: StoreNotice) => Promise<boolean>;
  verify?: typeof verifyGooglePush;
};
/** Returns success only AFTER durable persistence, allowing Pub/Sub retry on outage. */
export async function googleNotificationRequest(
  req: Request,
  deps: PushDependencies,
) {
  let notice: StoreNotice;
  try {
    if (
      new URL(req.url).origin + new URL(req.url).pathname !==
      deps.policy.audience
    )
      throw Error("Wrong callback");
    notice = await (deps.verify ?? verifyGooglePush)(req, deps.policy);
  } catch {
    return reply(401, {
      error: "Notification authentication or payload rejected",
    });
  }
  try {
    await deps.enqueue(notice);
    return new Response(null, { status: 204, headers });
  } catch {
    return reply(503, {
      error: "Notification persistence unavailable; retry required",
    });
  }
}
export function authorizedStoreWorker(req: Request, secret: string) {
  if (
    req.method !== "POST" ||
    req.headers.has("cookie") ||
    req.headers.has("origin") ||
    secret.length < 32 ||
    req.headers.has("x-forwarded-authorization")
  )
    return false;
  const actual = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export async function googleReconciliationRequest(
  req: Request,
  deps: {
    secret: string;
    run: () => Promise<unknown>;
  },
) {
  if (!authorizedStoreWorker(req, deps.secret))
    return reply(401, { error: "Worker authentication required" });
  try {
    return reply(200, await deps.run());
  } catch {
    return reply(503, {
      error: "Reconciliation deferred; durable jobs retained",
    });
  }
}
