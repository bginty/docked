import { ZodError } from "zod";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { betaCreditRequests } from "@/server/beta-credit-requests";
export const dynamic = "force-dynamic";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
function failure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const denied = /Authentication|MFA|Role denied/.test(message);
  const conflict = /conflict|transition|Recipient unavailable/.test(message);
  const invalid =
    error instanceof ZodError || /Invalid credit request/.test(message);
  const limited = /rate limit/.test(message);
  return Response.json(
    {
      error: denied
        ? "Verified owner access and MFA are required."
        : conflict
          ? "The request or recipient changed. Reload before reviewing."
          : invalid
            ? "Check the recipient, amount, reason and confirmation."
            : limited
              ? "Too many requests. Try again shortly."
              : "Request service unavailable. Retry the same request to reconcile its outcome.",
    },
    {
      status: denied
        ? 403
        : conflict
          ? 409
          : invalid
            ? 400
            : limited
              ? 429
              : 503,
      headers,
    },
  );
}
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    return Response.json(
      await betaCreditRequests({
        page: Number(query.get("page") ?? 1),
        q: query.get("q") ?? "",
      }),
      { headers },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    const mutation = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 4000)),
    );
    return Response.json(await betaCreditRequests({ mutation }), { headers });
  } catch (error) {
    return failure(error);
  }
}
