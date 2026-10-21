import { sameOrigin } from "@/server/auth";
import { adminCoupons } from "@/server/pack-coupons";
import { boundedCommunityBody } from "@/core/community-social";
import { CreditsRejected } from "@/server/credits-sandbox-store";
import { ZodError } from "zod";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
function failure(e: unknown) {
  const message = e instanceof Error ? e.message : "";
  const denied = /Role denied|Authentication required|MFA/.test(message);
  return Response.json(
    {
      error: denied
        ? "Verified staff access required."
        : e instanceof ZodError
          ? "Check the coupon fields, dates and eligible products."
          : e instanceof CreditsRejected
            ? message
            : "Coupon service unavailable. Retry the same request to confirm its outcome.",
    },
    {
      status: denied
        ? 403
        : e instanceof ZodError
          ? 400
          : e instanceof CreditsRejected
            ? 409
            : 503,
      headers,
    },
  );
}
export async function GET() {
  try {
    return Response.json(await adminCoupons(), { headers });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    return Response.json(
      await adminCoupons(
        JSON.parse(
          new TextDecoder().decode(await boundedCommunityBody(req, 8192)),
        ),
      ),
      { headers },
    );
  } catch (e) {
    return failure(e);
  }
}
