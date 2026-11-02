import { cookies } from "next/headers";
import { isolatedCustomerEmailEnabled } from "@/core/isolated-public-preview.mjs";
import { customerEmailEnabled } from "@/core/customer-email-readiness";
import { hasRecoveryVerifier, recoveryRequest } from "@/core/auth-recovery";
import { config } from "@/server/config";
import { rateLimit } from "@/server/db";
import { hash } from "@/core/canonical-hash";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const enabled = customerEmailEnabled(process.env);
  const isolatedPreview = isolatedCustomerEmailEnabled(process.env);
  return recoveryRequest(request, {
    enabled,
    isolatedPreview,
    siteUrl: enabled ? config().siteUrl : "https://docked.com.au",
    canContinue: async (token) => {
      if (!hasRecoveryVerifier((await cookies()).getAll(), isolatedPreview))
        return "missing-browser";
      return (await rateLimit(`auth-recovery:${hash(token)}`, 6, 300))
        ? "ready"
        : "unavailable";
    },
  });
}
export const GET = handle;
export const POST = handle;
