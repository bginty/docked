import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { requireIdentity } from "@/server/auth";
import { fantasyProductionEnabled } from "@/core/fantasy-production";
import { memberAccessFailure } from "@/core/member-access-recovery";
import manifest from "../../../../../config/hosted-production.json";
export const runtime = "nodejs";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const who = await requireIdentity();
    if (
      !fantasyProductionEnabled() ||
      process.env.DOCKED_BETA_STAGING !== "true"
    )
      return NextResponse.json(
        { member: who.user.id, receipt: null },
        { headers },
      );
    const receipt = await db().begin(async (tx) => {
      await tx`select set_config('docked.fantasy_channel',${process.env.DOCKED_RELEASE_CHANNEL ?? "stable"},true),set_config('docked.fantasy_production',${manifest.supabaseProjectRef},true),set_config('request.jwt.claim.sub',${who.user.id},true),set_config('request.jwt.claims',${JSON.stringify({ sub: who.user.id, session_id: who.sessionId, aal: who.aal })},true)`;
      return (await tx`select fantasy.my_nfl_pack_receipt() receipt`)[0]
        .receipt;
    });
    return NextResponse.json({ member: who.user.id, receipt }, { headers });
  } catch (error) {
    const kind = memberAccessFailure(error);
    return NextResponse.json(
      {
        error:
          kind === "authentication"
            ? "Please sign in again."
            : kind === "mfa"
              ? "Verify your identity to continue."
              : "Starter history could not load. Your original cards are preserved.",
      },
      {
        status:
          kind === "authentication"
            ? 401
            : kind === "mfa" || kind === "permission"
              ? 403
              : 503,
        headers,
      },
    );
  }
}
