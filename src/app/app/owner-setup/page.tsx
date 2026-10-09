import { notFound, redirect } from "next/navigation";
import { OwnerSetupStatus } from "@/components/owner-setup-status";
import { ApiForm } from "@/components/forms";
import { betaOwnerAuthenticationOnly } from "@/core/hosted-beta.mjs";
import { appViewer } from "@/server/app-view";

export default async function OwnerSetup() {
  if (!betaOwnerAuthenticationOnly(process.env)) notFound();
  const { who } = await appViewer();
  if (!who) redirect("/app/login");
  if (who.user.email?.toLowerCase() !== "support@docked.com.au") notFound();
  const verifiedMfaSession = who.aal === "aal2";
  return <OwnerSetupStatus verifiedMfaSession={verifiedMfaSession}>
    <ApiForm endpoint="/api/auth" action="logout" submit="Sign out" defaults={{ app: true }}>
      <span className="app-auth-hint">Sign out of this browser session.</span>
    </ApiForm>
  </OwnerSetupStatus>;
}
