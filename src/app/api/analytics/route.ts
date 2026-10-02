import { NextResponse } from "next/server";
import { z } from "zod";
import { requireIdentity, sameOrigin } from "@/server/auth";
import { db, rateLimit } from "@/server/db";
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  try {
    const who = await requireIdentity();
    if (!(await rateLimit(`analytics:${who.user.id}`, 10)))
      return new NextResponse(null, { status: 429 });
    const v = z
      .object({
        event: z.enum(["activated", "saved_tip", "digest_click", "visit"]),
        channel: z.enum(["direct", "search", "referral", "digest"]).optional(),
      })
      .parse(await request.json());
    const sql = db();
    const consent =
      await sql`select granted from private.consent_events where user_id=${who.user.id} and purpose='analytics' order by created_at desc limit 1`;
    if (!consent[0]?.granted) return new NextResponse(null, { status: 204 });
    await sql`insert into private.analytics_events(user_id,event,cohort,channel) values(${who.user.id},${v.event},${who.profile.created_at},${v.channel ?? null})`;
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Request denied" }, { status: 403 });
  }
}
