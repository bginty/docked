import { NextResponse } from "next/server";
import {
  communityVerificationAudit,
  reviewCommunityIntegrity,
} from "@/server/community-edges";
import { topDockedAudit, topDockedSnapshotExport } from "@/server/top-docked";
import { z } from "zod";
import { sameOrigin, requireRole } from "@/server/auth";
import { rateLimit } from "@/server/db";
import { boundedCommunityBody } from "@/core/community-social";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams,
      view = params.get("view") ?? "verification";
    const data =
      view === "leaderboard-snapshot"
        ? await topDockedSnapshotExport(
            z.string().uuid().parse(params.get("id")),
          )
        : view === "leaderboard-audit"
          ? await topDockedAudit()
          : await communityVerificationAudit(view);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Staff role and MFA required." },
      { status: 403 },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  try {
    const who = await requireRole(["owner", "admin"]);
    if (!(await rateLimit(`community-integrity:${who.user.id}`, 20)))
      throw new Error("Rate limit");
    const { action, ...input } = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 6000)),
    );
    if (action !== "integrity") throw new Error("Unsupported action");
    return NextResponse.json({
      ok: true,
      id: await reviewCommunityIntegrity(input),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Administrator MFA and a complete integrity review are required. Locked odds/results cannot be edited.",
      },
      { status: 403 },
    );
  }
}
