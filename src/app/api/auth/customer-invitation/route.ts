import { customerOnboardingEnabled } from "@/core/customer-onboarding.mjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
export async function POST(request: Request) {
  if (!sameOrigin(request) || !customerOnboardingEnabled())
    return NextResponse.json({ error: "Invite required" }, { status: 403 });
  try {
    const value = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(request, 256)),
    );
    if (!/^[a-f0-9]{64}$/.test(value.token ?? "")) throw Error();
    (await cookies()).set("docked-invitation", value.token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 86400,
    });
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: "This invitation link is invalid." },
      { status: 400 },
    );
  }
}
