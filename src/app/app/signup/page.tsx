import Link from "next/link";
import { AppAuthForm } from "@/components/app-auth-forms";
import { environmentPresentation } from "@/server/presentation";
export default async function AppSignup() {
  const environment = await environmentPresentation();
  return (
    <>
      <h1>Create your Docked account</h1>
      <p className="app-auth-hint">
        {environment.production
          ? environment.registrationAvailable
            ? "Create a free account. Marketing is optional and separate from account messages."
            : `Registration is unavailable. ${environment.reason ?? "Please check back later."}`
          : "Closed Preview · an invitation or approved test email setup is required."}
      </p>
      <AppAuthForm mode="signup" />
      <p className="app-auth-switch">
        Already a member? <Link href="/app/login">Log in</Link>
      </p>
    </>
  );
}
