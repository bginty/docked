import { redirect } from "next/navigation";
import { appViewer } from "@/server/app-view";
import { appOnboardingState } from "@/server/app-onboarding";
import { fantasyPlatformEnabled as fantasyEnabled } from "@/core/fantasy-production";
import { betaOwnerAuthenticationOnly } from "@/core/hosted-beta.mjs";
export default async function AppEntry() {
  const { who } = await appViewer();
  if (!who) redirect("/app/login");
  if (betaOwnerAuthenticationOnly(process.env)) redirect("/app/owner-setup");
  const state = await appOnboardingState(who.user.id);
  redirect(
    state.completed && !state.legalRequired
      ? fantasyEnabled()
        ? "/fantasy/play"
        : "/edges"
      : "/app/onboarding",
  );
}
