import {
  invitationRequest,
  productionInvitationsEnabled,
} from "@/core/auth-invitation";
import { isEmailOwnershipVerified } from "@/core/auth-policy";
import { authClient } from "@/server/auth";
import { config } from "@/server/config";
import { rateLimit } from "@/server/db";
import { hash } from "@/core/canonical-hash";
import { assertPrivatePreview } from "@/core/private-preview.mjs";
import { previewOwnerMatches } from "@/core/preview-owner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function handle(request: Request) {
  const ownerSetup = assertPrivatePreview(process.env);
  const enabled = ownerSetup || productionInvitationsEnabled(process.env);
  // Validate the full deployment binding before any configured Auth access.
  const siteUrl = enabled ? config().siteUrl : "https://docked.com.au";
  return invitationRequest(request, {
    enabled,
    siteUrl,
    verify: async (token) => {
      if (!(await rateLimit(`auth-invite:${hash(token)}`, 6, 300)))
        return "unavailable";
      const client = await authClient();
      if (!client) return "unavailable";
      const { data, error } = await client.auth.verifyOtp({
        token_hash: token,
        type: "invite",
      });
      if (error) {
        // Provider outages/rate limits are not evidence that a link is invalid.
        if (error.code === "otp_expired" || error.code === "otp_disabled")
          return "invalid";
        return "unavailable";
      }
      if (
        !data.session?.access_token ||
        !data.user ||
        data.user.is_anonymous ||
        !isEmailOwnershipVerified(data.user)
      )
        return "unavailable";
      if (ownerSetup && !previewOwnerMatches(data.user, process.env)) {
        await client.auth.signOut({ scope: "local" });
        return "invalid";
      }
      return "confirmed";
    },
  });
}
export const GET = handle;
export const POST = handle;
