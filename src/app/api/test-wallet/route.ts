import { NextResponse } from "next/server";
import { sameOrigin } from "@/server/auth";
import {
  memberTestWallet,
  workspaceWalletSummary,
} from "@/server/member-test-wallet";
import { memberAccessFailure } from "@/core/member-access-recovery";
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
    const q = new URL(req.url).searchParams;
    const csv = q.get("format") === "csv";
    if (!csv && q.get("view") === "summary")
      return NextResponse.json(await workspaceWalletSummary(), { headers });
    const data = await memberTestWallet(
      undefined,
      !csv && q.get("view") === "packs" ? "packs" : "wallet",
    );
    if (csv) {
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
  } catch (error) {
    const kind = memberAccessFailure(error);
    const denied =
      kind !== "service" ||
      (error instanceof Error &&
        [
          "Test wallet unavailable",
          "Test wallet admission required",
          "Owner MFA required",
          "Admission revoked",
        ].includes(error.message));
    if (!denied) console.error("test_wallet_read_failed", { kind: "service" });
    return NextResponse.json(
      {
        error: denied
          ? "Test wallet requires your invited account."
          : "Wallet service temporarily unavailable. Please retry.",
      },
      { status: denied ? 403 : 503, headers },
    );
  }
}
export async function POST(req: Request) {
  const started = performance.now();
  if (!sameOrigin(req))
    return NextResponse.json(
      { error: "Origin denied" },
      { status: 403, headers },
    );
  try {
    const body = JSON.parse(
      new TextDecoder().decode(await boundedCommunityBody(req, 8192)),
    );
    const data = await memberTestWallet(
      body,
      new URL(req.url).searchParams.get("view") === "packs"
        ? "packs"
        : "wallet",
    );
    const durationMs = Math.round(performance.now() - started);
    console.info("test_wallet_command", { outcome: "completed", durationMs });
    return NextResponse.json(data, {
      headers: { ...headers, "Server-Timing": `wallet;dur=${durationMs}` },
    });
  } catch (error) {
    const rejected =
      error instanceof CreditsRejected || error instanceof ZodError;
    console.warn("test_wallet_command", {
      outcome: rejected ? "rejected" : "unknown",
      durationMs: Math.round(performance.now() - started),
    });
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
      { status: rejected ? 400 : 503, headers },
    );
  }
}
