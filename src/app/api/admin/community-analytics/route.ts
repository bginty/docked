import { NextResponse } from "next/server";
import {
  communityAnalytics,
  communityNotificationOperations,
} from "@/server/community-analytics";
export async function GET(request: Request) {
  try {
    return NextResponse.json(
      new URL(request.url).searchParams.get("view") === "notifications"
        ? await communityNotificationOperations()
        : await communityAnalytics(),
      {
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Privileged authentication required or analytics unavailable." },
      { status: 403 },
    );
  }
}
