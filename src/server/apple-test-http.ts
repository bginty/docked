import { z } from "zod";
import { boundedCommunityBody } from "../core/community-social";
import type { MemberStoreTestPurchases } from "./member-store-purchases";
import type { AppleSandboxPurchases } from "./apple-store-verification";
import type { AppleTestReconciliation } from "./apple-store-reconciliation";

/** Prepared adapter for an explicitly admitted isolated environment. It is not
 * installed on public routes. The member factory must use normal authenticated
 * Docked sessions and transaction-time admission, as the shared Google flow does. */
export function appleTestHttp(deps: {
  origin: string;
  member: () => Promise<MemberStoreTestPurchases>;
  verifier: Pick<AppleSandboxPurchases, "notification">;
  queue: Pick<AppleTestReconciliation, "enqueue">;
}) {
  const origin = new URL(deps.origin);
  if (origin.protocol !== "https:" || origin.origin !== deps.origin)
    throw Error("Secure canonical origin required");
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  const unavailable = () =>
    Response.json(
      {
        error:
          "Apple sandbox verification unavailable. No fulfilment is confirmed.",
      },
      { status: 403, headers },
    );
  const body = async (request: Request, size: number) => {
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw Error();
    return JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, size)),
    );
  };
  return {
    async session() {
      try {
        return Response.json(await (await deps.member()).session(), {
          headers,
        });
      } catch {
        return unavailable();
      }
    },
    async receipt(request: Request) {
      if (
        request.method !== "POST" ||
        request.headers.get("origin") !== deps.origin
      )
        return unavailable();
      try {
        return Response.json(
          await (await deps.member()).receipt(await body(request, 18000)),
          { headers },
        );
      } catch {
        return unavailable();
      }
    },
    async notification(request: Request) {
      if (request.method !== "POST")
        return new Response(null, { status: 405, headers });
      try {
        const value = z
          .object({ signedPayload: z.string().min(1).max(64000) })
          .strict()
          .parse(await body(request, 66000));
        const notice = await deps.verifier.notification(value.signedPayload);
        // Ack only after durable insert/deduplication. Provider retry remains safe.
        await deps.queue.enqueue(notice);
        return Response.json({ accepted: true }, { headers });
      } catch {
        return Response.json(
          { error: "Notification not accepted; retry required" },
          { status: 503, headers },
        );
      }
    },
  };
}
