import { customerVerification } from "@/core/customer-verification";
import { productionInvitationsEnabled } from "@/core/auth-invitation";
import { authClient } from "@/server/auth";
import { config } from "@/server/config";
import { rateLimit } from "@/server/db";
import { hash } from "@/core/canonical-hash";
async function handle(request: Request) {
  const enabled = productionInvitationsEnabled(process.env);
  return customerVerification(request, {
    enabled,
    origin: enabled ? config().siteUrl : "https://docked.com.au",
    verify: async (token) => {
      if (!(await rateLimit(`verify:${hash(token)}`, 6, 300)))
        return "unavailable";
      const client = await authClient();
      if (!client) return "unavailable";
      const r = await client.auth.verifyOtp({
        type: "signup",
        token_hash: token,
      });
      if (r.error)
        return r.error.code === "otp_expired" ? "invalid" : "unavailable";
      return r.data.session &&
        r.data.user?.email_confirmed_at &&
        !r.data.user.is_anonymous
        ? "confirmed"
        : "unavailable";
    },
  });
}
export const GET = handle;
export const POST = handle;
