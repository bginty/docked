import { NextResponse } from "next/server";
import { requireRole, sameOrigin } from "@/server/auth";
import { rateLimit } from "@/server/db";
import { boundedCommunityBody } from "@/core/community-social";
import {
  benefitAdminOverview,
  createCompetitionDraft,
  createDealDraft,
} from "@/server/benefits";
export async function GET() {
  try {
    return NextResponse.json(await benefitAdminOverview(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Privileged authentication required." },
      { status: 403 },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  try {
    const who = await requireRole(["owner", "admin"]);
    if (!(await rateLimit(`benefits:${who.user.id}`, 10)))
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
    if (Number(request.headers.get("content-length") ?? 0) > 16000)
      return NextResponse.json({ error: "Draft too large" }, { status: 413 });
    const bytes = await boundedCommunityBody(request, 16000);
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (body.action === "competition_draft")
      return NextResponse.json({
        ok: true,
        ...(await createCompetitionDraft(body.input)),
      });
    if (body.action === "deal_draft")
      return NextResponse.json({
        ok: true,
        ...(await createDealDraft(body.input)),
      });
    return NextResponse.json(
      { error: "Activation, billing, entry and awarding are disabled." },
      { status: 409 },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Draft could not be saved. Check your session, role and inputs.",
      },
      { status: 403 },
    );
  }
}
