import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authCookieOptions } from "@/core/auth-cookies";
import { assertDeploymentEnvironment } from "@/core/deployment-environment";
import { retiredProductPath } from "@/core/retired-product";
export async function proxy(request: NextRequest) {
  assertDeploymentEnvironment(process.env);
  if (retiredProductPath(request.nextUrl.pathname)) {
    const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
    return request.nextUrl.pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'This service has been retired.', code: 'PRODUCT_RETIRED' }, { status: 410, headers })
      : new NextResponse('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Docked · Page retired</title><main><h1>This page has been retired</h1><p>Docked is now a fantasy sports card platform.</p><a href="/">Open Docked</a></main></html>', { status: 410, headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' } });
  }
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
export const config = {matcher: ['/((?!_next/static|_next/image|favicon.ico|brand/).*)']};
