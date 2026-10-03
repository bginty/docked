import Link from "next/link";
import { AppAuthForm } from "@/components/app-auth-forms";
import { environmentPresentation } from "@/server/presentation";
export default async function AppForgotPassword() {
  const { production, emailAvailable } = await environmentPresentation();
  return (
    <>
      <h1>Forgot password?</h1>
      <p className="app-auth-hint">
        {production
          ? emailAvailable
            ? "Enter your email to request a reset link."
            : "Password recovery is unavailable until account email is enabled. No email will be sent."
          : "Enter your email to request a reset link. Preview delivery requires an approved safe mailbox; if unavailable, ask the beta organiser."}
      </p>
      <AppAuthForm mode="recover" />
      <Link className="app-auth-secondary" href="/app/login">
        Back to login
      </Link>
    </>
  );
}
