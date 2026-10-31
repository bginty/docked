import Link from "next/link";
import type { Metadata } from "next";
import { OperatorDetails } from "@/components/operator-details";
import { config } from "@/server/config";
export const metadata: Metadata = {
  title: "Delete your Docked account",
  robots: { index: false, follow: false },
};
export default function AccountDeletionInformation() {
  const sharedBetaIdentity = process.env.DOCKED_BETA_STAGING === "true";
  return (
    <div className="page narrow">
      <p className="eyebrow">Docked account controls</p>
      <h1>Delete your account</h1>
      <p>
        You can request deletion from the web without installing the app. Sign
        in, open Account settings, and use Account controls. Type DELETE to
        confirm.
      </p>
      <div className="actions">
        <Link className="button" href="/dashboard#account-controls">
          Open account controls
        </Link>
        <Link className="button ghost" href="/login">
          Sign in
        </Link>
      </div>
      <h2>What happens next</h2>
      <p>
        Account access and active sessions are revoked first. Download your
        account export before confirming.
      </p>
      <p>
        {sharedBetaIdentity
          ? "In this private beta, account identities are shared with the existing platform. Your deletion request is recorded, but identity erasure needs operator review to protect records held in the other environment. Access revocation is not completed deletion. Contact support to follow up on your request."
          : "Identity erasure follows access revocation. If the identity service is unavailable, erasure is queued for retry; the confirmation will say that deletion is still pending."}
      </p>
      <p>
        Personal profile content and relationships are removed or pseudonymised.
        Necessary consent, moderation and permanent-record audit evidence may be
        retained without an active public identity. Card ownership history and
        competition audit records are not selectively erased. The final legal
        retention schedule remains under owner review.
      </p>
      <h2>Unable to sign in?</h2>
      <p>
        Use <Link href="/recover">password recovery</Link> where delivery is
        configured.{" "}
        {config().production
          ? "Use the support contact below if recovery is unavailable."
          : "Invited Preview testers without a working recovery mailbox should contact the beta organiser through the channel used for their invitation."}
      </p>
      <OperatorDetails />
      <Link href="/privacy">Read the privacy notice</Link>
    </div>
  );
}
