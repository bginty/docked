import { NextResponse } from "next/server";
import { sameOrigin, requireRole } from "@/server/auth";
import {
  candidateDetail,
  candidateQueue,
  dailyOperations,
  scannerDashboard,
  scannerOperation,
} from "@/server/edge-scanner";
import { scannerStatuses } from "@/core/edge-scanner";
import { z } from "zod";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams,
      view = query.get("view") ?? "dashboard";
    const result =
      view === "candidate"
        ? await candidateDetail(z.uuid().parse(query.get("id")))
        : view === "candidates"
          ? await candidateQueue({
              status: query.has("status")
                ? z.enum(scannerStatuses).parse(query.get("status"))
                : undefined,
              cursor: query.has("cursor")
                ? z.uuid().parse(query.get("cursor"))
                : undefined,
            })
          : view === "daily"
            ? await dailyOperations()
            : await scannerDashboard();
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Scanner staff access unavailable" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: "Origin denied" }, { status: 403 });
  try {
    await requireRole(["owner", "admin", "analyst"]);
    const reader = request.body?.getReader();
    if (!reader) throw Error("Body required");
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const read = await reader.read();
        if (read.done) break;
        total += read.value.byteLength;
        if (total > 16384) throw Error("Body limit");
        chunks.push(read.value);
      }
    } finally {
      await reader.cancel();
    }
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const result = await scannerOperation(body);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Scanner action denied or current data no longer qualifies" },
      { status: 403, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
