import { createServerClient } from "@supabase/ssr";
import {
  assertPackHostedAcceptance,
  packAcceptancePathAllowed,
} from "@/core/pack-hosted-acceptance.mjs";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions } from "@/core/auth-cookies";
import { assertDeploymentEnvironment } from "@/core/deployment-environment";
import { retiredProductPath } from "@/core/retired-product";
import { isolatedV30Transport } from "@/server/isolated-v30-transport";
import { rejectedSessionCookies } from "@/core/rejected-session-cookies";
import { memberReturnPath } from "@/core/member-access-recovery";
import type { CookieOptions } from "@supabase/ssr";
export async function proxy(request: NextRequest) {
  if (
    assertPackHostedAcceptance(process.env) &&
    !packAcceptancePathAllowed(request.nextUrl.pathname, request.method)
  )
    return new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  const isolated = await isolatedV30Transport(request, process.env);
  if (isolated) return isolated;
  if (
    request.nextUrl.pathname.startsWith("/_next/") ||
    request.nextUrl.pathname.startsWith("/brand/") ||
    request.nextUrl.pathname === "/favicon.ico"
  )
    return NextResponse.next();
  assertDeploymentEnvironment(process.env);
  if (retiredProductPath(request.nextUrl.pathname)) {
    const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
    return request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json(
          { error: "This service has been retired.", code: "PRODUCT_RETIRED" },
          { status: 410, headers },
        )
      : new NextResponse(
          '<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked · Page retired</title><main><h1>This page has been retired</h1><p>Docked is now a fantasy sports card platform.</p><a href="/">Open Docked</a></main></html>',
          {
            status: 410,
            headers: { ...headers, "Content-Type": "text/html; charset=utf-8" },
          },
        );
  }
  let response = NextResponse.next({ request });
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return response;
  const originalNames = request.cookies.getAll().map(({ name }) => name);
  const pendingCookies = new Map<
    string,
    { name: string; value: string; options: CookieOptions }
  >();
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
            pendingCookies.set(name, {
              name,
              value,
              options: authCookieOptions(options),
            }),
          );
        },
      },
    },
  );
  const result = await client.auth
    .getUser()
    .catch((error: unknown) => ({ error }));
  const rejected = rejectedSessionCookies(
    result.error,
    originalNames,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  if (rejected.length) {
    for (const name of rejected) {
      request.cookies.delete(name);
      pendingCookies.set(name, {
        name,
        value: "",
        options: authCookieOptions({ path: "/", maxAge: 0 }),
      });
    }
    const path = request.nextUrl.pathname;
    if (
      request.method === "GET" &&
      /^\/(app|admin|fantasy|mfa|dashboard)(\/|$)/.test(path)
    ) {
      const login = new URL("/app/login", request.url);
      login.searchParams.set("reason", "session-expired");
      const next = memberReturnPath(
        path === "/app/login" ? request.nextUrl.searchParams.get("next") : path,
      );
      if (next) login.searchParams.set("next", next);
      response = NextResponse.redirect(login);
    } else response = NextResponse.next({ request });
  }
  // Supabase can refresh/remove multiple chunks in separate callbacks. Preserve
  // every Set-Cookie, including on a redirect; never sign out other devices.
  for (const { name, value, options } of pendingCookies.values())
    response.cookies.set(name, value, options);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: "/:path*" };
