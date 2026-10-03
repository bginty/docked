import { NextResponse } from "next/server";
import { requireRole, sameOrigin } from "@/server/auth";
import { rateLimit } from "@/server/db";
import { boundedCommunityBody } from "@/core/community-social";
import {
  previewTesterAdministration,
  mutatePreviewTesterAdministration,
} from "@/server/preview-invitations";
export async function GET() {
  try {
    return NextResponse.json(await previewTesterAdministration(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Preview administrator access required" },
      { status: 403 },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  try {
    const who = await requireRole(["owner", "admin"]);
    if (!(await rateLimit(`preview-admin:${who.user.id}`, 15))) throw Error();
    const body = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 12000)),
    );
    return NextResponse.json(await mutatePreviewTesterAdministration(body), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Preview request denied. Check permissions, active policy, expiry and inputs.",
      },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
