import { AppAuthForm } from "@/components/app-auth-forms";
import { productionInvitationsEnabled } from "@/core/auth-invitation";

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
      <AppAuthForm mode="complete" />
    </>
  );
}
