import { NextResponse } from "next/server";
import { fantasyRequest } from "@/server/fantasy";
import { sandboxTradeFees, tradeFeeWindow } from "@/core/fantasy-market-fees";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await fantasyRequest(); // Same exact-owner, MFA, session and admission gate as gameplay.
    const now = Date.now();
    return NextResponse.json(
      {
        mode: "ILLUSTRATION_ONLY",
        serverTime: new Date(now).toISOString(),
        policy: sandboxTradeFees,
        window: tradeFeeWindow(sandboxTradeFees, now),
        executionEnabled: false,
        liveCycleStart: null,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "Verified owner access required" },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
}
export function POST() {
  return NextResponse.json(
    { error: "Hosted marketplace execution and payments are disabled" },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}
