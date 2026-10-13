import { NextResponse } from "next/server";
import { sameOrigin } from "@/server/auth";
import { memberTestWallet } from "@/server/member-test-wallet";
import { boundedCommunityBody } from "@/core/community-social";
import { CreditsRejected } from "@/server/credits-sandbox-store";
import { ZodError } from "zod";
import {
  reconciliationCsv,
  reconciliationRange,
} from "@/core/credit-reconciliation";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(req: Request) {
  try {
    const data = await memberTestWallet();
    if (new URL(req.url).searchParams.get("format") === "csv") {
      const report = data.state.ownerReport;
      if (!report)
        return NextResponse.json(
          { error: "Owner access required" },
          { status: 403, headers },
        );
      let range;
      try {
        const q = new URL(req.url).searchParams;
        range = reconciliationRange(q.get("from"), q.get("to"));
      } catch {
        return NextResponse.json(
          { error: "Choose valid Sydney start and end dates." },
          { status: 400, headers },
        );
      }
      return new Response(reconciliationCsv(report, range), {
        headers: {
          ...headers,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="docked-test-ledger.csv"',
        },
      });
    }
    return NextResponse.json(data, { headers });
  } catch {
    return NextResponse.json(
      { error: "Test wallet requires your invited account." },
      { status: 403, headers },
    );
  }
}
export async function POST(req: Request) {
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Origin denied" },
      { status: 403, headers },
    );
  try {
    const body = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(req, 8192)),
    );
    return NextResponse.json(await memberTestWallet(body), { headers });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof CreditsRejected
            ? error.message
            : "Unable to complete this test transaction. Refresh to check its status; retrying the same request will not charge twice.",
        outcome:
          error instanceof CreditsRejected || error instanceof ZodError
            ? "rejected"
            : "unknown",
      },
      { status: 400, headers },
    );
  }
}
