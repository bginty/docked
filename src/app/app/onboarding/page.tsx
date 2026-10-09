import { redirect } from "next/navigation";
import { appViewer } from "@/server/app-view";
import { appOnboardingState } from "@/server/app-onboarding";
import { AppOnboardingForm } from "@/components/app-auth-forms";
import { betaOwnerAuthenticationOnly } from "@/core/hosted-beta.mjs";
import { fantasyPlatformEnabled } from "@/core/fantasy-production";
export default async function AppOnboarding() {
  const { who } = await appViewer();
  if (!who) redirect("/app/login");
  if (betaOwnerAuthenticationOnly(process.env)) redirect("/app/owner-setup");
  const state = await appOnboardingState(who.user.id);
  if (state.completed && !state.legalRequired)
    redirect(fantasyPlatformEnabled() ? "/fantasy/play" : "/edges");
  return (
    <AppOnboardingForm
      legalRequired={state.legalRequired}
      usernameRequired={state.usernameRequired}
      minimumAge={state.minimumAge}
      preferences={state.preferences}
    />
  );
}
