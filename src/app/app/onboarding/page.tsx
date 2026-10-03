import { redirect } from "next/navigation";
import { appViewer } from "@/server/app-view";
import { appOnboardingState } from "@/server/app-onboarding";
import { AppOnboardingForm } from "@/components/app-auth-forms";
export default async function AppOnboarding() {
  const { who } = await appViewer();
  if (!who) redirect("/app/login");
  const state = await appOnboardingState(who.user.id);
  if (state.completed && !state.legalRequired) redirect("/edges");
  return (
    <AppOnboardingForm
      legalRequired={state.legalRequired}
      usernameRequired={state.usernameRequired}
      minimumAge={state.minimumAge}
      preferences={state.preferences}
    />
  );
}
