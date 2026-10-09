import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth";
import { monitoredMarkets } from "@/server/market-data";
import { marketEditorialDraft } from "@/core/market-editorial";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    await requireRole(["owner", "admin", "editor"]);
  } catch {
    return NextResponse.json(
      { ok: false, error: "Editorial staff access required" },
      { status: 403 },
    );
  }
  const window = z
    .enum(["today", "upcoming", "weekend"])
    .safeParse(new URL(request.url).searchParams.get("window") ?? "weekend");
  if (!window.success)
    return NextResponse.json(
      { ok: false, error: "Invalid editorial window" },
      { status: 400 },
    );
  const data = await monitoredMarkets({ window: window.data, limit: 12 }),
    draft = marketEditorialDraft(data);
  return NextResponse.json(
    {
      status: data.status,
      draft,
      message: draft
        ? "Review this factual draft through the existing CMS revision and publication controls. Nothing was saved or published."
        : "No authorised current fixture evidence is available for a draft.",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
