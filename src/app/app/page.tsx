import { customerOnboardingEnabled } from "@/core/customer-onboarding.mjs";
import { redirect } from "next/navigation";
import { appViewer } from "@/server/app-view";
import { appOnboardingState } from "@/server/app-onboarding";
import { betaOwnerAuthenticationOnly } from "@/core/hosted-beta.mjs";
import { authClient } from "@/server/auth";
import { db } from "@/server/db";
export default async function AppEntry() {
  const { who } = await appViewer();
  if (!who) {
    if (customerOnboardingEnabled()) {
      const client = await authClient();
      const result = await client?.auth.getUser();
      const user = result?.data.user;
      if (
        !result?.error &&
        user?.email_confirmed_at &&
        !user.is_anonymous &&
        (
          await db()`select private.customer_signup_identity(${user.id}::uuid) or private.pending_beta_consent(${user.id}::uuid) allowed`
        )[0]?.allowed
      )
        redirect("/app/invitation-setup");
    }
    redirect("/app/login");
  }
  if (betaOwnerAuthenticationOnly(process.env)) redirect("/app/owner-setup");
  const state = await appOnboardingState(who.user.id);
  redirect(
    state.completed && !state.legalRequired
      ? "/fantasy/play"
      : "/app/onboarding",
  );
}
