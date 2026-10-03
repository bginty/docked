import Link from "next/link";
import { AppAuthForm } from "@/components/app-auth-forms";
export default async function AppCheckEmail({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const recovery = (await searchParams).type === "recovery";
  return (
    <div className="app-auth-state">
      <h1>Check your email</h1>
      <p>
        {recovery
          ? "If your account exists and delivery is approved, open the reset link to choose a new password."
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
