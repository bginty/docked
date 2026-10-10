import { NextResponse } from "next/server";
import { postgameResults } from "@/server/postgame-results";
export const runtime = "nodejs";
export async function GET() {
  try {
    return NextResponse.json(
      { records: await postgameResults() },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Results require an eligible signed-in beta account." },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
