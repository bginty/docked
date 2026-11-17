import Link from "next/link";
import { AppAuthForm } from "@/components/app-auth-forms";
import { memberReturnPath } from "@/core/member-access-recovery";
export default async function AppLogin({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const next = memberReturnPath(params.next) ?? undefined;
  return (
    <>
      <h1>Welcome back</h1>
      {params.reason === "session-expired" && (
        <p role="status">
          Your session has expired. Sign in again with your existing account.
        </p>
      )}
      <AppAuthForm mode="login" next={next} />
      <p className="app-auth-switch">
        New to Docked? <Link href="/app/signup">Create account</Link>
      </p>
    </>
  );
}
