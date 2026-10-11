import { customerOnboardingEnabled } from "@/core/customer-onboarding.mjs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { sameOrigin } from "@/server/auth";
import { config } from "@/server/config";
import { rateLimit } from "@/server/db";
import { hash } from "@/core/canonical-hash";
import { boundedCommunityBody } from "@/core/community-social";
import { z } from "zod";
const schema = z
  .object({
    email: z
      .email()
      .max(254)
      .transform((s) => s.trim().toLowerCase()),
    password: z.string().min(12).max(128),
  })
  .strict();
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  if (!sameOrigin(request) || !customerOnboardingEnabled())
    return NextResponse.json(
      { error: "Invite required. Docked is open to invited friends only." },
      { status: 403, headers },
    );
  config();
  const invitation = (await cookies()).get("docked-invitation")?.value;
  if (!invitation || !/^[a-f0-9]{64}$/.test(invitation))
    return NextResponse.json(
      { error: "Invite required. Open your personal invitation link first." },
      { status: 403, headers },
    );
  try {
    const input = schema.parse(
      JSON.parse(
        new TextDecoder().decode(await boundedCommunityBody(request, 2048)),
      ),
    );
    if (!(await rateLimit(`customer-signup:${hash(input.email)}`, 4, 300)))
      return NextResponse.json(
        { error: "Please wait before retrying." },
        { status: 429, headers },
      );
    const response = await fetch(
      "https://pojoymtniryarxxunyvz.supabase.co/functions/v1/customer-signup",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        },
        body: JSON.stringify({ ...input, invitation }),
        signal: AbortSignal.timeout(25000),
        cache: "no-store",
        redirect: "error",
      },
    );
    const value = await response.json();
    if (!response.ok)
      return NextResponse.json(
        {
          error:
            "We couldn’t finish account creation. Check your invited email, or sign in if you already created your account. You can retry in a minute.",
        },
        { status: 409, headers },
      );
    return NextResponse.json(
      {
        ok: true,
        redirect:
          value.redirect === "/app/login"
            ? "/app/login"
            : "/app/check-email?type=verification",
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          "Account creation could not be confirmed. Check your connection and try again; existing accounts are kept safe.",
      },
      { status: 503, headers },
    );
  }
}
