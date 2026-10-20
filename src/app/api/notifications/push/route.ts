import { NextResponse } from "next/server";
import { withCommunityActor } from "@/server/community-social";
import { pushConfigured } from "@/server/web-push-config";
import { pushSubscriptionSchema } from "@/core/web-push";
import { memberAccessFailure } from "@/core/member-access-recovery";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
const headers = { "Cache-Control": "private, no-store" };
export const runtime = "nodejs";
export async function GET() {
  try {
    return await withCommunityActor("community_social", false, async () =>
      NextResponse.json(
        {
          available: pushConfigured(),
          publicKey: pushConfigured()
            ? process.env.WEB_PUSH_VAPID_PUBLIC_KEY
            : null,
        },
        { headers },
      ),
    );
  } catch (error) {
    const kind = memberAccessFailure(error);
    return NextResponse.json(
      {
        error:
          kind === "authentication"
            ? "Sign in to manage notifications."
            : kind === "mfa"
              ? "Verify your identity to continue."
              : "Push settings are temporarily unavailable.",
      },
      {
        status:
          kind === "authentication"
            ? 401
            : kind === "mfa" || kind === "permission"
              ? 403
              : 503,
        headers,
      },
    );
  }
}
export async function POST(request: Request) {
  try {
    if (!sameOrigin(request))
      return NextResponse.json(
        { error: "Invalid request origin." },
        { status: 403, headers },
      );
    const body = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 6000)),
    );
    const action = body.action;
    if (!["enable", "disable", "status"].includes(action))
      throw Error("Invalid action");
    if (action === "enable" && !pushConfigured())
      return NextResponse.json(
        {
          error:
            "Push delivery is not configured yet. In-app sale notices remain available.",
        },
        { status: 503, headers },
      );
    const sub = pushSubscriptionSchema.parse(body.subscription);
    return await withCommunityActor(
      "community_social",
      false,
      async (tx) => {
        const enabled =
          action === "status"
            ? (
                await tx`select credits_sandbox.web_push_enabled(${sub.endpoint}) enabled`
              )[0].enabled
            : (
                await tx`select credits_sandbox.manage_web_push(${sub.endpoint},${tx.json(sub.keys)}::jsonb,${action === "enable"}) enabled`
              )[0].enabled && action === "enable";
        return NextResponse.json({ enabled }, { headers });
      },
      { scope: "push:subscription", limit: 20 },
    );
  } catch (error) {
    const kind = memberAccessFailure(error);
    return NextResponse.json(
      {
        error:
          kind === "authentication"
            ? "Please sign in again."
            : kind === "mfa"
              ? "Verify your identity to continue."
              : "Could not update this browser’s push subscription. Try again.",
      },
      {
        status:
          kind === "authentication"
            ? 401
            : kind === "mfa" || kind === "permission"
              ? 403
              : 400,
        headers,
      },
    );
  }
}
