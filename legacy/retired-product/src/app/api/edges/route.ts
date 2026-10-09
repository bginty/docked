import { NextResponse } from "next/server";
import { publicTips, regionAccess, serviceStatus } from "@/server/queries";
import { boardState } from "@/core/policy";
export async function GET() {
  const [region, status] = await Promise.all([regionAccess(), serviceStatus()]);
  return NextResponse.json(
    {
      status: boardState({ ...status, region: region.allowed }),
      tips: await publicTips(),
    },
    { headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } },
  );
}
