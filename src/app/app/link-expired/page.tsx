import Link from "next/link";
export default function AppLinkExpired() {
  return (
    <div className="app-auth-state">
      <h1>This link has expired</h1>
      <p>
        It may have already been used, or opened on another device. Return to
        the device where you requested it, or request a new link.
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
