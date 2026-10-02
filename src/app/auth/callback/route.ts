import { NextResponse } from "next/server";
import { authClient } from "@/server/auth";
import { config } from "@/server/config";
import { scheduleOnboarding } from "@/server/onboarding";
import { recordAnalytics } from "@/server/analytics";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const c = await authClient();
  const code = url.searchParams.get("code");
  if (c && code) {
    const { error } = await c.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await c.auth.getUser();
      if (user?.email_confirmed_at) {
        await recordAnalytics(user.id, "email_verified", undefined, true);
        await scheduleOnboarding(user.id);
      }
      return NextResponse.redirect(
        new URL(
          url.searchParams.get("next") === "/reset-password"
            ? "/reset-password"
            : "/dashboard",
          config().siteUrl,
        ),
      );
    }
  }
  return NextResponse.redirect(
    new URL("/login?error=verification", config().siteUrl),
  );
}
