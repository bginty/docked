import Link from "next/link";
import { AppAuthForm } from "@/components/app-auth-forms";
export default function AppForgotPassword() {
  return (
    <>
      <h1>Forgot password?</h1>
      <p className="app-auth-hint">
        Enter your email to request a reset link. Preview delivery requires an
        approved safe mailbox; if unavailable, ask the beta organiser.
      </p>
      <AppAuthForm mode="recover" />
      <Link className="app-auth-secondary" href="/app/login">
        Back to login
      </Link>
    </>
  );
}
