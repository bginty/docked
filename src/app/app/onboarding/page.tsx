import { redirect } from "next/navigation";
import { onboardingIdentity } from "@/server/onboarding-identity";
import { appOnboardingState } from "@/server/app-onboarding";
import { AppOnboardingForm } from "@/components/app-auth-forms";
import { betaOwnerAuthenticationOnly } from "@/core/hosted-beta.mjs";
export default async function AppOnboarding() {
  const who = await onboardingIdentity();
  if (!who) redirect("/app/login");
  if (who.mfaRequired && who.aal !== "aal2")
    redirect("/mfa?next=/app/onboarding");
  if (betaOwnerAuthenticationOnly(process.env)) redirect("/app/owner-setup");
  const state = await appOnboardingState(who.user.id);
  if (state.configurationPending)
    return (
      <>
        <h1>Account setup pending</h1>
        <p>
          Australian account setup is awaiting its regional configuration. Your
          existing account has not been changed.
        </p>
        <p>
          For help, contact{" "}
          <a href="mailto:support@docked.com.au">support@docked.com.au</a>.
        </p>
      </>
    );
  if (state.completed && !state.legalRequired) redirect("/fantasy/play");
  return (
    <AppOnboardingForm
      legalRequired={state.legalRequired}
      usernameRequired={state.usernameRequired}
      minimumAge={state.minimumAge}
      preferences={state.preferences}
    />
  );
}
