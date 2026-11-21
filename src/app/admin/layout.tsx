import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { publicCustomersEnabled } from "@/core/public-customer";
import { identity } from "@/server/auth";
import { AppAuthShell } from "@/components/app-auth-shell";
import { OwnerNavigationProvider } from "@/components/owner-navigation-context";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  let who;
  try {
    who = await identity();
  } catch {
    return (
      <AppAuthShell>
        <h1>Owner access is temporarily unavailable</h1>
        <p>Your session could not be checked. Please try again.</p>
        <a className="button" href="/admin/incidents">
          Retry Owner access
        </a>
      </AppAuthShell>
    );
  }
  if (!who) redirect("/app/login?next=%2Fadmin%2Fincidents");
  if (who.aal !== "aal2") redirect("/mfa?next=%2Fadmin%2Fincidents");
  // Role authorization remains in each page/API; the layout does not grant it.
  return (
    <OwnerNavigationProvider
      retiredBeta={who.postBetaOwner}
      customerModeAvailable={publicCustomersEnabled() && who.postBetaOwner}
    >
      {children}
    </OwnerNavigationProvider>
  );
}
