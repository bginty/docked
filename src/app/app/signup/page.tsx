import Link from "next/link";
import { AppAuthForm } from "@/components/app-auth-forms";
export default function AppSignup() {
  return (
    <>
      <h1>Create your Docked account</h1>
      <p className="app-auth-hint">
        Closed Preview · an invitation or approved test email setup is required.
      </p>
      <AppAuthForm mode="signup" />
      <p className="app-auth-switch">
        Already a member? <Link href="/app/login">Log in</Link>
      </p>
    </>
  );
}
