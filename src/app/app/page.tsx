import { redirect } from "next/navigation";
import { appViewer } from "@/server/app-view";
import { appOnboardingState } from "@/server/app-onboarding";
import { fantasyEnabled } from "@/core/fantasy";
export default async function AppEntry() {
  const { who } = await appViewer();
  if (!who) redirect("/app/login");
  const state = await appOnboardingState(who.user.id);
  redirect(
    state.completed && !state.legalRequired
      ? fantasyEnabled()
        ? "/fantasy/play"
        : "/edges"
      : "/app/onboarding",
  );
}
