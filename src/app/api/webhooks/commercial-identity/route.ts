import { NextResponse } from "next/server";
import { boundedCommunityBody } from "@/core/community-social";
import { commercialIdentityWebhook } from "@/server/commercial-withdrawal-service";
import { CommercialKycProviderError } from "@/server/commercial-kyc-provider";
import { withdrawalHeaders } from "@/server/commercial-withdrawal-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    // Authentication covers the exact raw bytes; parsing/reserializing first
    // would invalidate the provider signature and is intentionally forbidden.
    const bytes = await boundedCommunityBody(request, 65536);
    return NextResponse.json(
      await commercialIdentityWebhook(bytes, request.headers),
      { headers: withdrawalHeaders },
    );
  } catch (error) {
    const invalid =
      error instanceof CommercialKycProviderError &&
      error.code === "invalid_webhook";
    return NextResponse.json(
      { received: false },
      { status: invalid ? 401 : 503, headers: withdrawalHeaders },
    );
  }
}
