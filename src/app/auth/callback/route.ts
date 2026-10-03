import { NextResponse } from "next/server";
import { authClient } from "@/server/auth";
import { config } from "@/server/config";
import { scheduleOnboarding } from "@/server/onboarding";
import { recordAnalytics } from "@/server/analytics";
import { appAuthCallbackDestination } from "@/core/app-auth";
import { isEmailOwnershipVerified } from "@/core/auth-policy";
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
      if (user && isEmailOwnershipVerified(user)) {
        await recordAnalytics(user.id, "email_verified", undefined, true);
        await scheduleOnboarding(user.id);
      }
      return NextResponse.redirect(
        new URL(
          appAuthCallbackDestination(url.searchParams.get("next")),
          config().siteUrl,
        ),
      );
    }
  }
  return NextResponse.redirect(
    new URL(
      url.searchParams.get("next")?.startsWith("/app/")
        ? "/app/link-expired"
        : "/login?error=verification",
      config().siteUrl,
    ),
  );
}
