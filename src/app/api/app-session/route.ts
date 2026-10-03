import { NextResponse } from "next/server";
import { appViewer } from "@/server/app-view";
import { appOnboardingState } from "@/server/app-onboarding";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    const { who, configured } = await appViewer();
    if (!configured)
      return NextResponse.json(
        { error: "Account service unavailable" },
        { status: 503, headers },
      );
    if (!who) return NextResponse.json({ authenticated: false }, { headers });
    const state = await appOnboardingState(who.user.id);
    return NextResponse.json(
      {
        authenticated: true,
        onboardingRequired: !state.completed || state.legalRequired,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Session could not be checked" },
      { status: 503, headers },
    );
  }
}
