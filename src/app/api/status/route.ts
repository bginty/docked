import { NextResponse } from "next/server";
import { serviceStatus } from "@/server/queries";
export async function GET() {
  return NextResponse.json(await serviceStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
