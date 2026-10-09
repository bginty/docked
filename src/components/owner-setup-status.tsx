import Link from "next/link";
import type { ReactNode } from "react";

export function OwnerSetupStatus({ verifiedMfaSession, children }: {
  verifiedMfaSession: boolean;
  children?: ReactNode;
}) {
  return <div className="app-owner-setup">
    <p className="app-auth-step">FANTASY CARDS · OWNER SETUP</p>
    <h1>{verifiedMfaSession ? "Owner sign-in complete" : "Secure your Docked account"}</h1>
    <p className="app-auth-hint">Your invitation, account details and beta policy acceptance are saved.</p>
    {verifiedMfaSession ? <div className="app-owner-status" role="status">
      <h2>MFA session verified</h2>
      <p>Your secure sign-in is complete. No further authentication step is needed for this session.</p>
      <p>This is the current owner-testing checkpoint. The playable beta is not enabled yet, so you will stay here after MFA.</p>
    </div> : <>
      <p className="app-auth-hint">Verify with your existing authenticator. If you have not enrolled one yet, set it up personally. Keep setup keys and verification codes private.</p>
      <Link className="button" href="/mfa">Set up or verify MFA</Link>
    </>}
    <div className="app-owner-status">
      <h2>Next: gameplay acceptance</h2>
      <p>Fantasy cards, packs, points and community activity remain locked until their separate checks pass. Signing in does not issue cards or points.</p>
      {verifiedMfaSession && <p>You can leave this page or sign out. You do not need to repeat MFA or request another reset email while waiting for gameplay access.</p>}
    </div>
    <Link className="app-auth-secondary" href="/beta-policies">View the approved beta policies</Link>
    {children}
  </div>;
}
