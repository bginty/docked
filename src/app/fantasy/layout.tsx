import type { ReactNode } from "react";
import { requireIdentity } from "@/server/auth";
import { boundedRead } from "@/core/bounded-request";
import { PersistentAppShell } from "@/components/app-shell";
import { fantasyPlatformEnabled } from "@/core/fantasy-production";

export default async function FantasyLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!fantasyPlatformEnabled()) return children;
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
