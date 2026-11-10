import { redirect } from "next/navigation";
import { onboardingIdentity } from "@/server/onboarding-identity";
import { publicCustomersEnabled } from "@/core/public-customer";
import { phoneDeliveryReady, verifiedPhone } from "@/core/public-phone";
import { PublicPhoneVerification } from "@/components/public-phone-verification";
export default async function VerifyPhone() {
  if (!publicCustomersEnabled()) redirect("/app/login");
  const who = await onboardingIdentity();
  if (!who) redirect("/app/login");
  if (who.mfaRequired && who.aal !== "aal2")
    redirect("/mfa?next=/app/verify-phone");
  if (verifiedPhone(who.user)) redirect("/app/onboarding");
  if (!phoneDeliveryReady())
    return (
      <section>
        <h1>Phone verification pending</h1>
        <p>
          Account verification is not available yet. Your account is unchanged.
        </p>
        <a href="mailto:support@docked.com.au">Contact support</a>
      </section>
    );
  return <PublicPhoneVerification />;
}
