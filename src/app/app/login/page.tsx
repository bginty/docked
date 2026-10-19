import Link from "next/link";
import { AppAuthForm } from "@/components/app-auth-forms";
import { memberReturnPath } from "@/core/member-access-recovery";
export default async function AppLogin({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = memberReturnPath((await searchParams).next) ?? undefined;
  return (
    <>
      <h1>Welcome back</h1>
      <AppAuthForm mode="login" next={next} />
      <p className="app-auth-switch">
        New to Docked? <Link href="/app/signup">Create account</Link>
      </p>
    </>
  );
}
