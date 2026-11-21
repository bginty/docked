import { Suspense, type ReactNode } from "react";
import { appOnboardingState } from "@/server/app-onboarding";
import { OwnerCustomerBrowse } from "@/components/owner-customer-browse";
import { requireIdentity } from "@/server/auth";
import { boundedRead } from "@/core/bounded-request";
import { AppShell, PersistentAppShell } from "@/components/app-shell";
import { fantasyPlatformEnabled } from "@/core/fantasy-production";
import { publicCustomersEnabled } from "@/core/public-customer";
import { identity } from "@/server/auth";
import { verifiedPhone } from "@/core/public-phone";
import { redirect } from "next/navigation";
import { postBetaOwnerDestination } from "@/core/post-beta-owner";

export default async function FantasyLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!fantasyPlatformEnabled() && !publicCustomersEnabled()) return children;
  if (process.env.DOCKED_BETA_STAGING === "true") {
    const who = await boundedRead(identity()).catch(() => null);
    const destination = postBetaOwnerDestination(who);
    // Outside the recovery catch: Next redirects must not become load errors.
    if (destination) redirect(destination);
  }
  if (publicCustomersEnabled()) {
    const who = await boundedRead(identity()).catch(() => null);
    if (who?.customerView) {
      const setup =
        verifiedPhone(who.user) &&
        who.profile.launch_transition?.commercialReady === true
          ? await appOnboardingState(who.user.id).catch(() => null)
          : null;
      if (!setup?.completed || setup.legalRequired || setup.usernameRequired)
        return (
          <AppShell authenticated customerView browseOnly>
            <Suspense fallback={<p role="status">Loading customer view…</p>}>
              <OwnerCustomerBrowse />
            </Suspense>
          </AppShell>
        );
    }
    if (
      who &&
      (!who.mfaRequired || who.aal === "aal2") &&
      !verifiedPhone(who.user)
    )
      redirect("/app/verify-phone");
  }
  try {
    const who = await boundedRead(requireIdentity());
    // Presentation only: each destination/API still performs its own auth/MFA checks.
    return (
      <PersistentAppShell key={who.user.id} customerView={who.customerView}>
        {children}
      </PersistentAppShell>
    );
  } catch {
    // Destination retains its precise authentication, MFA and Retry recovery state.
    return children;
  }
}
