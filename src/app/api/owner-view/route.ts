import { NextResponse } from "next/server";
import { publicCustomersEnabled } from "@/core/public-customer";
import { ownerViewBinding, ownerViewCookie } from "@/core/owner-view";
import { requireRole, sameOrigin } from "@/server/auth";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!sameOrigin(request) || !publicCustomersEnabled())
    return new Response(null, { status: 403, headers });
  const mode = new URL(request.url).searchParams.get("mode");
  if (mode !== "customer" && mode !== "owner")
    return new Response(null, { status: 400, headers });
  const who = await requireRole(["owner"]).catch(() => null);
  if (!who?.postBetaOwner) return new Response(null, { status: 403, headers });
  const response = NextResponse.redirect(
    new URL(mode === "customer" ? "/app" : "/admin/operations", request.url),
    { status: 303, headers },
  );
  response.cookies.set(
    ownerViewCookie,
    mode === "customer" ? ownerViewBinding(who.user.id, who.sessionId) : "",
    {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      ...(mode === "owner" ? { maxAge: 0 } : {}),
    },
  );
  return response;
}
