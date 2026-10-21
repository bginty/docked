import { sameOrigin } from "@/server/auth";
import { memberCoupon } from "@/server/pack-coupons";
import { boundedCommunityBody } from "@/core/community-social";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return Response.json({ error: "Origin denied" }, { status: 403, headers });
  try {
    return Response.json(
      await memberCoupon(
        JSON.parse(
          new TextDecoder().decode(await boundedCommunityBody(req, 2048)),
        ),
      ),
      { headers },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const expected =
      /coupon|eligible pack|first successful pack|Too many coupon/i.test(
        message,
      );
    return Response.json(
      {
        error: expected
          ? message
          : "Coupon validation is temporarily unavailable. Please retry.",
      },
      {
        status: /Too many/.test(message) ? 429 : expected ? 400 : 503,
        headers,
      },
    );
  }
}
