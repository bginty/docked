import Link from "next/link";
export default function AppLinkExpired() {
  return (
    <div className="app-auth-state">
      <h1>We couldn’t confirm this link</h1>
      <p>
        It may have expired, already been used, or opened in a different browser.
        Use the browser where you requested it. If this keeps happening, contact
        support@docked.com.au before requesting another email.
      </p>
      <Link className="button" href="/app/forgot-password">
        Request a reset link
      </Link>
      <Link className="app-auth-secondary" href="/app/check-email">
        Resend verification
      </Link>
      <Link className="app-auth-secondary" href="/app/login">
        Back to login
      </Link>
    </div>
  );
}
