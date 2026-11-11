import { NextResponse } from "next/server";
import { sameOrigin } from "@/server/auth";
import { publicPhoneCommand } from "@/server/public-phone";
import { boundedCommunityBody } from "@/core/community-social";
import { publicPhoneErrorMessage } from "@/core/phone-challenge";
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
    return NextResponse.json(
      {
        error: publicPhoneErrorMessage(error),
      },
      { status: 400, headers },
    );
  }
}
