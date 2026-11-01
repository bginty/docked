import { z } from "zod";
import { requireRole, sameOrigin } from "@/server/auth";
import { commercialRuntime } from "@/server/commercial-runtime";
import { boundedCommunityBody } from "@/core/community-social";
export const runtime = "nodejs";
const headers = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
};
const denied = () =>
  Response.json(
    { error: "Authorised commercial billing review required" },
    { status: 403, headers },
  );
/** Owner MFA only, not general support access. No credit adjustment, cash refund,
 * issuance or activation operation is exposed by this endpoint. */
export async function GET() {
  try {
    await requireRole(["owner"]);
    const { ledger, worker } = await commercialRuntime();
    const cases =
      await ledger.sql`select id,member_id,exposure_credits,reason,state,revision,created_at from commercial_billing.recovery_cases where state='OPEN' order by created_at,id limit 50`;
    return Response.json(
      {
        report: await ledger.financialReport(),
        jobs: await worker.health(),
        cases,
      },
      { headers },
    );
  } catch {
    return denied();
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req)) return denied();
  try {
    const who = await requireRole(["owner"]);
    const v = z
      .object({
        action: z.literal("waive_completed_refund_hold"),
        id: z.string().regex(/^[a-f0-9]{64}$/),
        revision: z.number().int().positive(),
        reason: z.string().trim().min(12).max(600),
      })
      .strict()
      .parse(
        JSON.parse(
          new TextDecoder().decode(await boundedCommunityBody(req, 4096)),
        ),
      );
    const { ledger } = await commercialRuntime();
    const result = await ledger.resolveRecovery(
      v.id,
      v.revision,
      v.reason,
      who.user.id,
      async () => {
        const fresh = await requireRole(["owner"]);
        if (fresh.user.id !== who.user.id || fresh.sessionId !== who.sessionId)
          throw Error("Review session changed");
      },
    );
    return Response.json(result, { headers });
  } catch {
    return denied();
  }
}
