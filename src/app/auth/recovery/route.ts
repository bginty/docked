import { cookies } from "next/headers";
import { productionInvitationsEnabled } from "@/core/auth-invitation";
import { hasRecoveryVerifier, recoveryRequest } from "@/core/auth-recovery";
import { config } from "@/server/config";
import { rateLimit } from "@/server/db";
import { hash } from "@/core/canonical-hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const enabled = productionInvitationsEnabled(process.env);
  return recoveryRequest(request, {
    enabled,
    siteUrl: enabled ? config().siteUrl : "https://docked.com.au",
    canContinue: async (token) => {
      if (!hasRecoveryVerifier((await cookies()).getAll()))
        return "missing-browser";
      return (await rateLimit(`auth-recovery:${hash(token)}`, 6, 300))
        ? "ready"
        : "unavailable";
    },
  });
}
export const GET = handle;
export const POST = handle;
