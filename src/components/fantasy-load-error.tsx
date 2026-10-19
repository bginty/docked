"use client";
import { LightSweep, StartupReady } from "./startup-loading";
export function FantasyLoadError({
  authRequired = false,
  mfaRequired = false,
}: {
  authRequired?: boolean;
  mfaRequired?: boolean;
}) {
  return (
    <>
      <StartupReady />
      <LightSweep
        failed
        authRequired={authRequired}
        onRetry={() => location.reload()}
      />
      {mfaRequired && (
        <a href="/mfa" className="loading-mfa-link">
          Verify your authenticator
        </a>
      )}
    </>
  );
}
