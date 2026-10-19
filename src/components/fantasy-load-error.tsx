"use client";
import { LightSweep, StartupReady } from "./startup-loading";
import { useEffect, useState } from "react";
import { memberReturnPath } from "@/core/member-access-recovery";
export function FantasyLoadError({
  authRequired = false,
  mfaRequired = false,
  permissionDenied = false,
  compact = false,
}: {
  authRequired?: boolean;
  mfaRequired?: boolean;
  permissionDenied?: boolean;
  compact?: boolean;
}) {
  const [next, setNext] = useState("/fantasy/play");
  useEffect(() => {
    setNext(
      memberReturnPath(location.pathname + location.search + location.hash) ??
        "/fantasy/play",
    );
  }, []);
  const recoveryHref = authRequired
    ? `/app/login?next=${encodeURIComponent(next)}`
    : mfaRequired
      ? `/mfa?next=${encodeURIComponent(next)}`
      : undefined;
  return (
    <>
      <StartupReady />
      <LightSweep
        compact={compact}
        failed
        authRequired={authRequired}
        failureMessage={
          mfaRequired
            ? "Verify your identity to continue."
            : permissionDenied
              ? "You don’t have access to this page."
              : undefined
        }
        recoveryHref={recoveryHref}
        recoveryLabel={mfaRequired ? "Verify authenticator" : "Sign in"}
        onRetry={
          !authRequired && !mfaRequired && !permissionDenied
            ? () => location.reload()
            : undefined
        }
      />
    </>
  );
}
