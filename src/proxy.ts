import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions } from "@/core/auth-cookies";
import { assertHostedPreview } from "@/core/hosted-preview";
export async function proxy(request: NextRequest) {
  assertHostedPreview(process.env);
  let response = NextResponse.next({ request });
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return response;
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, authCookieOptions(options)),
          );
        },
      },
    },
  );
  await client.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/edges",
    "/results",
    "/tips/:path*",
    "/api/member",
    "/api/admin",
    "/api/edges",
    "/home",
    "/feed",
    "/following",
    "/points",
    "/my-edge",
    "/community/:path*",
    "/compose",
    "/profile/:path*",
    "/top-docked",
    "/notifications",
    "/search",
    "/membership",
    "/competitions",
    "/deals",
    "/api/community/:path*",
    "/api/community-edges/:path*",
    "/api/notifications",
    "/api/top-docked",
    "/api/admin/:path*",
  ],
};
