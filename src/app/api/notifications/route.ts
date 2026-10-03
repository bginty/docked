import { NextResponse } from "next/server";
import { sameOrigin, requireIdentity } from "@/server/auth";
import { requireCommunityAccess } from "@/server/community-policy";
import { rateLimit } from "@/server/db";
import { boundedCommunityBody } from "@/core/community-social";
import { schedulePreviewNotifications } from "@/server/preview-maintenance";
import {
  communityNotifications,
  mutateCommunityNotifications,
} from "@/server/community-social";
export async function GET() {
  const value = await communityNotifications();
  if (value.status === "ready") {
    try {
      const who = await requireIdentity();
      await requireCommunityAccess("community_social");
      await schedulePreviewNotifications(who);
    } catch {
      /* Existing read projection stays safe if eligibility changes. */
    }
  }
  return NextResponse.json(value, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  if (!process.env.DATABASE_URL)
    return NextResponse.json(
      { error: "Community preview is not configured." },
      { status: 503 },
    );
  try {
    const who = await requireIdentity();
    await requireCommunityAccess("community_social");
    if (!(await rateLimit(`social:notifications-request:${who.user.id}`, 30)))
      return NextResponse.json(
        { error: "Request rate limit" },
        { status: 429 },
      );
    const body = await boundedCommunityBody(request, 12000);
    return NextResponse.json(
      await mutateCommunityNotifications(
        JSON.parse(new TextDecoder().decode(body)),
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Preferences could not be changed. Check session, eligibility and separate consent.",
      },
      { status: 403 },
    );
  }
}
