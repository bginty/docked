import type { ReactNode } from "react";
import { requireIdentity } from "@/server/auth";
import { boundedRead } from "@/core/bounded-request";
import { PersistentAppShell } from "@/components/app-shell";
import { fantasyPlatformEnabled } from "@/core/fantasy-production";
import { publicCustomersEnabled } from "@/core/public-customer";
import { identity } from "@/server/auth";
import { verifiedPhone } from "@/core/public-phone";
import { redirect } from "next/navigation";

export default async function FantasyLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!fantasyPlatformEnabled() && !publicCustomersEnabled()) return children;
  if (publicCustomersEnabled()) {
    const who = await boundedRead(identity()).catch(() => null);
    if (
      who &&
      (!who.mfaRequired || who.aal === "aal2") &&
      !verifiedPhone(who.user)
    )
      redirect("/app/verify-phone");
  }
  try {
    const who = await boundedRead(requireIdentity());
    // Presentation only: each destination/API still performs its own auth/MFA checks.
    return (
      <PersistentAppShell key={who.user.id}>{children}</PersistentAppShell>
    );
  } catch {
    // Destination retains its precise authentication, MFA and Retry recovery state.
    return children;
  }
}
