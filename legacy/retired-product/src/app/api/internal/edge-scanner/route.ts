import { NextResponse } from "next/server";
import { runScannerTick } from "@/server/edge-scanner";
import { scannerWorkerAuthorized } from "@/server/scanner-auth";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  if (
    !scannerWorkerAuthorized(
      process.env.SCANNER_WORKER_TOKEN,
      request.headers.get("authorization"),
    )
  )
    return NextResponse.json(
      { error: "Worker authentication required" },
      { status: 401 },
    );
  try {
    return NextResponse.json(await runScannerTick(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Scanner unavailable; inspect private operations" },
      { status: 503 },
    );
  }
}
