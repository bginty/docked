import { NextResponse } from "next/server";
import { fantasyRequest } from "@/server/fantasy";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await fantasyRequest(); // Same exact-owner, MFA, session and admission gate as gameplay.
    return NextResponse.json(
      {
        mode: "RETIRED",
        message:
          "This earlier AUD fee proposal is retired. Test transactions use Docked Credits in your wallet.",
        executionEnabled: false,
      },
      { status: 410, headers: { "Cache-Control": "private, no-store" } },
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
