import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { betaOwnerAuthenticationOnly } from "@/core/hosted-beta.mjs";
import { appViewer } from "@/server/app-view";

export default async function OwnerSetup() {
  if (!betaOwnerAuthenticationOnly(process.env)) notFound();
  const { who } = await appViewer();
  if (!who) redirect("/app/login");
  if (who.user.email?.toLowerCase() !== "support@docked.com.au") notFound();
  const verifiedMfaSession = who.aal === "aal2";
  return <>
    <p className="app-auth-step">FANTASY CARDS · OWNER SETUP</p>
    <h1>{verifiedMfaSession ? "MFA session verified" : "Secure your Docked account"}</h1>
    <p className="app-auth-hint">Your invitation, account details and beta policy acceptance are saved.</p>
    <p className="app-auth-hint">{verifiedMfaSession
      ? "Your session has passed MFA. Administrator access and gameplay still need their separate acceptance checks."
      : "Next, set up your authenticator personally. Keep the setup key and verification codes private."}</p>
    {!verifiedMfaSession && <Link className="button" href="/mfa">Set up or verify MFA</Link>}
    <p className="app-auth-hint">Fantasy cards, packs, points and community activity remain locked while owner authentication testing is completed. No cards or points have been issued.</p>
    <Link href="/beta-policies">View the approved beta policies</Link>
  </>;
}
