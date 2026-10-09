import Link from "next/link";
import { identity } from "@/server/auth";
import { config } from "@/server/config";
import { ApiForm, Field } from "@/components/forms";
import { AppShell } from "@/components/app-shell";
import { AppHeading, AccessGate } from "@/components/community-basics";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Account settings",
  robots: { index: false, follow: false },
};
export default async function Dashboard() {
  const settings = config();
  const who = settings.database && settings.auth ? await identity() : null;
  return (
    <AppShell authenticated={!!who}>
      <div className="app-settings">
        <AppHeading eyebrow="YOUR ACCOUNT" title="Settings & privacy" />
        {!who ? (
          <AccessGate configured={settings.database && settings.auth} />
        ) : (
          <>
            <nav className="tab-nav" aria-label="Account settings">
              <Link href="/fantasy/profile">My profile</Link>
              <Link href="/profile#edit">Community profile</Link>
              <Link href="/app/onboarding">Sports & preferences</Link>
              <Link href="/notifications">Notifications</Link>
              <Link href="/mfa">MFA settings</Link>
              <Link href="/api/member">Export account data</Link>
              <Link href="/contact">Help & support</Link>
            </nav>
            <section className="app-panel">
              <h2>Account controls</h2>
              <p>
                Deletion revokes access and sessions. Minimal ownership, consent
                and audit evidence is retained under the reviewed privacy
                policy. Download your export first.
              </p>
              <ApiForm
                endpoint="/api/member"
                action="delete"
                submit="Delete my account"
              >
                <Field label="Type DELETE to confirm" name="confirm" required />
              </ApiForm>
              <ApiForm
                endpoint="/api/auth"
                action="logout"
                submit="Log out all sessions"
              >
                <span />
              </ApiForm>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
