import Link from "next/link";

export default function EmailChangePending() {
  return (
    <div className="app-auth-state">
      <h1>Check both email addresses</h1>
      <p>
        Changing your email requires confirmation from both your current and new
        addresses. If you requested this change, open the remaining link in the
        browser where you started it.
      </p>
      <p>
        This page does not confirm that the change is complete or sign you in.
        Sign in to check your account after confirming both links.
      </p>
      <Link className="button" href="/app/login">
        Back to login
      </Link>
    </div>
  );
}
