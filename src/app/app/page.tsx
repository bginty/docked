import { redirect } from "next/navigation";
import { appViewer } from "@/server/app-view";
import { appOnboardingState } from "@/server/app-onboarding";
export default async function AppEntry() {
  const { who } = await appViewer();
  if (!who) redirect("/app/login");
  const state = await appOnboardingState(who.user.id);
  redirect(
    state.completed && !state.legalRequired ? "/edges" : "/app/onboarding",
  );
}
