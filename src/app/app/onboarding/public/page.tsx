import Link from "next/link";
import { redirect } from "next/navigation";
import { identity } from "@/server/auth";
import { publicMemberSetupConfiguration } from "@/core/public-member-setup";
import { publicMemberSetupState } from "@/server/public-member-setup";
import { AppOnboardingForm } from "@/components/app-auth-forms";
import { memberAccessFailure } from "@/core/member-access-recovery";
export default async function ExistingMemberPublicSetup() {
  if (!publicMemberSetupConfiguration())
    return (
      <>
        <h1>Account setup pending</h1>
        <p>
          Public account setup is not available yet. Your existing account is
          unchanged.
        </p>
      </>
    );
  const who = await identity();
  if (!who) redirect("/app/login");
  if (who.mfaRequired && who.aal !== "aal2")
    redirect("/mfa?next=/app/onboarding/public");
  let state;
  try {
    state = await publicMemberSetupState();
  } catch (error) {
    const failure = memberAccessFailure(error);
    if (failure === "authentication") redirect("/app/login");
    if (failure === "mfa") redirect("/mfa?next=/app/onboarding/public");
    return (
      <>
        <h1>Account setup unavailable</h1>
        <p>
          Your existing account has not been changed. Please retry or contact
          support@docked.com.au.
        </p>
        <Link href="/app/onboarding/public" className="button">
          Retry setup
        </Link>
      </>
    );
  }
  if (state.completed)
    return (
      <>
        <h1>Your account details are saved</h1>
        <p>
          Your existing beta cards, balance and teams are preserved. Public
          access and purchases remain controlled separately.
        </p>
        <Link href="/fantasy/play" className="button">
          Return to Docked
        </Link>
      </>
    );
  if (state.configurationPending || state.existingPolicyRenewal)
    return (
      <>
        <h1>Account setup pending</h1>
        <p>
          Your existing account has not been changed. Contact{" "}
          <a href="mailto:support@docked.com.au">support@docked.com.au</a> for
          help completing public account setup.
        </p>
      </>
    );
  return (
    <AppOnboardingForm
      legalRequired
      usernameRequired
      minimumAge={18}
      preferences={state.preferences}
      endpoint="/api/auth/public-member-setup"
      completionPath="/app/onboarding/public"
      termsHref={state.termsHref}
    />
  );
}
