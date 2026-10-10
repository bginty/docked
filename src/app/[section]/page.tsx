import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ApiForm } from "@/components/forms";
import { AppAuthShell } from "@/components/app-auth-shell";
import { MfaForm } from "@/components/mfa-form";
export const metadata = {
  title: "Docked account and support",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { section } = await params;
  const query = await searchParams;
  const redirects: Record<string, string> = {
    login: "/app/login",
    join: "/app/signup",
    recover: "/app/forgot-password",
    "reset-password": "/app/reset-password",
    terms: "/beta-policies#terms",
    privacy: "/beta-policies#privacy",
    "safer-gambling": "/beta-policies#responsible-gambling",
  };
  if (redirects[section]) redirect(redirects[section]);
  if (section === "mfa")
    return (
      <AppAuthShell>
        <h1>Protect your account</h1>
        <p>
          Sign in first. Privileged operations require a verified MFA session.
        </p>
        <MfaForm next={query.next} />
        <Link href="/dashboard">Account settings</Link>
      </AppAuthShell>
    );
  if (section === "unsubscribe")
    return (
      <AppAuthShell>
        <h1>Pause optional messages</h1>
        <ApiForm
          endpoint={
            "/api/unsubscribe?token=" + encodeURIComponent(query.token ?? "")
          }
          action="unsubscribe"
          submit="Pause all optional messages"
        >
          <p>
            Necessary account notices are separate from optional communications.
          </p>
        </ApiForm>
      </AppAuthShell>
    );
  if (!["about", "contact", "legacy-support"].includes(section)) notFound();
  return (
    <AppAuthShell>
      <h1>
        {section === "about" ? "Collect. Build. Compete." : "Docked support"}
      </h1>
      <p>
        Docked is a fantasy sports card platform. Collect limited cards, build
        teams and compete. Football is the first playable sport; additional
        sports are not yet available.
      </p>
      <p>
        Protected Preview uses fictional players and simulated scoring. Public
        registration is closed. No paid packs or cash prizes.
      </p>
      {section === "legacy-support" && (
        <p>
          Support for previous physical-product orders and warranties remains
          separate. Please include your order reference; never send payment
          details or passwords.
        </p>
      )}
      <p>
        <a href="mailto:support@docked.com.au">support@docked.com.au</a>
      </p>
      <Link href="/">Docked home</Link>
    </AppAuthShell>
  );
}
