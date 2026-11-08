import { customerOnboardingEnabled } from "@/core/customer-onboarding.mjs";
import { AppAuthForm } from "@/components/app-auth-forms";
import { productionInvitationsEnabled } from "@/core/auth-invitation";
import Link from "next/link";

export default function InvitationSetup() {
  if (!productionInvitationsEnabled(process.env))
    return (
      <>
        <h1>Invited account setup</h1>
        <p>Invitations are not available yet.</p>
      </>
    );
  return (
    <>
      <h1>Finish your Docked account</h1>
      <p>
        Confirm your details and policy choices before entering the invited
        beta. Marketing is optional.
      </p>
      <p className="app-auth-switch">
        Already have a Docked account?{" "}
        <Link href="/app/login">Log in to an existing account</Link>
      </p>
      <AppAuthForm
        mode="complete"
        customerSetup={customerOnboardingEnabled()}
      />
    </>
  );
}
