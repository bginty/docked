import { NextResponse } from "next/server";
import { analyticsInput } from "@/core/analytics";
import { recordAnalytics } from "@/server/analytics";
import { requireIdentity, sameOrigin } from "@/server/auth";
import { db, rateLimit } from "@/server/db";
export async function GET() {
  let enabled = false;
  try {
    const who = await requireIdentity(),
      sql = db();
    const rows =
      await sql`select granted from private.consent_events where user_id=${who.user.id} and purpose='analytics' order by created_at desc limit 1`;
    enabled = rows[0]?.granted === true;
  } catch {
    /* Anonymous visitors are never tracked. */
  }
  return NextResponse.json(
    { enabled },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  try {
    const who = await requireIdentity();
    if (!(await rateLimit(`analytics:${who.user.id}`, 10)))
      return new NextResponse(null, { status: 429 });
    const v = analyticsInput.parse(await request.json());
    // Completion/conversion events come only from the successful server action.
    if (
      [
        "signup_completed",
        "email_verified",
        "onboarding_completed",
        "tip_saved",
        "alert_enabled",
        "alert_disabled",
        "digest_enabled",
        "digest_disabled",
        "sport_selected",
        "bookmaker_selected",
      ].includes(v.event)
    )
      return new NextResponse(null, { status: 400 });
    await recordAnalytics(who.user.id, v.event, v.channel);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Request denied" }, { status: 403 });
  }
}
