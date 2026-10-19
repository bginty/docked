"use client";
import { LightSweep, StartupReady } from "@/components/startup-loading";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <>
      <StartupReady />
      <LightSweep failed onRetry={reset} />
    </>
  );
}
