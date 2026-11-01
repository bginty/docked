import { sameOrigin } from "@/server/auth";
import { boundedCommunityBody } from "@/core/community-social";
import { memberCommercial } from "@/server/member-commercial";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const unavailable = () =>
  Response.json(
    {
      error:
        "Commercial purchases are unavailable. No fulfilment has been confirmed.",
    },
    { status: 403, headers },
  );
export async function GET(req: Request) {
  try {
    const member = await memberCommercial(),
      q = new URL(req.url).searchParams;
    return Response.json(
      q.get("view") === "packs"
        ? await member.view.packs(Number(q.get("offset") ?? 0))
        : q.get("view") === "wallet"
          ? { member: member.member, wallet: await member.wallet() }
          : await member.session(),
      {
        headers,
      },
    );
  } catch {
    return unavailable();
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return unavailable();
  try {
    const body = JSON.parse(
        new TextDecoder().decode(await boundedCommunityBody(req, 8192)),
      ),
      member = await memberCommercial(),
      action = new URL(req.url).searchParams.get("action");
    const result =
      action === "reconcile" &&
      body &&
      !Array.isArray(body) &&
      Object.keys(body).length === 0
        ? await member.reconcile()
        : action === "pack"
          ? await member.buyPack(body)
          : action === "open"
            ? await member.openPack(body)
            : action === null
              ? await member.receipt(body)
              : null;
    if (result === null) return unavailable();
    return Response.json(result, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (
      /^(Insufficient Docked Credits|Pack quote changed; review again|Pack supply unavailable; no charge or substitution|Account review required before spending or purchasing|Commercial feature disabled|Explicit pack confirmation required)$/.test(
        message,
      )
    )
      return Response.json(
        { error: message, outcome: "rejected" },
        { status: 409, headers },
      );
    return unavailable();
  }
}
