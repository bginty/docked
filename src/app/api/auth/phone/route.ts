import { NextResponse } from "next/server";
import { sameOrigin } from "@/server/auth";
import { publicPhoneCommand } from "@/server/public-phone";
import { boundedCommunityBody } from "@/core/community-social";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Origin denied" },
      { status: 403, headers },
    );
  try {
    const text = new TextDecoder().decode(
      await boundedCommunityBody(request, 1024),
    );
    return NextResponse.json(await publicPhoneCommand(JSON.parse(text)), {
      headers,
    });
  } catch (error) {
    // Never serialize provider errors, request bodies, phone numbers or OTPs.
    const safe =
      error instanceof Error &&
      /^(Phone verification|Unable to send|The code|Too many attempts|Your phone|Enter a phone)/.test(
        error.message,
      );
    return NextResponse.json(
      {
        error: safe
          ? (error as Error).message
          : "Unable to verify your phone. Please sign in again or contact support.",
      },
      { status: 400, headers },
    );
  }
}
