import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, rateLimit } from "@/server/db";
import { requireRole, sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("reserve"),
      email: z.email().max(254),
      userId: z.uuid(),
      requestId: z.uuid(),
    })
    .strict(),
  z.object({ action: z.literal("renew"), id: z.uuid() }).strict(),
  z.object({ action: z.enum(["revoke", "suspend"]), id: z.uuid() }).strict(),
]);
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export async function POST(request: Request) {
  const reply = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers });
  if (
    process.env.DOCKED_BETA_STAGING !== "true" ||
    process.env.BETA_ACCESS_ENABLED !== "true"
  )
    return reply({ error: "Beta invitations are disabled." }, 503);
  if (!sameOrigin(request)) return reply({ error: "Origin denied" }, 403);
  try {
    const owner = await requireRole(["owner", "admin"]);
    if (!(await rateLimit(`beta-invites:${owner.user.id}`, 10, 300)))
      return reply({ error: "Please wait before retrying." }, 429);
    const input = schema.parse(
      JSON.parse(
        new TextDecoder().decode(await boundedCommunityBody(request, 2048)),
      ),
    );
    const code = ["reserve", "renew"].includes(input.action)
      ? randomBytes(32).toString("hex")
      : null;
    const digest = code
      ? createHash("sha256").update(code).digest("hex")
      : null;
    const expiresAt = new Date(Date.now() + 3600000);
    const result = await db().begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.sub',${owner.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: owner.user.id, session_id: owner.sessionId, aal: owner.aal })},true)`;
      if (input.action === "reserve")
        return (
          await tx`select private.admin_reserve_admission(${input.email},${input.userId},${digest!},${input.requestId},${expiresAt}) id`
        )[0].id;
      if (input.action === "renew")
        await tx`select private.renew_admission(${input.id},${digest!},${expiresAt})`;
      else
        await tx`select private.manage_admission(${input.id},${input.action === "revoke" ? "revoked" : "suspended"})`;
      return input.id;
    });
    // No mail is sent here. Auth confirmation and this independent admission
    // code are both required; a code alone can never authenticate an account.
    return reply({
      id: result,
      code,
      expiresAt: code ? expiresAt.toISOString() : null,
      emailSent: false,
    });
  } catch {
    return reply(
      {
        error:
          "Invitation change could not be confirmed. Do not send or retry blindly; reconcile the existing reservation before renewing.",
      },
      409,
    );
  }
}
