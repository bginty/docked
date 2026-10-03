import Link from "next/link";
import { AppAuthForm } from "@/components/app-auth-forms";
export default function AppLogin() {
  return (
    <>
      <h1>Welcome back</h1>
      <AppAuthForm mode="login" />
      <p className="app-auth-switch">
        New to Docked? <Link href="/app/signup">Create account</Link>
      </p>
    </>
  );
}
