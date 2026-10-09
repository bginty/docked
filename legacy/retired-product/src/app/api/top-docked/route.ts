import { NextResponse } from "next/server";
import { z } from "zod";
import { sameOrigin, requireRole } from "@/server/auth";
import { rateLimit } from "@/server/db";
import { boundedCommunityBody } from "@/core/community-social";
import { topDockedBoard, captureTopDockedSnapshot } from "@/server/top-docked";
const period = z.enum(["week", "month", "7d", "30d", "90d", "ytd", "all"]);
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return NextResponse.json(
      await topDockedBoard(
        period.parse(params.get("period") ?? "month"),
        params.get("sport") ?? undefined,
      ),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Ranking period is unavailable." },
      { status: 400 },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  try {
    const who = await requireRole(["owner", "admin"]);
    if (!(await rateLimit(`top-docked-snapshot:${who.user.id}`, 10)))
      throw new Error("Rate limit");
    const body = z
      .object({
        action: z.literal("snapshot"),
        period,
        sport: z.string().max(60).optional(),
        reason: z.string().min(10).max(1000),
      })
      .strict()
      .parse(
        JSON.parse(
          new TextDecoder().decode(await boundedCommunityBody(request, 4000)),
        ),
      );
    return NextResponse.json({
      ok: true,
      id: await captureTopDockedSnapshot(body.period, body.sport, body.reason),
    });
  } catch {
    return NextResponse.json(
      { error: "An authorised administrator and review reason are required." },
      { status: 403 },
    );
  }
}
