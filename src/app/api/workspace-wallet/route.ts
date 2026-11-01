import { commercialSurfaceEnabled } from "@/core/commercial-presentation";
import { memberCommercial } from "@/server/member-commercial";
import { workspaceWalletSummary } from "@/server/member-test-wallet";
export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    if (commercialSurfaceEnabled()) {
      const member = await memberCommercial();
      return Response.json(
        {
          state: await member.view.summary(),
        },
        { headers },
      );
    }
    return Response.json(await workspaceWalletSummary(), { headers });
  } catch {
    return Response.json(
      { error: "Wallet unavailable" },
      { status: 403, headers },
    );
  }
}
