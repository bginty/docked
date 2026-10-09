import { NextResponse } from "next/server";
import { commercialFlags, membershipPlans } from "@/core/membership";
import { memberBenefits } from "@/server/benefits";
export async function GET() {
  try {
    return NextResponse.json(
      {
        membership: await memberBenefits(),
        flags: commercialFlags,
        plans: membershipPlans,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Membership information temporarily unavailable. Billing remains disabled.",
      },
      { status: 503 },
    );
  }
}
