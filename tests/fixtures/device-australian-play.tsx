// Device-only isolated shell. No hosted authentication, purchase or inventory service.
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AppShell } from "../../src/components/app-shell";
import { SportProvider } from "../../src/components/sport-context";
import { SportSandbox } from "../../src/components/sport-sandbox";
import type { SandboxState } from "../../src/core/sport-sandbox";
Object.assign(window, { demoPath: "/fantasy/play" });
function Fixture() {
  const [state, setState] = useState<SandboxState | null>(null);
  useEffect(() => {
    void fetch("/state" + location.search)
      .then((r) => r.json())
      .then(setState);
  }, []);
  return (
    <SportProvider>
      <AppShell authenticated>
        {state ? (
          <SportSandbox
            initial={state}
            privateBeta
            navigationPath="/fantasy/play"
          />
        ) : (
          <p>Preparing isolated sport fixture…</p>
        )}
      </AppShell>
    </SportProvider>
  );
}
createRoot(document.getElementById("fixture-root")!).render(<Fixture />);
