import Link from "next/link";
import { AppAuthForm } from "@/components/app-auth-forms";
import { environmentPresentation } from "@/server/presentation";
export default async function AppCheckEmail({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const recovery = (await searchParams).type === "recovery";
  const { production, emailAvailable } = await environmentPresentation();
  return (
    <div className="app-auth-state">
      <h1>
        {production && !emailAvailable
          ? "Account email is unavailable"
          : "Check your email"}
      </h1>
      <p>
        {production && !emailAvailable
          ? "Verification and recovery email are not enabled. This page does not confirm that a message was sent."
          : recovery
            ? "If your account exists and delivery is approved, open the reset link to choose a new password."
            : production
              ? "If your signup request was accepted, open your verification link to continue. Check your spam folder if needed."
              : "Open your verification link to continue. In this Preview, authentication messages are held in the approved test mailbox."}
      </p>
      {!recovery && (
        <details>
          <summary>Need another verification link?</summary>
          <AppAuthForm mode="resend" />
        </details>
      )}
      <Link className="button" href="/app/login">
        Back to login
      </Link>
    </div>
  );
}
