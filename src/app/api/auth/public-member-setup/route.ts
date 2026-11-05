import { NextResponse } from "next/server";
import { sameOrigin, requireIdentity } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { publicMemberSetupConfiguration } from "@/core/public-member-setup";
import { rateLimit } from "@/server/db";
import { savePublicMemberSetup } from "@/server/public-member-setup";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (!publicMemberSetupConfiguration())
    return NextResponse.json(
      { error: "Existing-member public setup is not available yet." },
      { status: 503, headers },
    );
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Origin denied" },
      { status: 403, headers },
    );
  try {
    const who = await requireIdentity();
    if (!(await rateLimit(`public-member-setup:${who.user.id}`, 6, 300)))
      return NextResponse.json(
        { error: "Please wait before trying again." },
        { status: 429, headers },
      );
    const input = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 16000)),
    );
    return NextResponse.json(await savePublicMemberSetup(input), { headers });
  } catch {
    return NextResponse.json(
      {
        error:
          "Account setup was not confirmed. Check your session and required policy choices, then retry. Your existing beta records have not been changed.",
      },
      { status: 403, headers },
    );
  }
}
