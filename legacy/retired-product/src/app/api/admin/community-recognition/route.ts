import { NextResponse } from "next/server";
import { sameOrigin, requireRole } from "@/server/auth";
import { rateLimit } from "@/server/db";
import { boundedCommunityBody } from "@/core/community-social";
import { captureWeeklyRecognition } from "@/server/community-recognition";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!sameOrigin(request))
    return NextResponse.json(
      { error: "Origin denied" },
      { status: 403, headers },
    );
  try {
    const who = await requireRole(["owner", "admin", "analyst"]);
    if (!(await rateLimit(`recognition-snapshot:${who.user.id}`, 4, 60)))
      throw Error("Rate limit");
    const body = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 1024)),
    );
    if (body.action !== "snapshot" || Object.keys(body).length !== 1)
      throw Error("Unsupported action");
    return NextResponse.json(
      {
        ok: true,
        id: await captureWeeklyRecognition(),
        message:
          "Completed-week recognition snapshot retained. No notification sent.",
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Recognition capture requires authorised MFA staff and valid canonical data.",
      },
      { status: 403, headers },
    );
  }
}
